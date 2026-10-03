// Procedural enemy villages for multiplayer-style raids.

import { BUILDINGS, GRID, BUILD_MARGIN } from '../data/buildings.js';
import { TROOPS, TROOP_ORDER } from '../data/troops.js';
import { ENEMY_NAMES } from '../data/names.js';
import { makeRng } from '../util/rng.js';

function maxLevelAt(type, th) {
  const lv = BUILDINGS[type].levels;
  let m = 0;
  for (let i = 0; i < lv.length; i++) if (lv[i].th <= th) m = i + 1;
  return m;
}

function makeOcc() {
  return new Uint8Array(GRID * GRID);
}

function fits(occ, x, y, size, pad) {
  for (let yy = y - pad; yy < y + size + pad; yy++) {
    for (let xx = x - pad; xx < x + size + pad; xx++) {
      if (xx < BUILD_MARGIN || yy < BUILD_MARGIN || xx >= GRID - BUILD_MARGIN || yy >= GRID - BUILD_MARGIN) return false;
      if (occ[yy * GRID + xx]) return false;
    }
  }
  return true;
}

function mark(occ, x, y, size) {
  for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) occ[yy * GRID + xx] = 1;
}

export function generateEnemy(th, seed = Date.now()) {
  const rng = makeRng(seed);
  const occ = makeOcc();
  const buildings = [];
  let id = 1;
  const c = GRID / 2;

  const lvlFor = (type) => {
    const max = maxLevelAt(type, th);
    if (max <= 0) return 0;
    return Math.max(1, max - (rng() < 0.5 ? 0 : rng() < 0.7 ? 1 : 2));
  };
  const add = (type, level, x, y) => {
    const b = { id: id++, type, level, x, y };
    buildings.push(b);
    mark(occ, x, y, BUILDINGS[type].size);
    return b;
  };
  const placeNear = (type, level, rMin, rMax, pad = 1) => {
    const size = BUILDINGS[type].size;
    for (let r = rMin; r <= rMax; r += 0.5) {
      for (let k = 0; k < 24; k++) {
        const a = rng() * Math.PI * 2;
        const x = Math.round(c + Math.cos(a) * r - size / 2);
        const y = Math.round(c + Math.sin(a) * r - size / 2);
        if (fits(occ, x, y, size, pad)) return add(type, level, x, y);
      }
    }
    return null;
  };
  const countFor = (type) => {
    const max = BUILDINGS[type].maxCount[th - 1] || 0;
    return Math.max(0, max - (rng() < 0.25 ? 1 : 0));
  };

  // Town hall at the center
  const thSize = BUILDINGS.townhall.size;
  add('townhall', th, c - thSize / 2, c - thSize / 2);

  // Core: defenses and storages
  const core = [];
  for (const type of ['goldstorage', 'elixirstorage', 'mortar', 'wizardtower', 'airdefense', 'archertower', 'cannon']) {
    const n = type === 'cannon' || type === 'archertower' ? BUILDINGS[type].maxCount[th - 1] : countFor(type);
    for (let i = 0; i < n; i++) {
      const lvl = lvlFor(type);
      if (lvl > 0) core.push([type, lvl]);
    }
  }
  core.sort(() => rng() - 0.5);
  for (const [type, lvl] of core) placeNear(type, lvl, 3.5, 12);

  // Walls ring around the core
  let minX = GRID, minY = GRID, maxX = 0, maxY = 0;
  for (const b of buildings) {
    const s = BUILDINGS[b.type].size;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + s - 1);
    maxY = Math.max(maxY, b.y + s - 1);
  }
  let wallBudget = BUILDINGS.wall.maxCount[th - 1];
  const wallLvl = lvlFor('wall');
  const ring = (x0, y0, x1, y1) => {
    const tiles = [];
    for (let x = x0; x <= x1; x++) tiles.push([x, y0], [x, y1]);
    for (let y = y0 + 1; y < y1; y++) tiles.push([x0, y], [x1, y]);
    return tiles;
  };
  const outer = ring(minX - 1, minY - 1, maxX + 1, maxY + 1);
  const placeRing = (tiles) => {
    for (const [x, y] of tiles) {
      if (wallBudget <= 0) break;
      if (x < BUILD_MARGIN || y < BUILD_MARGIN || x >= GRID - BUILD_MARGIN || y >= GRID - BUILD_MARGIN) continue;
      if (occ[y * GRID + x]) continue;
      add('wall', wallLvl, x, y);
      wallBudget--;
    }
  };
  // inner ring around the town hall for bigger bases
  if (th >= 3 && wallBudget > outer.length + 24) {
    const t = buildings[0];
    const inner = ring(t.x - 1, t.y - 1, t.x + thSize, t.y + thSize).filter(([x, y]) => !occ[y * GRID + x]);
    placeRing(inner);
  }
  if (wallBudget >= outer.length * 0.8) placeRing(outer);
  // mark the space just outside the wall so outer buildings leave a gap
  for (const [x, y] of ring(minX - 2, minY - 2, maxX + 2, maxY + 2)) {
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) occ[y * GRID + x] = occ[y * GRID + x] || 2;
  }

  // Outer ring: economy and army
  const outerTypes = [];
  for (const type of ['goldmine', 'elixircollector', 'armycamp', 'barracks', 'laboratory', 'builderhut', 'house']) {
    const n = countFor(type);
    for (let i = 0; i < n; i++) {
      const lvl = type === 'builderhut' ? 1 : lvlFor(type);
      if (lvl > 0) outerTypes.push([type, lvl]);
    }
  }
  outerTypes.sort(() => rng() - 0.5);
  for (const [type, lvl] of outerTypes) {
    const r0 = Math.max(maxX - minX, maxY - minY) / 2 + 3;
    placeNear(type, lvl, r0, 20, 0);
  }

  // Leftover walls: short segments in front of outer buildings
  if (wallBudget > 0) {
    for (const b of buildings.filter((b) => b.type === 'goldmine' || b.type === 'elixircollector')) {
      if (wallBudget <= 0) break;
      const s = BUILDINGS[b.type].size;
      placeRing(ring(b.x - 1, b.y - 1, b.x + s, b.y + s).filter(() => rng() < 0.5));
    }
  }

  // Loot
  let lootGold = 0, lootElixir = 0;
  for (const b of buildings) {
    const d = BUILDINGS[b.type];
    const lv = d.levels[b.level - 1];
    let gold = 0, elixir = 0;
    if (d.storage) {
      const fill = rng.range(0.35, 0.95) * lv.cap * 0.22;
      if (d.storage === 'gold') gold = fill;
      else elixir = fill;
    } else if (d.resource) {
      const fill = rng.range(0.3, 1) * lv.cap * 0.5;
      if (d.resource === 'gold') gold = fill;
      else elixir = fill;
    } else if (b.type === 'townhall') {
      gold = rng.range(0.4, 1) * lv.storeGold * 0.22;
      elixir = rng.range(0.4, 1) * lv.storeElixir * 0.22;
    }
    if (gold || elixir) {
      b.loot = { gold: Math.floor(gold), elixir: Math.floor(elixir) };
      lootGold += b.loot.gold;
      lootElixir += b.loot.elixir;
    }
  }

  const name = rng.pick(ENEMY_NAMES);
  const trophies = Math.max(0, Math.round(th * 120 + rng.range(-80, 80)));
  return {
    name,
    th,
    trophies,
    buildings,
    loot: { gold: lootGold, elixir: lootElixir },
    seed,
  };
}

