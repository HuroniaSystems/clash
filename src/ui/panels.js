// Modal panel definitions. Each returns { title, render, live?, wide? }.

import { BUILDINGS, SHOP_CATEGORIES } from '../data/buildings.js';
import { TROOPS, TROOP_ORDER } from '../data/troops.js';
import { SKILLS } from '../data/names.js';
import * as eco from '../core/economy.js';
import * as army from '../core/army.js';
import { openJobs, villagerJobText, xpForLevel, MAX_VILLAGER_LEVEL, VILLAGER_ARRIVAL } from '../core/villagers.js';
import { matchCost } from '../core/raids.js';
import { fmtNum, fmtTime } from '../util/format.js';
import { buildingPortrait, troopPortrait } from '../render/portraits.js';
import { h, icon, costEl, bar, svg, stars, avatar, timeAgo } from './dom.js';

export const skillName = (s) => SKILLS[s] || s;
export const jobText = (state, v) => villagerJobText(state, v);
const pct = (f) => `${Math.round(f * 100)}%`;

// ---------- shop ----------
export function shopPanel(ui) {
  let tab = ui.shopTab || 'economy';
  const panel = {
    title: 'Shop',
    wide: true,
    live: true,
    render() {
      const s = ui.state;
      const th = eco.thLevel(s);
      const tabs = h(
        'div',
        { class: 'tabs' },
        SHOP_CATEGORIES.map((c) => h('button', { class: `tab ${tab === c.id ? 'on' : ''}`, onclick: () => { tab = ui.shopTab = c.id; ui.renderModal(); } }, c.name)),
      );
      const cat = SHOP_CATEGORIES.find((c) => c.id === tab);
      const grid = h('div', { class: 'card-grid' });
      for (const type of cat.types) {
        const d = BUILDINGS[type];
        const count = eco.countOf(s, type);
        const max = eco.maxCount(type, th);
        const blocker = eco.buyBlocker(s, type);
        const locked = max === 0 || (blocker && blocker.startsWith('Requires')) || (blocker === 'Maximum reached');
        const time = d.levels[0].time;
        grid.append(
          h(
            'button',
            { class: `card shop-card ${blocker ? 'dim' : ''} ${locked ? 'locked' : ''}`, onclick: () => (blocker ? ui.toast(blocker, 'warn') : ui.game.startBuy(type)) },
            h('div', { class: 'card-name' }, d.name),
            h('img', { class: 'card-img', src: buildingPortrait(type, 1), alt: d.name, draggable: 'false' }),
            h('div', { class: 'card-meta' }, h('span', {}, `Built: ${count}/${max}`), h('span', {}, time ? fmtTime(time) : 'Instant')),
            locked ? h('div', { class: 'card-lock' }, blocker) : costEl(eco.buildCost(s, type), s),
          ),
        );
      }
      return h('div', {}, tabs, grid);
    },
  };
  return panel;
}

// ---------- building info / upgrade ----------
function statRows(b, level) {
  const d = BUILDINGS[b.type];
  const lv = d.levels[level - 1];
  if (!lv) return [];
  const rows = [['Hitpoints', fmtNum(lv.hp)]];
  if (lv.rate) rows.push(['Production', `${fmtNum(lv.rate)} / min`], ['Capacity', fmtNum(lv.cap)]);
  if (d.storage) rows.push(['Storage', fmtNum(lv.cap)]);
  if (b.type === 'townhall') rows.push(['Gold storage', fmtNum(lv.storeGold)], ['Elixir storage', fmtNum(lv.storeElixir)]);
  if (lv.housing) rows.push(['Villager housing', lv.housing]);
  if (lv.capacity) rows.push(['Troop capacity', lv.capacity]);
  if (lv.dps) rows.push(['Damage / sec', lv.dps]);
  if (d.job) rows.push(['Job slots', Math.min(d.job.max, 1 + Math.floor((level - 1) / 2))]);
  return rows;
}

