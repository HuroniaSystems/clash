// Top-level game controller: owns the state, the active view and the UI.

import { BUILDINGS, GRID, OBSTACLES } from './data/buildings.js';
import { TROOPS } from './data/troops.js';
import { Engine } from './render/engine.js';
import { Terrain } from './render/terrain.js';
import { Overlay } from './render/overlay.js';
import { VillageView } from './render/villageView.js';
import { BattleView } from './render/battleView.js';
import { UI } from './ui/ui.js';
import {
  newState, loadState, saveState, tickState, applyOffline, clearSave, RAID_INTERVAL,
} from './core/state.js';
import * as eco from './core/economy.js';
import * as army from './core/army.js';
import { assignVillager } from './core/villagers.js';
import {
  findMatch, makeAttackSim, applyAttackResult, matchCost, createRaid, makeDefenseSim, applyDefenseResult,
} from './core/raids.js';
import { fmtNum } from './util/format.js';
import { sound } from './audio/sound.js';

const SELECT_SOUND = {
  cannon: 'metal', mortar: 'metal', airdefense: 'metal', wall: 'stone', townhall: 'stone', goldstorage: 'metal',
  laboratory: 'magic', wizardtower: 'magic', elixircollector: 'magic', elixirstorage: 'magic',
};

export class Game {
  constructor({ viewport, overlay, ui }) {
    const saved = loadState();
    this.state = saved || newState();
    this.isNew = !saved;
    this.engine = new Engine(viewport);
    this.terrain = new Terrain(this.engine.scene);
    this.overlay = new Overlay(this.engine, overlay);
    this.selection = null;
    this.placement = null;
    this.mode = 'village';
    this.pendingRaid = null;
    this.saveTimer = 0;
    this.ui = new UI(this, ui);
    this.view = new VillageView(this);
    sound.playMusic('village');
    if (this.isNew) {
      this.ui.showIntro();
      saveState(this.state);
    } else this.welcomeBack();
    this.last = performance.now();
    window.addEventListener('beforeunload', () => saveState(this.state));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveState(this.state);
    });
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  welcomeBack() {
    const away = (Date.now() - (this.state.lastSeen || Date.now())) / 1000;
    if (away < 30) return;
    const before = { gold: this.state.resources.gold, elixir: this.state.resources.elixir };
    const events = applyOffline(this.state, away);
    this.handleEvents(events, true);
    let raid = null;
    if (eco.thLevel(this.state) >= 2 && away > this.state.raidTimer) {
      const r = createRaid(this.state);
      const sim = makeDefenseSim(this.state, r);
      sim.runToEnd();
      raid = { name: r.name, ...applyDefenseResult(this.state, r, sim) };
    } else {
      this.state.raidTimer = Math.max(30, this.state.raidTimer - away);
    }
    const built = events.filter((e) => e.type === 'built').length;
    const trained = events.filter((e) => e.type === 'trained').length;
    const joined = events.filter((e) => e.type === 'villagerJoined').length;
    this.ui.showWelcomeBack({ away, built, trained, joined, raid, before });
    saveState(this.state);
  }

  // ---------- helpers for views/UI ----------
  buildSpeed() {
    return eco.buildSpeed(this.state);
  }

  select(pick) {
    if (this.placement) return;
    if (pick?.kind === 'building') {
      const b = eco.findBuilding(this.state, pick.id);
      sound.play('select', { kind: SELECT_SOUND[b?.type] || 'wood' });
    } else if (pick?.kind === 'villager') sound.play('villager');
    else if (pick?.kind === 'obstacle') sound.play('select', { kind: 'wood' });
    this.selection = pick;
    this.ui.refresh();
  }

  selectionTitle() {
    const sel = this.selection;
    if (!sel) return '';
    if (sel.kind === 'building') {
      const b = eco.findBuilding(this.state, sel.id);
      if (!b) return '';
      return `<b>${BUILDINGS[b.type].name}</b><span>${b.level ? `Level ${b.level}` : 'Under construction'}</span>`;
    }
    if (sel.kind === 'obstacle') {
      const o = this.state.obstacles.find((x) => x.id === sel.id);
      return o ? `<b>${OBSTACLES[o.type].name}</b>` : '';
    }
    const v = this.state.villagers.find((x) => x.id === sel.id);
    return v ? `<b>${v.name}</b><span>Level ${v.level}</span>` : '';
  }

  toastResult(r) {
    if (!r.ok) this.ui.toast(r.reason, 'warn');
    return r.ok;
  }

  // ---------- village actions ----------
  collect(id) {
    const b = eco.findBuilding(this.state, id);
    if (!b) return;
    const res = BUILDINGS[b.type].resource;
    const got = eco.collect(this.state, id);
    if (got > 0) {
      this.overlay.floatText(`+${fmtNum(got)}`, this.view.worldPosOf(id), res);
      const sp = this.engine.worldToScreen(this.view.worldPosOf(id));
      this.ui.flyResource(res, sp, got);
      sound.play(res === 'gold' ? 'coin' : 'elixir', { amount: got, pan: this.panOf(this.view.worldPosOf(id)) });
      this.view.burst?.(id, res);
    } else {
      this.ui.toast(`Your ${res} storage is full`, 'warn');
    }
    this.ui.refresh();
  }

  collectAll() {
    for (const b of this.state.buildings) if (BUILDINGS[b.type].resource && b.stored >= 1) this.collect(b.id);
  }

  upgrade(id) {
    const events = [];
    const r = eco.startUpgrade(this.state, id, events);
    if (this.toastResult(r)) {
      const b = eco.findBuilding(this.state, id);
      sound.play(b?.upgrade ? 'build' : 'place');
      this.handleEvents(events);
      this.ui.closeModal();
    }
    this.ui.refresh();
  }

  finishNow(id) {
    const events = [];
    if (eco.finishUpgradeWithGems(this.state, id, events)) {
      sound.play('gem');
      this.handleEvents(events);
    }
    else this.ui.toast('Not enough gems', 'warn');
    this.ui.refresh();
  }

  cancelUpgrade(id) {
    eco.cancelUpgrade(this.state, id);
    if (!eco.findBuilding(this.state, id)) this.selection = null;
    this.ui.refresh();
  }

  startBuy(type) {
    const reason = eco.buyBlocker(this.state, type);
    if (reason) {
      this.ui.toast(reason, 'warn');
      return;
    }
    const spot = this.findSpot(type);
    this.selection = null;
    this.placement = { type, x: spot.x, y: spot.y, moveId: null, valid: true };
    this.ui.closeModal();
    this.view.startGhost();
    this.ui.refresh();
  }

  startMove(id) {
    const b = eco.findBuilding(this.state, id);
    if (!b) return;
    this.placement = { type: b.type, x: b.x, y: b.y, moveId: id, valid: true };
    this.view.startGhost();
    this.ui.refresh();
  }

  findSpot(type) {
    const size = BUILDINGS[type].size;
    const t = this.engine.target;
    const cx = Math.round(t.x + GRID / 2 - size / 2), cy = Math.round(t.z + GRID / 2 - size / 2);
    const occ = eco.occupancy(this.state);
    for (let r = 0; r < GRID; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (eco.canPlace(this.state, type, cx + dx, cy + dy, null, occ)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return { x: cx, y: cy };
  }

  confirmPlacement() {
    const pl = this.placement;
    if (!pl) return;
    if (pl.moveId) {
      if (!eco.moveBuilding(this.state, pl.moveId, pl.x, pl.y)) {
        this.ui.toast('Cannot place there', 'warn');
        return;
      }
      this.selection = { kind: 'building', id: pl.moveId };
      sound.play('place');
      this.cancelPlacement();
      return;
    }
    const events = [];
    const r = eco.placeNew(this.state, pl.type, pl.x, pl.y, events);
    if (!this.toastResult(r)) return;
    sound.play('place');
    if (r.building.upgrade) sound.play('build', { delay: 0.25 });
    this.handleEvents(events);
    if (pl.type === 'wall' && !eco.buyBlocker(this.state, 'wall')) {
      // keep placing walls along the same line
      let dir = pl.lastDir || { x: 1, y: 0 };
      if (pl.prev) {
        const dx = pl.x - pl.prev.x, dy = pl.y - pl.prev.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) dir = { x: dx, y: dy };
      }
      const next = { x: pl.x + dir.x, y: pl.y + dir.y };
      if (!eco.canPlace(this.state, 'wall', next.x, next.y)) {
        const s = this.findSpot('wall');
        next.x = s.x;
        next.y = s.y;
      }
      this.placement = { ...pl, x: next.x, y: next.y, lastDir: dir, prev: { x: pl.x, y: pl.y } };
      this.view.updateGhost();
      this.ui.refresh();
      return;
    }
    this.selection = { kind: 'building', id: r.building.id };
    this.cancelPlacement();
  }

  cancelPlacement() {
    this.placement = null;
    this.view.cancelGhost?.();
    this.ui.refresh();
  }

  removeObstacle(id) {
    const objPos = this.view.omeshes?.get(id)?.position.clone();
    const r = eco.removeObstacle(this.state, id);
    if (this.toastResult(r)) {
      this.ui.toast(`Cleared! Found ${r.gems} gems`, 'good');
      if (objPos) this.ui.flyResource('gems', this.engine.worldToScreen(objPos.setY(1)), r.gems * 30);
      sound.play('chop');
      sound.play('gem', { delay: 0.6 });
      this.selection = null;
    }
    this.ui.refresh();
  }

  assign(vid, bid) {
    const r = assignVillager(this.state, vid, bid);
    this.toastResult(r);
    this.ui.refresh();
    return r.ok;
  }

  train(type) {
    const r = army.queueTroop(this.state, type);
    if (this.toastResult(r)) sound.play('train');
    this.ui.refresh();
  }

  cancelTrain(i) {
    army.cancelQueued(this.state, i);
    this.ui.refresh();
  }

  finishTrain() {
    const ev = [];
    if (!army.finishTrainingWithGems(this.state, ev)) this.ui.toast('Not enough gems', 'warn');
    else sound.play('gem');
    this.ui.refresh();
  }

  research(type) {
    const r = army.startResearch(this.state, type);
    if (this.toastResult(r)) sound.play('research');
    this.ui.refresh();
  }

  finishResearch() {
    const ev = [];
    if (army.finishResearchWithGems(this.state, ev)) {
      sound.play('gem');
      this.handleEvents(ev);
    }
    else this.ui.toast('Not enough gems', 'warn');
    this.ui.refresh();
  }

  focusVillager(id) {
    const a = this.view.agents?.get(id);
    if (a) {
      this.engine.target.set(a.x - GRID / 2, 0, a.y - GRID / 2);
      this.engine.updateCamera();
    }
    this.selection = { kind: 'villager', id };
    this.ui.closeModal();
    this.ui.refresh();
  }

  rename(name) {
    this.state.name = String(name || 'Chief').slice(0, 16);
    saveState(this.state);
    this.ui.refresh();
  }

  resetGame() {
    clearSave();
    this.state = newState();
    this.selection = null;
    this.placement = null;
    this.enterVillage();
    saveState(this.state);
  }

  // ---------- battles ----------
  findMatch() {
    if (this.placement) this.cancelPlacement();
    if (army.armyHousing(this.state) === 0) {
      this.ui.toast('Train some troops first!', 'warn');
      return;
    }
    const cost = matchCost(this.state);
    if (!eco.canAfford(this.state, cost)) {
      this.ui.toast('Not enough gold to search', 'warn');
      return;
    }
    eco.spend(this.state, cost);
    const enemy = findMatch(this.state);
    this.ui.closeModal();
    this.enterBattle({ sim: makeAttackSim(this.state, enemy), mode: 'attack', enemy });
  }

  nextMatch() {
    if (this.mode !== 'battle' || this.view.sim.started) return;
    this.findMatch();
  }

  enterBattle(opts) {
    this.view.dispose();
    this.overlay.clear();
    this.selection = null;
    this.mode = 'battle';
    this.view = new BattleView(this, opts);
    sound.playMusic('battle');
    if (opts.mode === 'defense') sound.play('horn');
    this.engine.target.set(0, 0, 0);
    this.engine.setZoom(1.15);
    this.ui.refresh();
  }

  endBattleEarly() {
    if (this.mode !== 'battle') return;
    const sim = this.view.sim;
    if (!sim.started && this.view.mode === 'attack') {
      this.enterVillage();
      return;
    }
    sim.end();
    this.view.handleEvents();
  }

  finishBattle() {
    if (this.mode !== 'battle' || this.battleDone) return;
    this.battleDone = true;
    const v = this.view;
    let summary;
    if (v.mode === 'attack') {
      const res = v.sim.result();
      const applied = applyAttackResult(this.state, v.enemy, res);
      this.handleEvents(applied.events);
      summary = { mode: 'attack', name: v.enemy.name, ...res, ...applied };
    } else {
      const res = applyDefenseResult(this.state, v.raid, v.sim);
      summary = { mode: 'defense', name: v.raid.name, ...res };
    }
    saveState(this.state);
    const won = summary.mode === 'attack' ? summary.stars > 0 : summary.won;
    sound.duck(4.5, 0.15);
    sound.play(won ? 'victory' : 'defeat');
    this.ui.showBattleResult(summary, () => {
      this.battleDone = false;
      this.enterVillage();
    });
  }

  enterVillage() {
    this.view?.dispose();
    this.overlay.clear();
    this.mode = 'village';
    this.battleDone = false;
    this.view = new VillageView(this);
    sound.playMusic('village');
    this.ui.closeModal();
    this.ui.refresh();
  }

  // Stereo pan (-1..1) for a world position based on where it is on screen.
  panOf(pos) {
    if (!pos) return 0;
    const s = this.engine.worldToScreen(pos);
    return Math.max(-0.8, Math.min(0.8, (s.x / this.engine.width) * 2 - 1));
  }

  watchRaid() {
    const raid = this.pendingRaid?.raid;
    if (!raid) return;
    this.pendingRaid = null;
    if (this.placement) this.cancelPlacement();
    this.ui.closeModal();
    this.enterBattle({ sim: makeDefenseSim(this.state, raid), mode: 'defense', raid });
  }

  resolveRaidQuietly() {
    const raid = this.pendingRaid?.raid;
    if (!raid) return;
    this.pendingRaid = null;
    const sim = makeDefenseSim(this.state, raid);
    sim.runToEnd();
    const res = applyDefenseResult(this.state, raid, sim);
    this.ui.toast(
      res.won
        ? `You defended against ${raid.name}! +${res.trophies} trophies`
        : `${raid.name} raided you: ${res.stars} stars, lost ${fmtNum(res.lost.gold)} gold and ${fmtNum(res.lost.elixir)} elixir`,
      res.won ? 'good' : 'bad',
      5,
    );
    this.ui.refresh();
  }

  // ---------- events ----------
  handleEvents(events, quiet = false) {
    for (const e of events) {
      if (quiet && e.type !== 'playerLevel') continue;
      switch (e.type) {
        case 'built':
          sound.play('complete');
          this.ui.toast(`${BUILDINGS[e.building.type].name} ${e.building.level > 1 ? `upgraded to level ${e.building.level}` : 'completed'}!`, 'good');
          break;
        case 'villagerJoined':
          sound.play('chime');
          sound.play('villager', { delay: 0.35 });
          this.ui.toast(`${e.villager.name} has moved into your village!`, 'good');
          break;
        case 'villagerLevel':
          sound.play('chime');
          this.ui.toast(`${e.villager.name} reached level ${e.villager.level}`, 'info');
          break;
        case 'researched':
          sound.play('complete');
          this.ui.toast(`${TROOPS[e.troop].name} upgraded to level ${e.level}!`, 'good');
          break;
        case 'playerLevel':
          if (!quiet) sound.play('levelup', { delay: 0.4 });
          this.ui.toast(`You reached experience level ${e.level}!`, 'good');
          break;
        default:
          break;
      }
    }
    if (events.length) this.ui.refresh();
  }

  update(dt) {
    const events = tickState(this.state, dt);
    if (events.length) this.handleEvents(events);

    if (this.mode === 'village' && eco.thLevel(this.state) >= 2) {
      if (this.pendingRaid) {
        this.pendingRaid.left -= dt;
        if (this.pendingRaid.left <= 0) this.resolveRaidQuietly();
      } else {
        this.state.raidTimer -= dt;
        if (this.state.raidTimer <= 0) {
          this.state.raidTimer = RAID_INTERVAL;
          this.pendingRaid = { raid: createRaid(this.state), left: 25 };
          sound.play('alarm');
          this.ui.refresh();
        }
      }
    }

    this.saveTimer += dt;
    if (this.saveTimer > 4) {
      this.saveTimer = 0;
      saveState(this.state);
    }
    this.view.update(dt);
    sound.update(dt, this.mode);
    this.overlay.update(dt);
    this.ui.update(dt);
    this.engine.render();
  }
}

