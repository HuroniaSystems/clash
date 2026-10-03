// Save state: creation, persistence, and the main simulation tick.

import { GRID, OBSTACLES, BUILDINGS } from '../data/buildings.js';
import { makeRng } from '../util/rng.js';
import { tickBuildings, occupancy, inBuildArea } from './economy.js';
import { tickVillagers, createVillager } from './villagers.js';
import { tickArmy, tickResearch, defaultResearch } from './army.js';

export const SAVE_KEY = 'clash-of-villages-save-v1';
export const SAVE_VERSION = 1;
export const RAID_INTERVAL = 8 * 60; // seconds between enemy raids
export const MAX_OFFLINE = 8 * 3600;

export function newState(seed = Date.now()) {
  const rng = makeRng(seed);
  const state = {
    version: SAVE_VERSION,
    name: 'Chief',
    level: 1,
    xp: 0,
    trophies: 0,
    resources: { gold: 1000, elixir: 1000, gems: 250 },
    buildings: [],
    obstacles: [],
    villagers: [],
    army: { troops: { barbarian: 5 }, queue: [] },
    research: defaultResearch(),
    nextId: 1,
    villagerTimer: 20,
    raidTimer: RAID_INTERVAL,
    shield: 0,
    taxAcc: 0,
    log: [],
    stats: { attacks: 0, wins: 0, defenses: 0, defenseWins: 0, goldLooted: 0, elixirLooted: 0 },
    lastSeen: Date.now(),
  };
  const add = (type, x, y, level = 1) => {
    state.buildings.push({ id: state.nextId++, type, level, x, y, stored: 0, upgrade: null });
  };
  add('townhall', 20, 20);
  add('builderhut', 15, 17);
  add('builderhut', 27, 26);
  add('goldmine', 25, 17);
  add('elixircollector', 15, 24);
  add('cannon', 25, 22);
  add('house', 19, 26);
  add('barracks', 15, 20);
  add('armycamp', 12, 27);

  for (let i = 0; i < 3; i++) state.villagers.push(createVillager(state, rng));
  // first villagers get useful jobs straight away
  state.villagers[0].job = state.buildings.find((b) => b.type === 'goldmine').id;
  state.villagers[1].job = state.buildings.find((b) => b.type === 'elixircollector').id;

  scatterObstacles(state, rng, 22);
  return state;
}

export function scatterObstacles(state, rng, count) {
  const types = Object.keys(OBSTACLES);
  const c = GRID / 2;
  let guard = count * 40;
  let placed = 0;
  while (placed < count && guard-- > 0) {
    const type = rng.pick(types);
    const size = OBSTACLES[type].size;
    const x = rng.int(2, GRID - 2 - size);
    const y = rng.int(2, GRID - 2 - size);
    if (Math.hypot(x - c, y - c) < 9) continue;
    if (!inBuildArea(x, y, size)) continue;
    const occ = occupancy(state);
    let free = true;
    for (let yy = y - 1; yy < y + size + 1 && free; yy++) {
      for (let xx = x - 1; xx < x + size + 1; xx++) {
        if (xx >= 0 && yy >= 0 && xx < GRID && yy < GRID && occ[yy * GRID + xx]) {
          free = false;
          break;
        }
      }
    }
    if (!free) continue;
    state.obstacles.push({ id: state.nextId++, type, x, y });
    placed++;
  }
}

export function tickState(state, dt, rng = Math.random) {
  const events = [];
  tickBuildings(state, dt, events);
  tickArmy(state, dt, events);
  tickResearch(state, dt, events);
  tickVillagers(state, dt, events, rng);
  if (state.shield > 0) state.shield = Math.max(0, state.shield - dt);
  return events;
}

// Fast-forward time spent away; returns the events produced.
export function applyOffline(state, seconds) {
  const events = [];
  let left = Math.min(MAX_OFFLINE, Math.max(0, seconds));
  while (left > 0) {
    const step = Math.min(5, left);
    events.push(...tickState(state, step));
    left -= step;
  }
  return events;
}

function migrate(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.buildings)) return null;
  s.resources = { gold: 0, elixir: 0, gems: 0, ...s.resources };
  s.obstacles ||= [];
  s.villagers ||= [];
  s.army ||= { troops: {}, queue: [] };
  s.research ||= defaultResearch();
  s.log ||= [];
  s.stats ||= { attacks: 0, wins: 0, defenses: 0, defenseWins: 0, goldLooted: 0, elixirLooted: 0 };
  s.raidTimer ??= RAID_INTERVAL;
  s.shield ??= 0;
  s.buildings = s.buildings.filter((b) => BUILDINGS[b.type]);
  return s;
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    state.lastSeen = Date.now();
    storage?.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
