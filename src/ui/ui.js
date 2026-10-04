// HUD, contextual action bar, battle HUD, toasts and modal host.

import { BUILDINGS, OBSTACLES } from '../data/buildings.js';
import { TROOPS, TROOP_ORDER } from '../data/troops.js';
import * as eco from '../core/economy.js';
import { matchCost } from '../core/raids.js';
import { xpForLevel } from '../core/villagers.js';
import { fmtNum, fmtTime, fmtClock } from '../util/format.js';
import { troopPortrait } from '../render/portraits.js';
import { h, icon, costEl, bar, svg, stars, avatar, patch, ensureSprite } from './dom.js';
import * as panels from './panels.js';
import { sound } from '../audio/sound.js';

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.dirty = true;
    this.tick = 1;
    this.modal = null;
    ensureSprite();
    this.build();
  }

  get state() {
    return this.game.state;
  }

  build() {
    const r = this.root;
    r.innerHTML = '';

    // ----- village HUD -----
    this.hud = h('div', { class: 'hud' });
    this.player = {
      lvl: h('span'),
      name: h('div', { class: 'pname' }),
      xp: h('div', { class: 'xpfill' }),
      trophies: h('span', { class: 'trophy-val' }),
    };
    const playerBox = h(
      'div',
      { class: 'hud-player', onclick: () => this.openModal(panels.settingsPanel(this)) },
      h('div', { class: 'lvl-badge' }, icon('xp'), this.player.lvl),
      h('div', { class: 'pinfo' }, this.player.name, h('div', { class: 'xpbar' }, this.player.xp)),
    );
    const trophyBox = h('div', { class: 'hud-trophies' }, icon('trophy'), this.player.trophies);
    this.res = {};
    const resBox = h('div', { class: 'hud-res' });
    for (const k of ['gold', 'elixir', 'gems']) {
      const val = h('span', { class: 'res-val' });
      const fill = h('div', { class: 'res-fill' });
      const capEl = h('div', { class: 'res-cap' });
      const ico = icon(k, 'res-icon');
      const row = h('div', { class: `res-row res-${k}` }, capEl, h('div', { class: 'res-bar' }, fill, h('div', { class: 'res-gloss' }), val), ico);
      this.res[k] = { val, fill, capEl, ico, row, disp: null, last: null, hold: 0, shown: '' };
      resBox.appendChild(row);
    }
    this.builderEl = h('span');
    this.villagerEl = h('span');
    this.shieldText = h('span');
    this.shieldEl = h('div', { class: 'hud-chip shield' }, icon('shield'), this.shieldText);
    const centerBox = h(
      'div',
      { class: 'hud-center' },
      h('div', { class: 'hud-chip', title: 'Builders', onclick: () => this.toast('Each Builder\'s Hut gives one builder. Assign Masons to speed up construction.', 'info', 4) }, svg('hammer'), this.builderEl),
      h('div', { class: 'hud-chip', title: 'Villagers', onclick: () => this.openModal(panels.villagersPanel(this)) }, svg('people'), this.villagerEl),
      this.shieldEl,
    );
    this.attackBtn = h('button', { class: 'big-btn attack-btn', onclick: () => this.openModal(panels.attackPanel(this)) }, h('span', { class: 'big-ico' }, svg('swords')), h('span', { class: 'big-label', text: 'Attack!' }));
    const right = h(
      'div',
      { class: 'hud-buttons' },
      this.roundBtn('log', 'Log', () => this.openModal(panels.logPanel(this))),
      this.roundBtn('people', 'Villagers', () => this.openModal(panels.villagersPanel(this))),
      this.roundBtn('army', 'Army', () => this.openModal(panels.armyPanel(this))),
      h('button', { class: 'big-btn shop-btn', onclick: () => this.openModal(panels.shopPanel(this)) }, h('span', { class: 'big-ico' }, svg('shop')), h('span', { class: 'big-label', text: 'Shop' })),
    );
    this.hud.append(
      h('div', { class: 'hud-tl' }, playerBox, trophyBox),
      centerBox,
      resBox,
      h('div', { class: 'hud-bl' }, this.attackBtn),
      h('div', { class: 'hud-br' }, right),
    );

    // ----- contextual bars -----
    this.actionBar = h('div', { class: 'action-bar' });
    this.placeBar = h('div', { class: 'place-bar' });
    this.raidBanner = h('div', { class: 'raid-banner' });

    // ----- battle HUD -----
    this.bhud = h('div', { class: 'bhud' });

    this.muteBtn = h('button', { class: 'round-btn mute-btn', title: 'Sound', onclick: () => { sound.toggleMute(); this.renderMute(); } });
    this.renderMute();
    this.flyLayer = h('div', { class: 'fly-layer' });
    this.toasts = h('div', { class: 'toasts' });
    this.modalRoot = h('div', { class: 'modal-root' });
    r.append(this.flyLayer, this.hud, this.actionBar, this.placeBar, this.raidBanner, this.bhud, this.muteBtn, this.toasts, this.modalRoot);
    // every button gets a click; buttons can opt into a different sound with data-sfx
    r.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const name = b.dataset.sfx || (b.classList.contains('tab') ? 'tab' : 'click');
      if (name !== 'none') sound.play(name);
    }, true);
  }

  roundBtn(ico, label, onClick) {
    return h('button', { class: 'round-btn', onclick: onClick }, h('span', { class: 'round-ico' }, svg(ico)), h('span', { class: 'round-label', text: label }));
  }

  refresh() {
    this.dirty = true;
  }

  // ---------- per-frame ----------
  update(dt) {
    this.tick += dt;
    if (this.game.mode === 'village') this.animateResources(dt);
    const game = this.game;
    const inVillage = game.mode === 'village';
    this.hud.classList.toggle('hidden', !inVillage);
    this.bhud.classList.toggle('hidden', inVillage);
    this.muteBtn.classList.toggle('in-battle', !inVillage);

    if (this.dirty) {
      this.dirty = false;
      if (inVillage) {
        this.renderActionBar();
        this.renderPlaceBar();
        this.renderRaidBanner();
      } else {
        this.actionBar.classList.add('hidden');
        this.placeBar.classList.add('hidden');
        this.raidBanner.classList.add('hidden');
        this.renderBattleHud();
      }
      if (this.modal?.live) this.renderModal();
    }

    if (this.tick >= 0.2) {
      this.tick = 0;
      if (inVillage) {
        this.updateHud();
        if (this.game.selection) this.renderActionBar();
        if (game.pendingRaid) this.renderRaidBanner();
      } else this.updateBattleHud();
      if (this.modal?.live) {
        this.modal.liveTick = (this.modal.liveTick || 0) + 1;
        if (this.modal.liveTick % 3 === 0) this.renderModal();
      }
    }
  }

  updateHud() {
    const s = this.state;
    const cap = eco.storageCap(s);
    this.player.lvl.textContent = s.level;
    this.player.name.textContent = s.name;
    this.player.xp.style.width = `${(s.xp / eco.xpForPlayerLevel(s.level)) * 100}%`;
    this.player.trophies.textContent = fmtNum(s.trophies);
    for (const k of ['gold', 'elixir']) {
      const t = `Max: ${fmtNum(cap[k])}`;
      if (this.res[k].capEl.textContent !== t) this.res[k].capEl.textContent = t;
    }
    this.res.gems.fill.style.width = '100%';
    this.builderEl.textContent = `${eco.freeBuilders(s)}/${eco.buildersTotal(s)}`;
    this.villagerEl.textContent = `${s.villagers.length}/${eco.housingCap(s)}`;
    if (s.shield > 0) {
      this.shieldText.textContent = `Shield ${fmtTime(s.shield)}`;
      this.shieldEl.classList.remove('hidden');
    } else this.shieldEl.classList.add('hidden');
  }

  // ---------- animated resource counters ----------
  // Displayed values ease toward the real ones; a hold delays counting until
  // flying coins reach the bar.
  animateResources(dt) {
    const s = this.state;
    const cap = eco.storageCap(s);
    const now = performance.now();
    for (const k of ['gold', 'elixir', 'gems']) {
      const r = this.res[k];
      const target = s.resources[k];
      if (r.disp == null) r.disp = r.last = target;
      if (target > r.last + (k === 'gems' ? 0.5 : 9) && now >= r.hold) this.bump(k);
      r.last = target;
      if (now < r.hold) continue;
      const diff = target - r.disp;
      let state = '';
      if (Math.abs(diff) < 0.5) r.disp = target;
      else {
        // fast at first, settles in about half a second
        const step = diff * Math.min(1, dt * 4.5);
        r.disp += Math.sign(diff) * Math.max(Math.abs(step), Math.min(Math.abs(diff), 60 * dt));
        state = diff > 0 ? 'gain' : 'spend';
      }
      const text = fmtNum(Math.round(r.disp));
      if (text !== r.shown) {
        r.shown = text;
        r.val.textContent = text;
      }
      r.row.classList.toggle('gain', state === 'gain');
      r.row.classList.toggle('spend', state === 'spend');
      if (k !== 'gems') r.fill.style.width = `${cap[k] ? Math.min(100, (r.disp / cap[k]) * 100) : 0}%`;
    }
  }

  bump(res) {
    const r = this.res[res];
    if (!r) return;
    r.ico.classList.remove('bump');
    void r.ico.offsetWidth;
    r.ico.classList.add('bump');
    r.row.classList.remove('flash');
    void r.row.offsetWidth;
    r.row.classList.add('flash');
  }

  // Coins (or elixir drops, gems) fly from a screen point into the resource bar.
  flyResource(res, from, amount) {
    const r = this.res[res];
    if (!r || this.game.mode !== 'village') return;
    const to = r.ico.getBoundingClientRect();
    const tx = to.left + to.width / 2;
    const ty = to.top + to.height / 2;
    const n = Math.max(4, Math.min(12, Math.round(3 + amount / 50)));
    const first = 520;
    r.hold = performance.now() + first;
    for (let i = 0; i < n; i++) {
      const el = icon(res, 'fly-coin');
      this.flyLayer.appendChild(el);
      const a = Math.random() * Math.PI * 2;
      const spread = 28 + Math.random() * 34;
      const x0 = from.x, y0 = from.y;
      const x1 = x0 + Math.cos(a) * spread, y1 = y0 + Math.sin(a) * spread * 0.7 - 24;
      const delay = i * 45;
      const dur = first + 120 + Math.random() * 160;
      const anim = el.animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(0.4) rotate(0deg)`, opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
          { transform: `translate(${x1}px, ${y1}px) scale(1.15) rotate(${a * 30}deg)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.55,0,.85,.35)' },
          { transform: `translate(${tx}px, ${ty}px) scale(0.75) rotate(${a * 60}deg)`, opacity: 1 },
        ],
        { duration: dur, delay, fill: 'both' },
      );
      anim.onfinish = () => {
        el.remove();
        this.bump(res);
        sound.play(res === 'elixir' ? 'elixirTick' : 'coinTick', { volume: 0.6 });
      };
    }
  }

  // ---------- action bar ----------
  actBtn(name, label, sub, onClick, cls = '', disabled = false) {
    return h(
      'button',
      { class: `act-btn ${cls} ${disabled ? 'dim' : ''}`, 'data-key': name, onclick: (e) => { e.stopPropagation(); onClick(); } },
      h('div', { class: 'act-ico' }, name === 'collect' ? icon(cls) : svg(name)),
      h('div', { class: 'act-label' }, label),
      sub ? h('div', { class: 'act-sub' }, sub) : null,
    );
  }

  renderActionBar() {
    const el = this.actionBar;
    const game = this.game;
    const sel = game.selection;
    const nodes = this.actionNodes(sel);
    if (!nodes || game.placement || game.mode !== 'village') {
      el.classList.add('hidden');
      el.replaceChildren();
      this.actionKey = null;
      return;
    }
    // a different selection gets a fresh bar (and its entrance animation)
    const key = `${sel.kind}:${sel.id}`;
    if (key !== this.actionKey) {
      this.actionKey = key;
      el.replaceChildren();
    }
    el.classList.remove('hidden');
    patch(el, nodes);
  }

  actionNodes(sel) {
    if (!sel) return null;
    const s = this.state;
    if (sel.kind === 'building') {
      const b = eco.findBuilding(s, sel.id);
      if (!b) return null;
      const d = BUILDINGS[b.type];
      const btns = [];
      btns.push(this.actBtn('info', 'Info', null, () => this.openModal(panels.infoPanel(this, b.id))));
      if (b.upgrade) {
        const left = b.upgrade.remaining / eco.buildSpeed(s);
        btns.push(this.actBtn('finish', 'Finish', h('span', { class: 'cost' }, fmtNum(eco.gemCostForTime(left)), icon('gems')), () => this.game.finishNow(b.id), 'gem'));
        btns.push(this.actBtn('cancel', 'Cancel', null, () => this.confirm('Cancel construction? You get half of the cost back.', () => this.game.cancelUpgrade(b.id)), 'red'));
      } else if (b.level < d.levels.length) {
        const next = d.levels[b.level];
        const blocker = eco.upgradeBlocker(s, b);
        btns.push(this.actBtn('upgrade', 'Upgrade', costEl(next.cost, s), () => this.openModal(panels.infoPanel(this, b.id, true)), 'green', !!blocker));
      }
      if (d.resource && b.level >= 1) {
        btns.push(this.actBtn('collect', 'Collect', h('span', { class: 'cost' }, fmtNum(b.stored || 0), icon(d.resource)), () => this.game.collect(b.id), d.resource, (b.stored || 0) < 1));
      }
      if (d.job && b.level >= 1) {
        const n = eco.workersAt(s, b.id).length;
        btns.push(this.actBtn('workers', 'Workers', `${n}/${eco.workerSlots(b)}`, () => this.openModal(panels.workersPanel(this, b.id))));
      }
      if ((b.type === 'barracks' || b.type === 'armycamp') && b.level >= 1) btns.push(this.actBtn('train', 'Train', null, () => this.openModal(panels.armyPanel(this))));
      if (b.type === 'laboratory' && b.level >= 1) btns.push(this.actBtn('research', 'Research', null, () => this.openModal(panels.labPanel(this))));
      btns.push(this.actBtn('move', 'Move', null, () => this.game.startMove(b.id)));
      return btns;
    }
    if (sel.kind === 'obstacle') {
      const o = s.obstacles.find((x) => x.id === sel.id);
      if (!o) return null;
      return [this.actBtn('remove', 'Remove', costEl(OBSTACLES[o.type].cost, s), () => this.game.removeObstacle(o.id), 'green', !eco.canAfford(s, OBSTACLES[o.type].cost))];
    }
    if (sel.kind === 'villager') {
      const v = s.villagers.find((x) => x.id === sel.id);
      if (!v) return null;
      const card = h(
        'div',
        { class: 'vcard' },
        avatar(v.look, 46),
        h(
          'div',
          { class: 'vcard-info' },
          h('div', { class: 'vcard-name' }, v.name, h('span', { class: 'lvl-pill' }, `Lv ${v.level}`)),
          h('div', { class: 'vcard-sub' }, `${panels.skillName(v.skill)} specialist`),
          h('div', { class: 'vcard-sub' }, panels.jobText(s, v)),
          bar(v.level >= 10 ? 1 : v.xp / xpForLevel(v.level), 'xp'),
        ),
      );
      const out = [card, this.actBtn('workers', 'Assign', null, () => this.openModal(panels.jobPickerPanel(this, v.id)))];
      if (v.job) out.push(this.actBtn('cancel', 'Unassign', null, () => this.game.assign(v.id, null), 'red'));
      out.push(this.actBtn('people', 'All', null, () => this.openModal(panels.villagersPanel(this))));
      return out;
    }
    return null;
  }

  renderPlaceBar() {
    const pb = this.placeBar;
    const pl = this.game.placement;
    if (!pl) {
      pb.classList.add('hidden');
      pb.replaceChildren();
      return;
    }
    pb.classList.remove('hidden');
    const d = BUILDINGS[pl.type];
    patch(pb, [
      h(
        'div',
        { class: 'place-info' },
        h('div', { class: 'place-title' }, pl.moveId ? `Move ${d.name}` : `Place ${d.name}`),
        pl.moveId ? h('div', { class: 'place-sub' }, 'Drag or tap to choose a spot') : costEl(eco.buildCost(this.state, pl.type), this.state),
      ),
      h('button', { class: 'circle-btn red', onclick: () => this.game.cancelPlacement() }, svg('cancel')),
      h('button', { class: `circle-btn green ${pl.valid === false ? 'dim' : ''}`, onclick: () => this.game.confirmPlacement() }, svg('check')),
    ]);
  }

  renderRaidBanner() {
    const rb = this.raidBanner;
    const pr = this.game.pendingRaid;
    if (!pr || this.game.mode !== 'village') {
      rb.classList.add('hidden');
      rb.replaceChildren();
      return;
    }
    rb.classList.remove('hidden');
    patch(rb, [
      h('div', { class: 'raid-text' }, h('b', {}, `${pr.raid.name} is attacking!`), h('span', {}, `Raiders arrive in ${Math.ceil(pr.left)}s`)),
      h('button', { class: 'btn green', onclick: () => this.game.watchRaid() }, 'Defend'),
      h('button', { class: 'btn', onclick: () => this.game.resolveRaidQuietly() }, 'Skip'),
    ]);
  }

  // ---------- battle HUD ----------
  // The skeleton is built once per battle; afterwards only values are patched.
  renderBattleHud() {
    const v = this.game.view;
    const el = this.bhud;
    if (!v?.sim) {
      el.replaceChildren();
      this.bView = null;
      return;
    }
    if (this.bView !== v) this.buildBattleHud(v);
    this.updateBattleHud();
  }

  buildBattleHud(v) {
    const el = this.bhud;
    el.replaceChildren();
    this.bView = v;
    const sim = v.sim;
    this.b = {};
    if (v.mode === 'attack') {
      const e = v.enemy;
      this.b.availTotal = sim.totalLootAvailable();
      this.b.lootGold = h('span');
      this.b.lootElixir = h('span');
      el.append(
        h(
          'div',
          { class: 'bh-enemy' },
          h('div', { class: 'bh-name' }, e.name, h('span', { class: 'th-pill' }, `TH ${e.th}`)),
          h('div', { class: 'bh-loot-title' }, 'Available loot'),
          h('div', { class: 'bh-loot gold' }, icon('gold'), this.b.lootGold),
          h('div', { class: 'bh-loot elixir' }, icon('elixir'), this.b.lootElixir),
          h('div', { class: 'bh-trophy' }, icon('trophy'), h('span', { class: 'win' }, `+${e.trophyWin}`), h('span', { class: 'lose' }, `-${e.trophyLose}`)),
        ),
      );
    } else {
      el.append(
        h(
          'div',
          { class: 'bh-enemy defense' },
          h('div', { class: 'bh-name' }, `${v.raid.name} attacks!`),
          h('div', { class: 'bh-loot-title' }, 'Your defenses and their Gunners and Lookouts are fighting back.'),
        ),
      );
    }
    this.b.timerLabel = h('div', { class: 'bh-timer-label' });
    this.b.timer = h('div', { class: 'bh-timer' });
    this.b.stars = h('div', { class: 'bh-stars-wrap' });
    this.b.destr = h('div', { class: 'bh-destr' });
    this.b.speed = h('button', { class: 'btn small blue speed-btn', onclick: () => { v.speed = v.speed === 1 ? 2 : v.speed === 2 ? 4 : 1; this.updateBattleHud(); } });
    el.append(h('div', { class: 'bh-status' }, this.b.timerLabel, this.b.timer, this.b.stars, this.b.destr, this.b.speed));

    const bottom = h('div', { class: 'bh-bottom' });
    this.b.endBtn = h('button', { class: `btn red end-btn ${v.mode === 'attack' ? '' : 'invisible'}`, onclick: () => this.game.endBattleEarly() });
    bottom.append(this.b.endBtn);
    this.b.troopBar = h('div', { class: 'troop-bar' });
    if (v.mode === 'attack') {
      bottom.append(this.b.troopBar);
      this.b.nextBtn = h('button', { class: 'btn yellow next-btn', onclick: () => this.game.nextMatch() }, 'Next', costEl(matchCost(this.state)));
      bottom.append(this.b.nextBtn);
    } else {
      bottom.append(h('div'), h('button', { class: 'btn yellow next-btn', onclick: () => { v.speed = 8; } }, svg('skip'), 'Fast Forward'));
    }
    this.b.lootGain = h('div', { class: 'bh-gain' });
    el.append(bottom, this.b.lootGain);
  }

  troopBarNodes(v) {
    const sim = v.sim;
    const types = TROOP_ORDER.filter((t) => (sim.army[t] || 0) > 0 || (sim.deployed[t] || 0) > 0);
    if (!types.length) return [h('div', { class: 'troop-empty' }, 'No troops! Train some in your Barracks.')];
    return types.map((t) => {
      const n = sim.army[t] || 0;
      return h(
        'button',
        { class: `troop-card ${v.selectedTroop === t ? 'sel' : ''} ${n === 0 ? 'empty' : ''}`, 'data-key': t, onclick: () => { v.selectedTroop = t; this.updateBattleHud(); } },
        h('img', { src: troopPortrait(t, this.state.research.levels[t]), alt: TROOPS[t].name, draggable: 'false' }),
        h('div', { class: 'tc-count' }, `x${n}`),
        h('div', { class: 'tc-lvl' }, String(this.state.research.levels[t] || 1)),
      );
    });
  }

  updateBattleHud() {
    const v = this.game.view;
    if (!v?.sim || !this.b || this.bView !== v) return;
    const sim = v.sim;
    const got = sim.loot;
    if (v.mode === 'attack') {
      const av = this.b.availTotal;
      this.b.lootGold.textContent = fmtNum(Math.max(0, av.gold - got.gold));
      this.b.lootElixir.textContent = fmtNum(Math.max(0, av.elixir - got.elixir));
      patch(this.b.troopBar, this.troopBarNodes(v));
      this.b.nextBtn.classList.toggle('invisible', sim.started);
      const endText = sim.started && !sim.ended ? 'End Battle' : 'Return Home';
      if (this.b.endBtn.textContent !== endText) this.b.endBtn.textContent = endText;
      patch(this.b.lootGain, got.gold + got.elixir > 0 ? [h('span', {}, icon('gold'), `+${fmtNum(got.gold)}`), h('span', {}, icon('elixir'), `+${fmtNum(got.elixir)}`)] : []);
    } else {
      patch(this.b.lootGain, got.gold + got.elixir > 0 ? [h('span', { class: 'lost' }, icon('gold'), `-${fmtNum(got.gold)}`), h('span', { class: 'lost' }, icon('elixir'), `-${fmtNum(got.elixir)}`)] : []);
    }
    const label = sim.started ? 'Battle ends in' : 'Battle starts in';
    if (this.b.timerLabel.textContent !== label) this.b.timerLabel.textContent = label;
    const clock = fmtClock(sim.started ? sim.timeLeft : v.scoutLeft);
    if (this.b.timer.textContent !== clock) this.b.timer.textContent = clock;
    this.b.timer.classList.toggle('urgent', sim.started && sim.timeLeft < 30);
    patch(this.b.stars, [stars(sim.stars(), 3, 'bh-stars')]);
    const destr = `${sim.destruction()}%`;
    if (this.b.destr.textContent !== destr) this.b.destr.textContent = destr;
    const sp = `${v.speed}x`;
    if (this.b.speed.textContent !== sp) this.b.speed.textContent = sp;
  }

  // ---------- toasts ----------
  renderMute() {
    this.muteBtn.replaceChildren(h('span', { class: 'round-ico' }, svg(sound.settings.muted ? 'mute' : 'speaker')));
  }

  toast(msg, kind = 'info', secs = 2.6) {
    if (kind === 'warn') sound.play('error');
    // repeated identical messages bump the existing toast instead of stacking
    const last = this.toasts.lastElementChild;
    if (last && last.textContent === msg && !last.classList.contains('out')) {
      last.classList.remove('bump');
      void last.offsetWidth;
      last.classList.add('bump');
      clearTimeout(last._t1);
      clearTimeout(last._t2);
      last._t1 = setTimeout(() => last.classList.add('out'), secs * 1000);
      last._t2 = setTimeout(() => last.remove(), secs * 1000 + 400);
      return;
    }
    const t = h('div', { class: `toast ${kind}` }, msg);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    t._t1 = setTimeout(() => t.classList.add('out'), secs * 1000);
    t._t2 = setTimeout(() => t.remove(), secs * 1000 + 400);
  }

  // ---------- modals ----------
  // panel: { title, render(): Node, live?: bool, wide?: bool, onClose?: fn }
  openModal(panel) {
    if (!this.modal) sound.play('open');
    this.modal = panel;
    this.renderModal(true);
  }

  renderModal(fresh = false) {
    const m = this.modal;
    const root = this.modalRoot;
    if (!m) return this.hideModal();
    clearTimeout(this.modalCloseTimer);
    root.classList.remove('closing');
    root.classList.add('open');
    const title = typeof m.title === 'function' ? m.title() : m.title;
    const content = m.render();
    if (!this.modalBox || fresh) {
      const animate = !this.modalBox;
      if (!this.modalBox) {
        root.replaceChildren();
        this.modalBackdrop = h('div', { class: 'modal-backdrop', onclick: () => !this.modal?.noClose && this.closeModal() });
        this.modalBox = h('div', { class: 'modal', onclick: (e) => e.stopPropagation() });
        root.append(this.modalBackdrop, this.modalBox);
      }
      this.modalTitle = h('div', { class: 'modal-title' }, title);
      this.modalBody = h('div', { class: 'modal-body' }, content);
      this.modalBox.className = `modal ${m.wide ? 'wide' : ''} ${m.cls || ''} ${animate ? 'enter' : 'swap'}`.replace(/\s+/g, ' ');
      this.modalBox.replaceChildren(
        h('div', { class: 'modal-head' }, h('div', { class: 'modal-ribbon' }, this.modalTitle), m.noClose ? null : h('button', { class: 'modal-x', 'data-sfx': 'none', 'aria-label': 'Close', onclick: () => this.closeModal() }, svg('cancel'))),
        this.modalBody,
      );
      return;
    }
    if (this.modalTitle.textContent !== title) this.modalTitle.textContent = title;
    patch(this.modalBody, [content]);
  }

  hideModal() {
    const root = this.modalRoot;
    if (!this.modalBox) return;
    root.classList.add('closing');
    const box = this.modalBox;
    this.modalBox = null;
    clearTimeout(this.modalCloseTimer);
    this.modalCloseTimer = setTimeout(() => {
      if (this.modalBox) return;
      root.classList.remove('open', 'closing');
      if (box.parentNode === root) root.replaceChildren();
    }, 170);
  }

  closeModal() {
    const m = this.modal;
    if (m) sound.play('close');
    this.modal = null;
    this.hideModal();
    m?.onClose?.();
  }

  confirm(text, onYes) {
    const prev = this.modal;
    this.openModal({
      title: 'Are you sure?',
      cls: 'small',
      render: () =>
        h(
          'div',
          { class: 'confirm' },
          h('p', {}, text),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => (prev ? this.openModal(prev) : this.closeModal()) }, 'No'), h('button', { class: 'btn green', onclick: () => { this.closeModal(); onYes(); } }, 'Yes')),
        ),
    });
  }

  showBattleResult(summary, onDone) {
    this.openModal(panels.resultPanel(this, summary, onDone));
  }

  showIntro() {
    this.openModal(panels.introPanel(this));
  }

  showWelcomeBack(info) {
    this.openModal(panels.welcomePanel(this, info));
  }
}