export function infoPanel(ui, id, focusUpgrade = false) {
  return {
    title: () => {
      const b = eco.findBuilding(ui.state, id);
      return b ? `${BUILDINGS[b.type].name} (Level ${b.level})` : 'Building';
    },
    live: true,
    render() {
      const s = ui.state;
      const b = eco.findBuilding(s, id);
      if (!b) return h('div', {}, 'Gone.');
      const d = BUILDINGS[b.type];
      const cur = statRows(b, Math.max(1, b.level));
      const nextLevel = b.level + 1;
      const hasNext = nextLevel <= d.levels.length && !b.upgrade;
      const nxt = hasNext ? statRows(b, nextLevel) : [];
      const table = h(
        'table',
        { class: 'stats' },
        hasNext ? h('tr', { class: 'stats-head' }, h('td', {}), h('td', {}, `Level ${Math.max(1, b.level)}`), h('td', {}, `Level ${nextLevel}`)) : null,
        cur.map(([k, v], i) => {
          const nv = nxt[i]?.[1];
          return h('tr', {}, h('td', {}, k), h('td', {}, String(v)), hasNext ? h('td', { class: nv !== v ? 'up' : '' }, nv !== v ? String(nv) : '') : null);
        }),
      );
      const extra = [];
      if (d.defense) {
        const D = d.defense;
        extra.push(
          h('div', { class: 'tags' },
            h('span', { class: 'tag' }, `Range ${D.minRange ? `${D.minRange}-` : ''}${D.range} tiles`),
            h('span', { class: 'tag' }, `Targets: ${[D.ground && 'Ground', D.air && 'Air'].filter(Boolean).join(' & ')}`),
            D.splash ? h('span', { class: 'tag' }, 'Splash damage') : null,
            h('span', { class: 'tag' }, `Defending bonus +${pct(eco.jobBonus(s, b))}`)),
        );
      }
      if (d.resource && b.level >= 1) {
        extra.push(h('div', { class: 'info-line' }, `Producing ${fmtNum(eco.productionPerSec(s, b) * 60)} ${d.resource} per minute (workers +${pct(eco.jobBonus(s, b))})`));
        extra.push(h('div', { class: 'info-line' }, `Stored: ${fmtNum(b.stored || 0)} / ${fmtNum(eco.levelDef(b).cap)}`));
      }
      if (d.job) {
        const w = eco.workersAt(s, b.id);
        extra.push(
          h('div', { class: 'info-job' },
            h('b', {}, `${d.job.role}s: ${w.length}/${eco.workerSlots(b)}`),
            h('span', {}, ` ${d.job.effect}. Best skill: ${skillName(d.job.skill)}.`),
            h('button', { class: 'btn small', onclick: () => ui.openModal(workersPanel(ui, b.id)) }, 'Manage workers')),
        );
      }
      let up = null;
      if (b.upgrade) {
        const left = b.upgrade.remaining / eco.buildSpeed(s);
        up = h('div', { class: 'upgrade-box' },
          h('div', {}, `Upgrading to level ${b.upgrade.to}: ${fmtTime(left)} left`),
          bar(1 - b.upgrade.remaining / b.upgrade.total, 'progress'),
          h('button', { class: 'btn gem', onclick: () => ui.game.finishNow(b.id) }, 'Finish now ', fmtNum(eco.gemCostForTime(left)), icon('gems')));
      } else if (b.level < d.levels.length) {
        const next = d.levels[b.level];
        const blocker = eco.upgradeBlocker(s, b);
        up = h('div', { class: `upgrade-box ${focusUpgrade ? 'focus' : ''}` },
          h('div', { class: 'upgrade-line' }, `Upgrade to level ${b.level + 1}`, h('span', { class: 'muted' }, ` (${next.time ? fmtTime(next.time) : 'instant'})`)),
          blocker ? h('div', { class: 'blocker' }, blocker) : null,
          h('button', { class: `btn green ${blocker ? 'dim' : ''}`, onclick: () => (blocker ? ui.toast(blocker, 'warn') : ui.game.upgrade(b.id)) }, 'Upgrade ', costEl(next.cost, s)));
      } else {
        up = h('div', { class: 'upgrade-box' }, h('b', {}, 'Maximum level reached'));
      }
      return h('div', { class: 'info' },
        h('div', { class: 'info-top' },
          h('img', { class: 'info-img', src: buildingPortrait(b.type, Math.max(1, b.level)), alt: d.name }),
          h('div', {}, h('p', { class: 'desc' }, d.desc), table)),
        extra, up);
    },
  };
}

