// Village rules: costs, capacities, construction, production. Pure functions over the save state.

import { BUILDINGS, GRID, BUILD_MARGIN, OBSTACLES, MAX_TH } from '../data/buildings.js';

export const getDef = (type) => BUILDINGS[type];
export const levelDef = (b, level = b.level) => BUILDINGS[b.type].levels[Math.max(0, level - 1)];
export const isActive = (b) => b.level >= 1 && !b.upgrade;

export function findBuilding(state, id) {
  return state.buildings.find((b) => b.id === id) || null;
}

export function thLevel(state) {
  const th = state.buildings.find((b) => b.type === 'townhall');
  return th ? Math.max(1, th.level) : 1;
}

export function countOf(state, type) {
  return state.buildings.filter((b) => b.type === type).length;
}

export function maxCount(type, th) {
  return BUILDINGS[type].maxCount[Math.min(MAX_TH, th) - 1] || 0;
}

export function maxLevelAt(type, th) {
  const lv = BUILDINGS[type].levels;
  let m = 0;
  for (let i = 0; i < lv.length; i++) if (lv[i].th <= th) m = i + 1;
  return m;
}

// ---------- capacities ----------
export function storageCap(state) {
  let gold = 0, elixir = 0;
  for (const b of state.buildings) {
    if (b.level < 1) continue;
    const d = BUILDINGS[b.type];
    const lv = levelDef(b);
    if (b.type === 'townhall') {
      gold += lv.storeGold;
      elixir += lv.storeElixir;
    } else if (d.storage === 'gold') gold += lv.cap;
    else if (d.storage === 'elixir') elixir += lv.cap;
  }
  return { gold, elixir };
}

export function housingCap(state) {
  let n = 2;
  for (const b of state.buildings) if (b.type === 'house' && b.level >= 1) n += levelDef(b).housing;
  return n;
}

export function armyCap(state) {
  let n = 0;
  for (const b of state.buildings) if (b.type === 'armycamp' && b.level >= 1) n += levelDef(b).capacity;
  return n;
}

export function buildersTotal(state) {
  return state.buildings.filter((b) => b.type === 'builderhut' && b.level >= 1).length;
}

export function buildersBusy(state) {
  return state.buildings.filter((b) => b.upgrade).length;
}

export function freeBuilders(state) {
  return buildersTotal(state) - buildersBusy(state);
}

// ---------- villagers / jobs ----------
export function workerSlots(b) {
  const j = BUILDINGS[b.type].job;
  if (!j) return 0;
  return Math.min(j.max, 1 + Math.floor((Math.max(1, b.level) - 1) / 2));
}

export function workersAt(state, id) {
  return state.villagers.filter((v) => v.job === id);
}

export function villagerBonus(v, skill) {
  const base = 0.08 + 0.02 * v.level;
  return v.skill === skill ? base * 1.5 : base;
}

export function jobBonus(state, b) {
  if (!isActive(b)) return 0;
  const j = BUILDINGS[b.type].job;
  if (!j) return 0;
  let s = 0;
  for (const v of state.villagers) if (v.job === b.id) s += villagerBonus(v, j.skill);
  return s;
}

export function productionPerSec(state, b) {
  if (!isActive(b)) return 0;
  const lv = levelDef(b);
  if (!lv.rate) return 0;
  return (lv.rate / 60) * (1 + jobBonus(state, b));
}

export function buildSpeed(state) {
  let s = 1;
  for (const b of state.buildings) if (b.type === 'builderhut') s += jobBonus(state, b);
  return s;
}

export function trainSpeed(state) {
  let s = 0;
  for (const b of state.buildings) if (b.type === 'barracks' && isActive(b)) s += 1 + jobBonus(state, b);
  return s;
}

export function researchSpeed(state) {
  const lab = state.buildings.find((b) => b.type === 'laboratory');
  if (!lab || !isActive(lab)) return 0;
  return 1 + jobBonus(state, lab);
}

export function troopDamageMult(state) {
  let s = 0;
  for (const b of state.buildings) if (b.type === 'armycamp') s += jobBonus(state, b);
  return 1 + s * 0.5;
}

export function defenseMult(state, b) {
  return 1 + jobBonus(state, b);
}

