// HUD, contextual action bar, battle HUD, toasts and modal host.

import { BUILDINGS, OBSTACLES } from '../data/buildings.js';
import { TROOPS, TROOP_ORDER } from '../data/troops.js';
import * as eco from '../core/economy.js';
import { matchCost } from '../core/raids.js';
import { xpForLevel } from '../core/villagers.js';
import { fmtNum, fmtTime, fmtClock } from '../util/format.js';
import { troopPortrait } from '../render/portraits.js';
import { h, icon, costEl, bar, svg, stars, avatar } from './dom.js';
import * as panels from './panels.js';
import { sound } from '../audio/sound.js';

function swap(target, nodes) {
  const tmp = document.createElement('div');
  tmp.append(...nodes);
  if (tmp.innerHTML === target.innerHTML) return false;
  target.replaceChildren(...tmp.childNodes);
  return true;
}

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.dirty = true;
    this.tick = 1;
    this.modal = null;
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
      h('div', { class: 'lvl-badge' }, this.player.lvl),
      h('div', { class: 'pinfo' }, this.player.name, h('div', { class: 'xpbar' }, this.player.xp)),
    );
    const trophyBox = h('div', { class: 'hud-trophies' }, icon('trophy', 'big'), this.player.trophies);
    this.res = {};
    const resBox = h('div', { class: 'hud-res' });
    for (const k of ['gold', 'elixir', 'gems']) {
      const val = h('span', { class: 'res-val' });
      const fill = h('div', { class: 'res-fill' });
      const capEl = h('div', { class: 'res-cap' });
      this.res[k] = { val, fill, capEl };
      resBox.appendChild(h('div', { class: `res-row res-${k}` }, h('div', { class: 'res-bar' }, fill, val), icon(k, 'big res-icon'), capEl));
    }
    this.builderEl = h('span');
    this.villagerEl = h('span');
    this.shieldEl = h('div', { class: 'hud-chip shield' });
    const centerBox = h(
      'div',
      { class: 'hud-center' },
      h('div', { class: 'hud-chip', title: 'Builders', onclick: () => this.toast('Each Builder\'s Hut gives one builder. Assign Masons to speed up construction.', 'info', 4) }, svg('hammer'), this.builderEl),
      h('div', { class: 'hud-chip', title: 'Villagers', onclick: () => this.openModal(panels.villagersPanel(this)) }, svg('people'), this.villagerEl),
      this.shieldEl,
    );
    this.attackBtn = h('button', { class: 'big-btn attack-btn', onclick: () => this.openModal(panels.attackPanel(this)) }, svg('swords'), h('span', { text: 'Attack!' }));
    const right = h(
      'div',
      { class: 'hud-buttons' },
      h('button', { class: 'round-btn', onclick: () => this.openModal(panels.logPanel(this)) }, svg('log'), h('span', { text: 'Log' })),
      h('button', { class: 'round-btn', onclick: () => this.openModal(panels.villagersPanel(this)) }, svg('people'), h('span', { text: 'Villagers' })),
      h('button', { class: 'round-btn', onclick: () => this.openModal(panels.armyPanel(this)) }, svg('army'), h('span', { text: 'Army' })),
      h('button', { class: 'big-btn shop-btn', onclick: () => this.openModal(panels.shopPanel(this)) }, svg('shop'), h('span', { text: 'Shop' })),
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

    this.muteBtn = h('button', { class: 'round-btn small mute-btn', title: 'Sound', onclick: () => { sound.toggleMute(); this.renderMute(); } });
    this.renderMute();
    this.toasts = h('div', { class: 'toasts' });
    this.modalRoot = h('div', { class: 'modal-root' });
    r.append(this.hud, this.actionBar, this.placeBar, this.raidBanner, this.bhud, this.muteBtn, this.toasts, this.modalRoot);
    // every button gets a click; buttons can opt into a different sound with data-sfx
    r.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const name = b.dataset.sfx || (b.classList.contains('tab') ? 'tab' : 'click');
      if (name !== 'none') sound.play(name);
    }, true);
  }

  refresh() {
    this.dirty = true;
  }

  // ---------- per-frame ----------
  update(dt) {
    this.tick += dt;
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
      this.res[k].val.textContent = fmtNum(s.resources[k]);
      this.res[k].fill.style.width = `${cap[k] ? Math.min(100, (s.resources[k] / cap[k]) * 100) : 0}%`;
      this.res[k].capEl.textContent = `Max: ${fmtNum(cap[k])}`;
    }
    this.res.gems.val.textContent = fmtNum(s.resources.gems);
    this.res.gems.fill.style.width = '100%';
    this.res.gems.capEl.textContent = '';
    this.builderEl.textContent = `${eco.freeBuilders(s)}/${eco.buildersTotal(s)}`;
    this.villagerEl.textContent = `${s.villagers.length}/${eco.housingCap(s)}`;
    if (s.shield > 0) {
      this.shieldEl.textContent = `Shield ${fmtTime(s.shield)}`;
      this.shieldEl.classList.remove('hidden');
    } else this.shieldEl.classList.add('hidden');
  }

  // ---------- action bar ----------
  actBtn(name, label, sub, onClick, cls = '', disabled = false) {
    return h(
      'button',
      { class: `act-btn ${cls} ${disabled ? 'dim' : ''}`, onclick: (e) => { e.stopPropagation(); onClick(); } },
      h('div', { class: 'act-ico' }, svg(name)),
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
      return;
    }
    el.classList.remove('hidden');
    swap(el, nodes);
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
    pb.innerHTML = '';
    if (!pl) {
      pb.classList.add('hidden');
      return;
    }
    pb.classList.remove('hidden');
    const d = BUILDINGS[pl.type];
    pb.append(
      h(
        'div',
        { class: 'place-info' },
        h('div', { class: 'place-title' }, pl.moveId ? `Move ${d.name}` : `Place ${d.name}`),
        pl.moveId ? h('div', { class: 'place-sub' }, 'Drag or tap to choose a spot') : costEl(eco.buildCost(this.state, pl.type), this.state),
      ),
      h('button', { class: 'circle-btn red', onclick: () => this.game.cancelPlacement() }, svg('cancel')),
      h('button', { class: `circle-btn green ${pl.valid === false ? 'dim' : ''}`, onclick: () => this.game.confirmPlacement() }, svg('check')),
    );
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
    swap(rb, [
      h('div', { class: 'raid-text' }, h('b', {}, `${pr.raid.name} is attacking!`), h('span', {}, `Raiders arrive in ${Math.ceil(pr.left)}s`)),
      h('button', { class: 'btn green', onclick: () => this.game.watchRaid() }, 'Defend'),
      h('button', { class: 'btn', onclick: () => this.game.resolveRaidQuietly() }, 'Skip'),
    ]);
  }

  // ---------- battle HUD ----------
  renderBattleHud() {
    const v = this.game.view;
    const el = this.bhud;
    el.innerHTML = '';
    if (!v?.sim) return;
    const sim = v.sim;
    this.b = {};
    if (v.mode === 'attack') {
      const e = v.enemy;
      const avail = sim.totalLootAvailable();
      this.b.lootGold = h('span');
      this.b.lootElixir = h('span');
      el.append(
        h(
          'div',
          { class: 'bh-enemy' },
          h('div', { class: 'bh-name' }, e.name, h('span', { class: 'th-pill' }, `TH ${e.th}`)),
          h('div', { class: 'bh-loot-title' }, 'Available loot:'),
          h('div', { class: 'bh-loot' }, this.b.lootGold, icon('gold')),
          h('div', { class: 'bh-loot' }, this.b.lootElixir, icon('elixir')),
          h('div', { class: 'bh-trophy' }, icon('trophy'), `Victory: +${e.trophyWin}  Defeat: -${e.trophyLose}`),
        ),
      );
      this.b.availTotal = avail;
    } else {
      el.append(
        h(
          'div',
          { class: 'bh-enemy defense' },
          h('div', { class: 'bh-name' }, `${v.raid.name} attacks!`),
          h('div', { class: 'bh-loot-title' }, 'Your defenses and their Gunners & Lookouts are fighting back.'),
        ),
      );
    }
    this.b.timerLabel = h('div', { class: 'bh-timer-label' });
    this.b.timer = h('div', { class: 'bh-timer' });
    this.b.stars = h('div');
    this.b.destr = h('div', { class: 'bh-destr' });
    this.b.speed = h('button', { class: 'btn small', onclick: () => { v.speed = v.speed === 1 ? 2 : v.speed === 2 ? 4 : 1; this.b.speed.textContent = `${v.speed}x`; } }, `${v.speed}x`);
    el.append(h('div', { class: 'bh-status' }, this.b.timerLabel, this.b.timer, this.b.stars, this.b.destr, this.b.speed));

    const bottom = h('div', { class: 'bh-bottom' });
    this.b.endBtn = h('button', { class: `btn red end-btn ${v.mode === 'attack' ? '' : 'invisible'}`, onclick: () => this.game.endBattleEarly() }, v.mode === 'attack' && !sim.started ? 'Return Home' : 'End Battle');
    bottom.append(this.b.endBtn);
    if (v.mode === 'attack') {
      const tb = h('div', { class: 'troop-bar' });
      this.b.troopCards = {};
      const types = TROOP_ORDER.filter((t) => (sim.army[t] || 0) > 0 || (sim.deployed[t] || 0) > 0);
      if (!types.length) tb.append(h('div', { class: 'troop-empty' }, 'No troops! Train some in your Barracks.'));
      for (const t of types) {
        const count = h('div', { class: 'tc-count' });
        const card = h(
          'button',
          { class: `troop-card ${v.selectedTroop === t ? 'sel' : ''}`, onclick: () => { v.selectedTroop = t; this.refresh(); } },
          h('img', { src: troopPortrait(t), alt: TROOPS[t].name, draggable: 'false' }),
          count,
          h('div', { class: 'tc-lvl' }, String(this.state.research.levels[t] || 1)),
        );
        this.b.troopCards[t] = { card, count };
        tb.append(card);
      }
      bottom.append(tb);
      this.b.nextBtn = h('button', { class: 'btn yellow next-btn', onclick: () => this.game.nextMatch() }, 'Next ', costEl(matchCost(this.state)));
      bottom.append(this.b.nextBtn);
    } else {
      bottom.append(h('button', { class: 'btn yellow next-btn', onclick: () => { v.speed = 8; this.b.speed.textContent = '8x'; } }, svg('skip'), ' Fast Forward'));
    }
    this.b.lootGain = h('div', { class: 'bh-gain' });
    el.append(bottom, this.b.lootGain);
    this.updateBattleHud();
  }

  updateBattleHud() {
    const v = this.game.view;
    if (!v?.sim || !this.b) return;
    const sim = v.sim;
    if (v.mode === 'attack') {
      const got = sim.loot;
      const av = this.b.availTotal;
      this.b.lootGold.textContent = fmtNum(Math.max(0, av.gold - got.gold));
      this.b.lootElixir.textContent = fmtNum(Math.max(0, av.elixir - got.elixir));
      for (const [t, c] of Object.entries(this.b.troopCards || {})) {
        const n = sim.army[t] || 0;
        c.count.textContent = `x${n}`;
        c.card.classList.toggle('empty', n === 0);
        c.card.classList.toggle('sel', v.selectedTroop === t);
      }
      this.b.nextBtn.classList.toggle('invisible', sim.started);
      this.b.endBtn.textContent = sim.started ? (sim.ended ? 'Return Home' : 'End Battle') : 'Return Home';
      this.b.lootGain.innerHTML = '';
      if (got.gold + got.elixir > 0) {
        this.b.lootGain.append(h('span', {}, '+', fmtNum(got.gold), icon('gold')), h('span', {}, '+', fmtNum(got.elixir), icon('elixir')));
      }
    } else {
      this.b.lootGain.innerHTML = '';
      const got = sim.loot;
      if (got.gold + got.elixir > 0) this.b.lootGain.append(h('span', { class: 'lost' }, '-', fmtNum(got.gold), icon('gold')), h('span', { class: 'lost' }, '-', fmtNum(got.elixir), icon('elixir')));
    }
    if (!sim.started) {
      this.b.timerLabel.textContent = 'Battle starts in:';
      this.b.timer.textContent = fmtClock(v.scoutLeft);
    } else {
      this.b.timerLabel.textContent = 'Battle ends in:';
      this.b.timer.textContent = fmtClock(sim.timeLeft);
    }
    this.b.timer.classList.toggle('urgent', sim.started && sim.timeLeft < 30);
    this.b.stars.innerHTML = '';
    this.b.stars.append(stars(sim.stars(), 3, 'bh-stars'));
    this.b.destr.textContent = `${sim.destruction()}% damage`;
  }

  // ---------- toasts ----------
  renderMute() {
    this.muteBtn.replaceChildren(svg(sound.settings.muted ? 'mute' : 'speaker'));
  }

  toast(msg, kind = 'info', secs = 2.6) {
    if (kind === 'warn') sound.play('error');
    const t = h('div', { class: `toast ${kind}` }, msg);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), secs * 1000);
    setTimeout(() => t.remove(), secs * 1000 + 400);
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
    if (!m) {
      root.innerHTML = '';
      root.classList.remove('open');
      return;
    }
    const prevBody = root.querySelector('.modal-body');
    const scroll = !fresh && prevBody ? prevBody.scrollTop : 0;
    const body = h('div', { class: 'modal-body' }, m.render());
    if (!fresh && prevBody && prevBody.innerHTML === body.innerHTML) {
      const t = root.querySelector('.modal-title');
      const title = typeof m.title === 'function' ? m.title() : m.title;
      if (t && t.textContent !== title) t.textContent = title;
      return;
    }
    root.innerHTML = '';
    root.classList.add('open');
    const box = h(
      'div',
      { class: `modal ${m.wide ? 'wide' : ''} ${m.cls || ''}`, onclick: (e) => e.stopPropagation() },
      h('div', { class: 'modal-head' }, h('div', { class: 'modal-title' }, typeof m.title === 'function' ? m.title() : m.title), m.noClose ? null : h('button', { class: 'modal-x', 'data-sfx': 'none', onclick: () => this.closeModal() }, svg('cancel'))),
      body,
    );
    root.append(h('div', { class: 'modal-backdrop', onclick: () => !m.noClose && this.closeModal() }), box);
    body.scrollTop = scroll;
  }

  closeModal() {
    const m = this.modal;
    if (m) sound.play('close');
    this.modal = null;
    this.renderModal();
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