// ---------- workers ----------
export function workersPanel(ui, id) {
  return {
    title: () => {
      const b = eco.findBuilding(ui.state, id);
      return b ? `${BUILDINGS[b.type].name} workers` : 'Workers';
    },
    live: true,
    wide: true,
    render() {
      const s = ui.state;
      const b = eco.findBuilding(s, id);
      if (!b) return h('div', {}, 'Gone.');
      const job = BUILDINGS[b.type].job;
      const here = eco.workersAt(s, id);
      const slots = eco.workerSlots(b);
      const assigned = h('div', { class: 'slot-row' });
      for (let i = 0; i < slots; i++) {
        const v = here[i];
        if (v) {
          assigned.append(h('div', { class: 'slot filled' },
            avatar(v.look, 44),
            h('div', { class: 'slot-name' }, v.name),
            h('div', { class: 'slot-sub' }, `Lv ${v.level} ${skillName(v.skill)}`),
            h('div', { class: 'slot-bonus' }, `+${pct(eco.villagerBonus(v, job.skill))}`),
            h('button', { class: 'btn small red', onclick: () => ui.game.assign(v.id, null) }, 'Remove')));
        } else assigned.append(h('div', { class: 'slot empty' }, h('div', { class: 'slot-plus' }, '+'), h('div', { class: 'slot-sub' }, 'Open slot')));
      }
      const full = here.length >= slots;
      const others = s.villagers.filter((v) => v.job !== id);
      others.sort((a, c) => (c.skill === job.skill) - (a.skill === job.skill) || (!!a.job - !!c.job) || c.level - a.level);
      const list = h('div', { class: 'vlist' },
        others.length ? null : h('div', { class: 'muted' }, 'No other villagers. Build Houses to attract more.'),
        others.map((v) => h('div', { class: 'vrow' },
          avatar(v.look, 38),
          h('div', { class: 'vrow-main' },
            h('div', { class: 'vrow-name' }, v.name, h('span', { class: 'lvl-pill' }, `Lv ${v.level}`), v.skill === job.skill ? h('span', { class: 'match' }, 'Skill match') : null),
            h('div', { class: 'vrow-sub' }, `${skillName(v.skill)} - ${jobText(s, v)}`)),
          h('div', { class: 'vrow-bonus' }, `+${pct(eco.villagerBonus(v, job.skill))}`),
          h('button', { class: `btn small green ${full ? 'dim' : ''}`, onclick: () => (full ? ui.toast('No free slots. Upgrade the building for more.', 'warn') : ui.game.assign(v.id, id)) }, 'Assign'))));
      return h('div', {},
        h('div', { class: 'job-head' }, h('b', {}, job.role), ` - ${job.effect}. Current bonus: `, h('b', {}, `+${pct(eco.jobBonus(s, b))}`)),
        assigned,
        h('div', { class: 'section-title' }, 'Available villagers'),
        list);
    },
  };
}

// ---------- villagers ----------
export function villagersPanel(ui) {
  return {
    title: 'Villagers',
    live: true,
    wide: true,
    render() {
      const s = ui.state;
      const cap = eco.housingCap(s);
      const head = h('div', { class: 'vill-head' },
        h('div', {}, h('b', {}, `${s.villagers.length}/${cap}`), ' villagers. ',
          s.villagers.length < cap ? `Next arrival in ${fmtTime(s.villagerTimer ?? VILLAGER_ARRIVAL)}.` : 'Build or upgrade Houses to attract more villagers.'),
        h('div', { class: 'muted' }, 'Villagers gain experience while working. Higher levels and matching skills give bigger bonuses.'));
      const list = h('div', { class: 'vlist' },
        s.villagers.map((v) => {
          const xpNeed = xpForLevel(v.level);
          return h('div', { class: 'vrow' },
            avatar(v.look, 42),
            h('div', { class: 'vrow-main' },
              h('div', { class: 'vrow-name' }, v.name, h('span', { class: 'lvl-pill' }, `Lv ${v.level}`), h('span', { class: 'skill' }, skillName(v.skill))),
              h('div', { class: 'vrow-sub' }, jobText(s, v)),
              bar(v.level >= MAX_VILLAGER_LEVEL ? 1 : v.xp / xpNeed, 'xp'),
              h('div', { class: 'vrow-xp' }, v.level >= MAX_VILLAGER_LEVEL ? 'Max level' : `${Math.floor(v.xp)}/${xpNeed} xp`)),
            h('div', { class: 'vrow-btns' },
              h('button', { class: 'btn small green', onclick: () => ui.openModal(jobPickerPanel(ui, v.id, () => ui.openModal(villagersPanel(ui)))) }, 'Assign'),
              h('button', { class: 'btn small', onclick: () => ui.game.focusVillager(v.id) }, svg('locate'))));
        }));
      return h('div', {}, head, list);
    },
  };
}