export function taxPerSec(state) {
  const th = state.buildings.find((b) => b.type === 'townhall');
  if (!th || !isActive(th)) return 0;
  const bonus = jobBonus(state, th);
  return (levelDef(th).tax / 60) * bonus * 8;
}

// ---------- resources ----------
export function canAfford(state, cost) {
  return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v);
}

export function spend(state, cost) {
  for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
}

export function addResource(state, res, amount) {
  if (res === 'gems') {
    state.resources.gems += amount;
    return amount;
  }
  const cap = storageCap(state)[res];
  const before = state.resources[res];
  state.resources[res] = Math.min(cap, before + amount);
  return Math.max(0, state.resources[res] - before);
}

export function missingFor(state, cost) {
  const out = {};
  for (const [k, v] of Object.entries(cost)) {
    const have = state.resources[k] || 0;
    if (have < v) out[k] = v - have;
  }
  return out;
}

export function gemCostForTime(sec) {
  return Math.max(1, Math.ceil(sec / 20));
}

export function gemCostForResources(missing) {
  let n = 0;
  for (const v of Object.values(missing)) n += Math.ceil(v / 100);
  return n;
}

// ---------- player xp ----------
export function xpForPlayerLevel(level) {
  return 30 + level * 20;
}

export function addXp(state, xp, events) {
  state.xp += xp;
  while (state.xp >= xpForPlayerLevel(state.level)) {
    state.xp -= xpForPlayerLevel(state.level);
    state.level++;
    events?.push({ type: 'playerLevel', level: state.level });
  }
}

// ---------- placement ----------
export function occupancy(state, ignoreId = null) {
  const occ = new Int32Array(GRID * GRID).fill(0);
  const markRect = (x, y, s, v) => {
    for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) if (xx >= 0 && yy >= 0 && xx < GRID && yy < GRID) occ[yy * GRID + xx] = v;
  };
  for (const b of state.buildings) if (b.id !== ignoreId) markRect(b.x, b.y, BUILDINGS[b.type].size, b.id);
  for (const o of state.obstacles) if (o.id !== ignoreId) markRect(o.x, o.y, OBSTACLES[o.type].size, -o.id);
  return occ;
}

export function inBuildArea(x, y, size) {
  return x >= BUILD_MARGIN && y >= BUILD_MARGIN && x + size <= GRID - BUILD_MARGIN && y + size <= GRID - BUILD_MARGIN;
}

export function canPlace(state, type, x, y, ignoreId = null, occ = null) {
  const size = BUILDINGS[type].size;
  if (!inBuildArea(x, y, size)) return false;
  occ = occ || occupancy(state, ignoreId);
  for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) if (occ[yy * GRID + xx]) return false;
  return true;
}

export function buildCost(state, type) {
  const d = BUILDINGS[type];
  if (d.countCost) return { gold: d.countCost[Math.min(d.countCost.length - 1, countOf(state, type))] };
  return { ...d.levels[0].cost };
}

// Why a new building of `type` can't be bought right now (or null).
export function buyBlocker(state, type) {
  const th = thLevel(state);
  const d = BUILDINGS[type];
  if (countOf(state, type) >= maxCount(type, th)) {
    const next = d.maxCount.findIndex((m) => m > countOf(state, type));
    return next >= 0 ? `Requires Town Hall ${next + 1}` : 'Maximum reached';
  }
  if (d.levels[0].th > th) return `Requires Town Hall ${d.levels[0].th}`;
  if (d.levels[0].time > 0 && freeBuilders(state) <= 0) return 'All builders are busy';
  if (!canAfford(state, buildCost(state, type))) return 'Not enough resources';
  return null;
}

export function placeNew(state, type, x, y, events = []) {
  const reason = buyBlocker(state, type);
  if (reason) return { ok: false, reason };
  if (!canPlace(state, type, x, y)) return { ok: false, reason: 'Cannot place there' };
  const cost = buildCost(state, type);
  spend(state, cost);
  const time = BUILDINGS[type].levels[0].time;
  const b = { id: state.nextId++, type, level: time > 0 ? 0 : 1, x, y, stored: 0, upgrade: null };
  if (time > 0) b.upgrade = { to: 1, remaining: time, total: time, cost };
  else addXp(state, 1, events);
  state.buildings.push(b);
  return { ok: true, building: b };
}