// Army an AI raider brings when attacking the player.
export function generateRaidArmy(th, rng) {
  const housing = [10, 18, 30, 45, 65, 90][th - 1] || 20;
  const barracksLvl = Math.min(8, th + 1);
  const pool = TROOP_ORDER.filter((t) => TROOPS[t].unlock <= barracksLvl && TROOPS[t].housing <= housing / 3);
  const army = {};
  let used = 0;
  let guard = 200;
  while (used < housing && guard-- > 0) {
    const t = rng.pick(pool);
    const h = TROOPS[t].housing;
    if (used + h > housing) continue;
    army[t] = (army[t] || 0) + 1;
    used += h;
  }
  const levels = {};
  for (const t of TROOP_ORDER) levels[t] = Math.max(1, Math.min(6, Math.ceil(th / 1.5)));
  return { army, levels };
}

// Build a deployment schedule along one or two edges of the map.
export function planRaid(army, rng) {
  const plan = [];
  const side = rng.int(0, 3);
  const edgePoint = (s, k) => {
    const m = 0.8 + rng() * 0.6;
    const along = 6 + k * (GRID - 12);
    if (s === 0) return [along, m];
    if (s === 1) return [GRID - m, along];
    if (s === 2) return [along, GRID - m];
    return [m, along];
  };
  // tanks first, then the rest in waves
  const order = Object.entries(army).sort((a, b) => TROOPS[b[0]].hp[0] - TROOPS[a[0]].hp[0]);
  let t = 1;
  for (const [type, count] of order) {
    const center = rng.range(0.25, 0.75);
    for (let i = 0; i < count; i++) {
      const s = rng() < 0.8 ? side : (side + 1) % 4;
      const k = Math.min(1, Math.max(0, center + rng.range(-0.18, 0.18)));
      const [x, y] = edgePoint(s, k);
      plan.push({ t, type, x, y });
      t += 0.12;
    }
    t += 1.5;
  }
  return plan;
}