export function jobPickerPanel(ui, vid, back = null) {
  return {
    title: () => `Assign ${ui.state.villagers.find((v) => v.id === vid)?.name || ''}`,
    live: true,
    wide: true,
    render() {
      const s = ui.state;
      const v = s.villagers.find((x) => x.id === vid);
      if (!v) return h('div', {}, 'Gone.');
      const jobs = openJobs(s, v);
      const done = () => (back ? back() : ui.closeModal());
      return h('div', {},
        h('div', { class: 'job-head' }, `${v.name} is a level ${v.level} ${skillName(v.skill)} specialist. Currently: ${jobText(s, v)}.`),
        v.job ? h('button', { class: 'btn small red', onclick: () => { ui.game.assign(v.id, null); done(); } }, 'Make idle') : null,
        h('div', { class: 'vlist' },
          jobs.length ? null : h('div', { class: 'muted' }, 'No open jobs. Build or upgrade buildings to create more job slots.'),
          jobs.map((j) => h('div', { class: 'vrow' },
            h('img', { class: 'row-img', src: buildingPortrait(j.building.type, j.building.level), alt: '' }),
            h('div', { class: 'vrow-main' },
              h('div', { class: 'vrow-name' }, `${j.job.role}`, h('span', { class: 'muted' }, ` at ${BUILDINGS[j.building.type].name} (Lv ${j.building.level})`), j.match ? h('span', { class: 'match' }, 'Skill match') : null),
              h('div', { class: 'vrow-sub' }, `${j.job.effect} - slots ${j.used}/${j.slots}`)),
            h('div', { class: 'vrow-bonus' }, `+${pct(eco.villagerBonus(v, j.job.skill))}`),
            h('button', { class: 'btn small green', onclick: () => { if (ui.game.assign(v.id, j.building.id)) done(); } }, 'Assign')))));
    },
  };
}

// ---------- army / training ----------
export function armyPanel(ui) {
  return {
    title: 'Army',
    live: true,
    wide: true,
    render() {
      const s = ui.state;
      const cap = eco.armyCap(s);
      const used = army.armyHousing(s);
      const queued = army.queueHousing(s);
      const head = h('div', { class: 'army-head' },
        h('div', {}, h('b', {}, `Troops: ${used}/${cap}`), queued ? h('span', { class: 'muted' }, ` (+${queued} training)`) : null),
        bar(cap ? used / cap : 0, 'army'),
        h('div', { class: 'muted' }, `Training speed x${eco.trainSpeed(s).toFixed(2)} (Barracks and Drill Sergeants). Captains boost damage by +${pct(eco.troopDamageMult(s) - 1)}.`));
      const current = h('div', { class: 'mini-row' },
        Object.entries(s.army.troops).filter(([, n]) => n > 0).map(([t, n]) => h('div', { class: 'mini' }, h('img', { src: troopPortrait(t), alt: '' }), h('span', {}, `x${n}`))),
        Object.keys(s.army.troops).length ? null : h('div', { class: 'muted' }, 'No troops yet.'));
      let queue = null;
      if (s.army.queue.length) {
        const groups = [];
        s.army.queue.forEach((q, i) => {
          const g = groups[groups.length - 1];
          if (g && g.type === q.type) {
            g.count++;
            g.last = i;
          } else groups.push({ type: q.type, count: 1, first: i, last: i });
        });
        const left = army.queueTimeLeft(s);
        queue = h('div', { class: 'queue' },
          h('div', { class: 'section-title' }, `Training (${left === Infinity ? 'paused - barracks busy' : fmtTime(left)})`),
          h('div', { class: 'mini-row' },
            groups.map((g, gi) => h('div', { class: `mini q ${gi === 0 ? 'active' : ''}` },
              h('img', { src: troopPortrait(g.type), alt: '' }),
              h('span', {}, `x${g.count}`),
              gi === 0 ? bar(1 - s.army.queue[0].remaining / s.army.queue[0].total, 'progress') : null,
              h('button', { class: 'mini-x', onclick: () => ui.game.cancelTrain(g.last) }, svg('cancel')))),
            left !== Infinity ? h('button', { class: 'btn gem small', onclick: () => ui.game.finishTrain() }, 'Finish ', fmtNum(eco.gemCostForTime(left)), icon('gems')) : null));
      }
      const grid = h('div', { class: 'card-grid troops' });
      for (const t of TROOP_ORDER) {
        const T = TROOPS[t];
        const blocker = army.trainBlocker(s, t);
        const locked = !army.isUnlocked(s, t);
        grid.append(h('button', { class: `card troop ${blocker ? 'dim' : ''} ${locked ? 'locked' : ''}`, onclick: () => ui.game.train(t) },
          h('div', { class: 'card-name' }, T.name, h('span', { class: 'lvl-pill' }, `Lv ${army.troopLevel(s, t)}`)),
          h('img', { class: 'card-img', src: troopPortrait(t), alt: T.name, draggable: 'false' }),
          h('div', { class: 'card-meta' }, h('span', {}, `Space ${T.housing}`), h('span', {}, fmtTime(T.time))),
          locked ? h('div', { class: 'card-lock' }, `Barracks Lv ${T.unlock}`) : costEl(army.troopCost(s, t), s)));
      }
      return h('div', {}, head, current, queue, h('div', { class: 'section-title' }, 'Train troops'), grid);
    },
  };
}

