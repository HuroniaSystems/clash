// Villagers: generation, experience, job assignment.

import { BUILDINGS } from '../data/buildings.js';
import { VILLAGER_NAMES, VILLAGER_TITLES, SKILLS } from '../data/names.js';
import { findBuilding, housingCap, isActive, workerSlots, workersAt } from './economy.js';

export const MAX_VILLAGER_LEVEL = 10;
export const VILLAGER_ARRIVAL = 45; // seconds between arrivals when there is room

const SKIN = ['#f5d0a9', '#e8b48a', '#c98e62', '#a86b45', '#7d4a2c', '#f1c27d'];
const SHIRTS = ['#d64545', '#3f7fd6', '#4caf50', '#e0a030', '#8e5cc4', '#2fa6a0', '#e07040', '#c0c0c0', '#6d8b3a'];
const PANTS = ['#5a3d22', '#3b3b55', '#4a4a4a', '#6b4f2a', '#2e4a3a'];
const HAIR = ['#2b1d12', '#5a3a1a', '#a0522d', '#e2b85c', '#888888', '#c45a2a', '#111111'];

export function xpForLevel(level) {
  return Math.round(40 * Math.pow(level, 1.6));
}

export function createVillager(state, rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const used = new Set(state.villagers.map((v) => v.name));
  let name = pick(VILLAGER_NAMES);
  for (let i = 0; i < 10 && used.has(name); i++) name = pick(VILLAGER_NAMES);
  if (used.has(name)) name = `${name} ${pick(VILLAGER_TITLES)}`;
  return {
    id: state.nextId++,
    name,
    level: 1,
    xp: 0,
    skill: pick(Object.keys(SKILLS)),
    job: null,
    look: { skin: pick(SKIN), shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIR), hairStyle: Math.floor(rng() * 3) },
    joined: Date.now(),
  };
}

export function jobFor(b) {
  return BUILDINGS[b.type].job || null;
}

export function villagerJobText(state, v) {
  if (!v.job) return 'Idle';
  const b = findBuilding(state, v.job);
  if (!b) return 'Idle';
  return `${jobFor(b).role} at ${BUILDINGS[b.type].name}`;
}

export function assignVillager(state, vid, bid) {
  const v = state.villagers.find((x) => x.id === vid);
  if (!v) return { ok: false, reason: 'Missing villager' };
  if (bid == null) {
    v.job = null;
    return { ok: true };
  }
  const b = findBuilding(state, bid);
  if (!b || !jobFor(b)) return { ok: false, reason: 'No jobs at this building' };
  if (b.level < 1) return { ok: false, reason: 'Still under construction' };
  const here = workersAt(state, bid).filter((x) => x.id !== vid);
  if (here.length >= workerSlots(b)) return { ok: false, reason: 'No free slots' };
  v.job = bid;
  return { ok: true };
}

// Buildings with open job slots, best matches for this villager first.
export function openJobs(state, v) {
  const out = [];
  for (const b of state.buildings) {
    const j = jobFor(b);
    if (!j || b.level < 1) continue;
    const used = workersAt(state, b.id).filter((x) => x.id !== v.id).length;
    const slots = workerSlots(b);
    if (used >= slots) continue;
    out.push({ building: b, job: j, used, slots, match: j.skill === v.skill });
  }
  out.sort((a, b) => (b.match - a.match) || (a.building.type < b.building.type ? -1 : 1));
  return out;
}

export function tickVillagers(state, dt, events, rng = Math.random) {
  for (const v of state.villagers) {
    if (!v.job) continue;
    const b = findBuilding(state, v.job);
    if (!b) {
      v.job = null;
      continue;
    }
    if (!isActive(b) || v.level >= MAX_VILLAGER_LEVEL) continue;
    const j = jobFor(b);
    const gain = dt * (1 + 0.1 * b.level) * (j && j.skill === v.skill ? 1.25 : 1);
    v.xp += gain;
    while (v.level < MAX_VILLAGER_LEVEL && v.xp >= xpForLevel(v.level)) {
      v.xp -= xpForLevel(v.level);
      v.level++;
      events.push({ type: 'villagerLevel', villager: v });
    }
    if (v.level >= MAX_VILLAGER_LEVEL) v.xp = 0;
  }

  state.villagerTimer = (state.villagerTimer ?? VILLAGER_ARRIVAL) - dt;
  if (state.villagerTimer <= 0) {
    state.villagerTimer = VILLAGER_ARRIVAL;
    if (state.villagers.length < housingCap(state)) {
      const v = createVillager(state, rng);
      state.villagers.push(v);
      events.push({ type: 'villagerJoined', villager: v });
    }
  }
}