export function upgradeBlocker(state, b) {
  const d = BUILDINGS[b.type];
  if (b.upgrade) return 'Already upgrading';
  if (b.level >= d.levels.length) return 'Max level';
  const next = d.levels[b.level];
  if (next.th > thLevel(state)) return `Requires Town Hall ${next.th}`;
  if (b.type === 'laboratory' && state.research.current) return 'Research in progress';
  if (next.time > 0 && freeBuilders(state) <= 0) return 'All builders are busy';
  if (!canAfford(state, next.cost)) return 'Not enough resources';
  return null;
}

export function startUpgrade(state, id, events = []) {
  const b = findBuilding(state, id);
  if (!b) return { ok: false, reason: 'Missing building' };
  const reason = upgradeBlocker(state, b);
  if (reason) return { ok: false, reason };
  const next = BUILDINGS[b.type].levels[b.level];
  spend(state, next.cost);
  if (next.time > 0) {
    b.upgrade = { to: b.level + 1, remaining: next.time, total: next.time, cost: { ...next.cost } };
  } else {
    b.level++;
    addXp(state, 1, events);
    events.push({ type: 'built', building: b });
  }
  return { ok: true };
}

export function cancelUpgrade(state, id) {
  const b = findBuilding(state, id);
  if (!b || !b.upgrade) return false;
  for (const [k, v] of Object.entries(b.upgrade.cost || {})) addResource(state, k, Math.floor(v / 2));
  if (b.level === 0) {
    state.buildings = state.buildings.filter((x) => x.id !== id);
    for (const v of state.villagers) if (v.job === id) v.job = null;
  } else b.upgrade = null;
  return true;
}

export function finishUpgradeWithGems(state, id, events = []) {
  const b = findBuilding(state, id);
  if (!b || !b.upgrade) return false;
  const gems = gemCostForTime(b.upgrade.remaining / buildSpeed(state));
  if (state.resources.gems < gems) return false;
  state.resources.gems -= gems;
  completeUpgrade(state, b, events);
  return true;
}

function completeUpgrade(state, b, events) {
  b.level = b.upgrade.to;
  addXp(state, Math.floor(Math.sqrt(b.upgrade.total)) + 1, events);
  b.upgrade = null;
  events.push({ type: 'built', building: b });
}

export function moveBuilding(state, id, x, y) {
  const b = findBuilding(state, id);
  if (!b || !canPlace(state, b.type, x, y, id)) return false;
  b.x = x;
  b.y = y;
  return true;
}

export function collect(state, id) {
  const b = findBuilding(state, id);
  if (!b) return 0;
  const res = BUILDINGS[b.type].resource;
  if (!res || b.stored < 1) return 0;
  const got = addResource(state, res, Math.floor(b.stored));
  b.stored -= got;
  return got;
}

export function removeObstacle(state, id, rng = Math.random) {
  const o = state.obstacles.find((x) => x.id === id);
  if (!o) return { ok: false, reason: 'Missing' };
  const cost = OBSTACLES[o.type].cost;
  if (!canAfford(state, cost)) return { ok: false, reason: 'Not enough resources' };
  spend(state, cost);
  state.obstacles = state.obstacles.filter((x) => x !== o);
  const gems = 1 + Math.floor(rng() * 5);
  state.resources.gems += gems;
  return { ok: true, gems };
}

// ---------- tick ----------
export function tickBuildings(state, dt, events) {
  const speed = buildSpeed(state);
  for (const b of state.buildings) {
    if (b.upgrade) {
      b.upgrade.remaining -= dt * speed;
      if (b.upgrade.remaining <= 0) completeUpgrade(state, b, events);
    }
    const lv = b.level >= 1 ? levelDef(b) : null;
    if (lv && lv.rate && !b.upgrade) {
      b.stored = Math.min(lv.cap, (b.stored || 0) + productionPerSec(state, b) * dt);
    }
  }
  const tax = taxPerSec(state) * dt;
  if (tax > 0) {
    state.taxAcc = (state.taxAcc || 0) + tax;
    if (state.taxAcc >= 1) {
      const whole = Math.floor(state.taxAcc);
      addResource(state, 'gold', whole);
      state.taxAcc -= whole;
    }
  }
}