// ---------- laboratory ----------
export function labPanel(ui) {
  return {
    title: 'Laboratory',
    live: true,
    wide: true,
    render() {
      const s = ui.state;
      const r = s.research.current;
      let cur = null;
      if (r) {
        const speed = eco.researchSpeed(s) || 1;
        const left = r.remaining / speed;
        cur = h('div', { class: 'upgrade-box' },
          h('div', {}, `Researching ${TROOPS[r.type].name} level ${army.troopLevel(s, r.type) + 1}: ${fmtTime(left)} left`),
          bar(1 - r.remaining / r.total, 'progress'),
          h('button', { class: 'btn gem small', onclick: () => ui.game.finishResearch() }, 'Finish now ', fmtNum(eco.gemCostForTime(left)), icon('gems')));
      }
      const grid = h('div', { class: 'card-grid troops' });
      for (const t of TROOP_ORDER) {
        const T = TROOPS[t];
        const lvl = army.troopLevel(s, t);
        const blocker = army.researchBlocker(s, t);
        const maxed = lvl >= T.hp.length;
        grid.append(h('button', { class: `card troop ${blocker ? 'dim' : ''}`, onclick: () => (blocker ? ui.toast(blocker, 'warn') : ui.game.research(t)) },
          h('div', { class: 'card-name' }, T.name),
          h('img', { class: 'card-img', src: troopPortrait(t), alt: T.name, draggable: 'false' }),
          h('div', { class: 'card-meta' }, h('span', {}, maxed ? `Lv ${lvl} (max)` : `Lv ${lvl} > ${lvl + 1}`), maxed ? null : h('span', {}, fmtTime(T.researchTime[lvl]))),
          h('div', { class: 'card-stats' }, `HP ${T.hp[lvl - 1]}${maxed ? '' : ` > ${T.hp[lvl]}`}  DPS ${T.dps[lvl - 1]}${maxed ? '' : ` > ${T.dps[lvl]}`}`),
          maxed ? h('div', { class: 'card-lock' }, 'Maxed') : blocker && blocker !== 'Not enough elixir' ? h('div', { class: 'card-lock' }, blocker) : costEl(army.researchCost(s, t), s)));
      }
      return h('div', {}, h('div', { class: 'muted' }, `Laboratory level ${army.labLevel(s)} can research troops up to level ${army.labLevel(s) + 1}. Scholars speed up research.`), cur, grid);
    },
  };
}

