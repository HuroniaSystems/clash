// Troop training and laboratory research.

import { TROOPS, TROOP_ORDER } from '../data/troops.js';
import {
  armyCap, canAfford, spend, addResource, isActive, researchSpeed, trainSpeed, gemCostForTime,
} from './economy.js';

export function troopLevel(state, type) {
  return state.research.levels[type] || 1;
}

export function barracksLevel(state) {
  let m = 0;
  for (const b of state.buildings) if (b.type === 'barracks') m = Math.max(m, b.level);
  return m;
}

export function isUnlocked(state, type) {
  return barracksLevel(state) >= TROOPS[type].unlock;
}

export function troopCost(state, type) {
  return { elixir: TROOPS[type].cost[troopLevel(state, type) - 1] };
}

export function armyHousing(state) {
  let n = 0;
  for (const [t, c] of Object.entries(state.army.troops)) n += TROOPS[t].housing * c;
  return n;
}

export function queueHousing(state) {
  let n = 0;
  for (const q of state.army.queue) n += TROOPS[q.type].housing;
  return n;
}

export function trainBlocker(state, type) {
  if (!isUnlocked(state, type)) return `Requires Barracks level ${TROOPS[type].unlock}`;
  if (!state.buildings.some((b) => b.type === 'barracks' && b.level >= 1)) return 'Build a Barracks first';
  if (armyHousing(state) + queueHousing(state) + TROOPS[type].housing > armyCap(state)) return 'Army camps are full';
  if (!canAfford(state, troopCost(state, type))) return 'Not enough elixir';
  return null;
}

export function queueTroop(state, type) {
  const reason = trainBlocker(state, type);
  if (reason) return { ok: false, reason };
  const cost = troopCost(state, type);
  spend(state, cost);
  const time = TROOPS[type].time;
  state.army.queue.push({ type, remaining: time, total: time, cost });
  return { ok: true };
}

export function cancelQueued(state, index) {
  const q = state.army.queue[index];
  if (!q) return false;
  for (const [k, v] of Object.entries(q.cost)) addResource(state, k, v);
  state.army.queue.splice(index, 1);
  return true;
}

export function queueTimeLeft(state) {
  const s = trainSpeed(state);
  const total = state.army.queue.reduce((a, q) => a + q.remaining, 0);
  return s > 0 ? total / s : Infinity;
}

export function finishTrainingWithGems(state, events = []) {
  if (!state.army.queue.length) return false;
  const gems = gemCostForTime(queueTimeLeft(state) === Infinity ? state.army.queue.reduce((a, q) => a + q.remaining, 0) : queueTimeLeft(state));
  if (state.resources.gems < gems) return false;
  state.resources.gems -= gems;
  for (const q of state.army.queue) {
    state.army.troops[q.type] = (state.army.troops[q.type] || 0) + 1;
    events.push({ type: 'trained', troop: q.type });
  }
  state.army.queue = [];
  return true;
}

export function tickArmy(state, dt, events) {
  let budget = dt * trainSpeed(state);
  while (budget > 0 && state.army.queue.length) {
    const q = state.army.queue[0];
    const use = Math.min(budget, q.remaining);
    q.remaining -= use;
    budget -= use;
    if (q.remaining <= 1e-6) {
      state.army.queue.shift();
      state.army.troops[q.type] = (state.army.troops[q.type] || 0) + 1;
      events.push({ type: 'trained', troop: q.type });
    }
  }
}

// ---------- research ----------
export function labLevel(state) {
  const lab = state.buildings.find((b) => b.type === 'laboratory');
  return lab ? lab.level : 0;
}

export function maxResearchLevel(state, type) {
  return Math.min(TROOPS[type].hp.length, labLevel(state) + 1);
}

export function researchCost(state, type) {
  const next = troopLevel(state, type);
  return { elixir: TROOPS[type].research[next] };
}

export function researchBlocker(state, type) {
  const lab = state.buildings.find((b) => b.type === 'laboratory');
  if (!lab || lab.level < 1) return 'Build a Laboratory first';
  if (!isActive(lab)) return 'Laboratory is upgrading';
  if (state.research.current) return 'Research in progress';
  const lvl = troopLevel(state, type);
  if (lvl >= TROOPS[type].hp.length) return 'Max level';
  if (lvl >= maxResearchLevel(state, type)) return 'Upgrade the Laboratory';
  if (!isUnlocked(state, type)) return `Requires Barracks level ${TROOPS[type].unlock}`;
  if (!canAfford(state, researchCost(state, type))) return 'Not enough elixir';
  return null;
}

export function startResearch(state, type) {
  const reason = researchBlocker(state, type);
  if (reason) return { ok: false, reason };
  const cost = researchCost(state, type);
  spend(state, cost);
  const time = TROOPS[type].researchTime[troopLevel(state, type)];
  state.research.current = { type, remaining: time, total: time };
  return { ok: true };
}

export function finishResearchWithGems(state, events = []) {
  const r = state.research.current;
  if (!r) return false;
  const gems = gemCostForTime(r.remaining);
  if (state.resources.gems < gems) return false;
  state.resources.gems -= gems;
  completeResearch(state, events);
  return true;
}

function completeResearch(state, events) {
  const r = state.research.current;
  state.research.levels[r.type] = troopLevel(state, r.type) + 1;
  state.research.current = null;
  events.push({ type: 'researched', troop: r.type, level: state.research.levels[r.type] });
}

export function tickResearch(state, dt, events) {
  const r = state.research.current;
  if (!r) return;
  r.remaining -= dt * researchSpeed(state);
  if (r.remaining <= 0) completeResearch(state, events);
}

export function defaultResearch() {
  const levels = {};
  for (const t of TROOP_ORDER) levels[t] = 1;
  return { levels, current: null };
}