// ---------- attack ----------
export function attackPanel(ui) {
  return {
    title: 'Attack',
    live: true,
    render() {
      const s = ui.state;
      const cost = matchCost(s);
      const housing = army.armyHousing(s);
      const troops = Object.entries(s.army.troops).filter(([, n]) => n > 0);
      return h('div', { class: 'attack' },
        h('div', { class: 'attack-card' },
          h('div', { class: 'attack-title' }, 'Multiplayer raid'),
          h('p', { class: 'muted' }, 'Find a rival village, scout its defenses and deploy your troops at the edges. Destroy 50% for a star, the Town Hall for another, and everything for the third.'),
          h('div', { class: 'mini-row' }, troops.map(([t, n]) => h('div', { class: 'mini' }, h('img', { src: troopPortrait(t), alt: '' }), h('span', {}, `x${n}`))), troops.length ? null : h('div', { class: 'muted' }, 'You have no troops.')),
          h('div', { class: 'muted' }, `Army: ${housing}/${eco.armyCap(s)}`),
          h('button', { class: `btn big yellow ${housing ? '' : 'dim'}`, onclick: () => ui.game.findMatch() }, 'Find a Match ', costEl(cost, s))),
        h('div', { class: 'attack-side' },
          h('button', { class: 'btn', onclick: () => ui.openModal(armyPanel(ui)) }, 'Train troops'),
          h('button', { class: 'btn', onclick: () => ui.openModal(logPanel(ui)) }, 'Battle log')));
    },
  };
}

export function logPanel(ui) {
  return {
    title: 'Battle Log',
    live: true,
    render() {
      const s = ui.state;
      const st = s.stats;
      return h('div', {},
        h('div', { class: 'tags' },
          h('span', { class: 'tag' }, `Attacks won ${st.wins}/${st.attacks}`),
          h('span', { class: 'tag' }, `Defenses won ${st.defenseWins}/${st.defenses}`),
          h('span', { class: 'tag' }, `Looted ${fmtNum(st.goldLooted)} gold, ${fmtNum(st.elixirLooted)} elixir`)),
        h('div', { class: 'vlist' },
          s.log.length ? null : h('div', { class: 'muted' }, 'No battles yet.'),
          s.log.map((e) => h('div', { class: `log-row ${e.kind}` },
            h('div', { class: 'log-kind' }, e.kind === 'attack' ? 'Attack' : 'Defense'),
            h('div', { class: 'vrow-main' },
              h('div', { class: 'vrow-name' }, e.name, h('span', { class: 'muted' }, ` ${timeAgo(e.time)}`)),
              h('div', { class: 'vrow-sub' }, `${e.destruction}% destroyed - `, e.kind === 'attack' ? 'won ' : 'lost ', fmtNum(e.gold), icon('gold'), ' ', fmtNum(e.elixir), icon('elixir'))),
            stars(e.stars),
            h('div', { class: `log-trophy ${e.trophies >= 0 ? 'up' : 'down'}` }, `${e.trophies >= 0 ? '+' : ''}${e.trophies}`, icon('trophy'))))));
    },
  };
}

// ---------- results ----------
export function resultPanel(ui, r, onDone) {
  const win = r.mode === 'attack' ? r.stars > 0 : r.won;
  return {
    title: r.mode === 'attack' ? (win ? 'Victory!' : 'Defeat') : win ? 'Defense Successful!' : 'Village Raided',
    cls: `result ${win ? 'win' : 'lose'}`,
    noClose: true,
    onClose: onDone,
    render() {
      const rows = [];
      rows.push(stars(r.stars, 3, 'big-stars'));
      rows.push(h('div', { class: 'result-destr' }, `${r.destruction}% destruction`));
      if (r.mode === 'attack') {
        rows.push(h('div', { class: 'result-loot' }, h('span', {}, '+', fmtNum(r.gold), icon('gold')), h('span', {}, '+', fmtNum(r.elixir), icon('elixir')), r.gems ? h('span', {}, '+', r.gems, icon('gems')) : null));
        if (r.wasted && r.wasted.gold + r.wasted.elixir > 0) rows.push(h('div', { class: 'muted' }, 'Some loot was lost because your storages are full.'));
        const used = Object.entries(r.used || {}).filter(([, n]) => n > 0);
        rows.push(h('div', { class: 'section-title' }, 'Troops used'));
        rows.push(h('div', { class: 'mini-row center' }, used.map(([t, n]) => h('div', { class: 'mini' }, h('img', { src: troopPortrait(t), alt: '' }), h('span', {}, `x${n}`))), used.length ? null : h('div', { class: 'muted' }, 'None')));
      } else {
        rows.push(h('div', { class: 'result-loot' }, h('span', { class: 'lost' }, '-', fmtNum(r.lost.gold), icon('gold')), h('span', { class: 'lost' }, '-', fmtNum(r.lost.elixir), icon('elixir'))));
        if (ui.state.shield > 0) rows.push(h('div', { class: 'muted' }, `You received a shield for ${fmtTime(ui.state.shield)}.`));
      }
      rows.push(h('div', { class: `result-trophy ${r.trophies >= 0 ? 'up' : 'down'}` }, `${r.trophies >= 0 ? '+' : ''}${r.trophies}`, icon('trophy', 'big')));
      rows.push(h('button', { class: 'btn big green', onclick: () => ui.closeModal() }, 'Return Home'));
      return h('div', { class: 'result-body' }, rows);
    },
  };
}

export function welcomePanel(ui, info) {
  return {
    title: 'Welcome back, Chief!',
    render() {
      const lines = [h('p', {}, `You were away for ${fmtTime(info.away)}. Your village kept working:`)];
      const items = [];
      if (info.built) items.push(`${info.built} construction${info.built > 1 ? 's' : ''} finished`);
      if (info.trained) items.push(`${info.trained} troops trained`);
      if (info.joined) items.push(`${info.joined} new villager${info.joined > 1 ? 's' : ''} arrived`);
      items.push('Mines and collectors filled up - tap the bubbles to collect');
      lines.push(h('ul', {}, items.map((t) => h('li', {}, t))));
      if (info.raid) {
        const r = info.raid;
        lines.push(h('div', { class: `upgrade-box ${r.won ? '' : 'bad'}` },
          h('b', {}, r.won ? `${r.name} attacked and failed!` : `${r.name} raided your village`),
          stars(r.stars),
          h('div', {}, `${r.destruction}% destroyed. Lost `, fmtNum(r.lost.gold), icon('gold'), ' ', fmtNum(r.lost.elixir), icon('elixir'), ` (${r.trophies >= 0 ? '+' : ''}${r.trophies} trophies)`)));
      }
      lines.push(h('button', { class: 'btn green', onclick: () => ui.closeModal() }, 'Okay'));
      return h('div', { class: 'welcome' }, lines);
    },
  };
}

// ---------- settings ----------
function helpList() {
  return h('ul', { class: 'help' },
    h('li', {}, 'Drag to pan, scroll or pinch to zoom.'),
    h('li', {}, 'Tap buildings for actions: upgrade, move, collect, manage workers.'),
    h('li', {}, 'Villagers arrive when you have free housing. Assign them jobs - matching skills give bigger bonuses, and they level up while working.'),
    h('li', {}, 'Train troops at the Barracks, upgrade them in the Laboratory, then Attack rival villages for loot and trophies.'),
    h('li', {}, 'In battle, pick a troop and tap (or hold) outside the red zone to deploy.'),
    h('li', {}, 'From Town Hall 2, raiders attack your village. Defenses with Gunners and Lookouts hit harder.'));
}

export function introPanel(ui) {
  return {
    title: 'Welcome, Chief!',
    render() {
      return h('div', { class: 'welcome' },
        h('p', {}, 'Your village is small, but it has a Town Hall, a few loyal villagers and big ambitions. Here is how it works:'),
        helpList(),
        h('button', { class: 'btn green', onclick: () => ui.closeModal() }, "Let's build!"));
    },
  };
}

export function settingsPanel(ui) {
  return {
    title: 'Settings',
    render() {
      const s = ui.state;
      const input = h('input', { class: 'text-input', value: s.name, maxlength: '16' });
      return h('div', { class: 'settings' },
        h('div', { class: 'section-title' }, 'Chief name'),
        h('div', { class: 'row-btns' }, input, h('button', { class: 'btn green', onclick: () => { ui.game.rename(input.value); ui.toast('Name saved', 'good'); } }, 'Save')),
        h('div', { class: 'section-title' }, 'How to play'),
        helpList(),
        h('div', { class: 'section-title' }, 'Danger zone'),
        h('button', { class: 'btn red', onclick: () => ui.confirm('Start over? Your whole village will be lost.', () => ui.game.resetGame()) }, 'Reset village'));
    },
  };
}
