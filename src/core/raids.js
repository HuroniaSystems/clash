// Glue between the village save state and the battle simulation.

import { BUILDINGS } from '../data/buildings.js';
import { TROOPS } from '../data/troops.js';
import { ENEMY_NAMES } from '../data/names.js';
import { BattleSim } from '../battle/sim.js';
import { generateEnemy, generateRaidArmy, planRaid } from '../battle/enemyGen.js';
import { makeRng } from '../util/rng.js';
import {
  addResource, addXp, defenseMult, levelDef, storageCap, thLevel, troopDamageMult,
} from './economy.js';
import { RAID_INTERVAL } from './state.js';

export function matchCost(state) {
  return { gold: 50 * thLevel(state) * thLevel(state) };
}

export function findMatch(state, seed = Date.now()) {
  const rng = makeRng(seed);
  const th = thLevel(state);
  const roll = rng();
  const enemyTh = Math.max(1, Math.min(6, th + (roll < 0.2 ? -1 : roll > 0.85 ? 1 : 0)));
  const enemy = generateEnemy(enemyTh, seed);
  enemy.trophies = Math.max(0, state.trophies + Math.round(rng.range(-120, 120)));
  const diff = enemy.trophies - state.trophies;
  enemy.trophyWin = Math.max(5, Math.min(40, Math.round(20 + diff / 12)));
  enemy.trophyLose = Math.max(5, Math.min(30, Math.round(15 - diff / 15)));
  return enemy;
}

export function makeAttackSim(state, enemy) {
  return new BattleSim({
    buildings: enemy.buildings,
    army: { ...state.army.troops },
    levels: { ...state.research.levels },
    mods: { troopDmg: troopDamageMult(state) },
    seed: enemy.seed,
  });
}

export function applyAttackResult(state, enemy, result) {
  const gold = addResource(state, 'gold', result.loot.gold);
  const elixir = addResource(state, 'elixir', result.loot.elixir);
  for (const [t, n] of Object.entries(result.used)) {
    state.army.troops[t] = Math.max(0, (state.army.troops[t] || 0) - n);
    if (!state.army.troops[t]) delete state.army.troops[t];
  }
  let trophies;
  if (result.stars > 0) trophies = Math.max(1, Math.round((enemy.trophyWin * result.stars) / 3));
  else trophies = -enemy.trophyLose;
  state.trophies = Math.max(0, state.trophies + trophies);
  const gems = result.stars === 3 ? 5 : 0;
  state.resources.gems += gems;
  const events = [];
  addXp(state, result.stars * 3 + 1, events);
  state.stats.attacks++;
  if (result.stars > 0) state.stats.wins++;
  state.stats.goldLooted += gold;
  state.stats.elixirLooted += elixir;
  state.log.unshift({
    kind: 'attack',
    time: Date.now(),
    name: enemy.name,
    stars: result.stars,
    destruction: result.destruction,
    gold,
    elixir,
    trophies,
  });
  state.log.length = Math.min(state.log.length, 30);
  return { gold, elixir, trophies, gems, wasted: { gold: result.loot.gold - gold, elixir: result.loot.elixir - elixir }, events };
}

// ---------- enemy raids on the player's village ----------
export function playerLayout(state) {
  const cap = storageCap(state);
  const out = [];
  for (const b of state.buildings) {
    if (b.level < 1) continue;
    const d = BUILDINGS[b.type];
    const lv = levelDef(b);
    let loot = null;
    if (b.type === 'townhall') {
      loot = {
        gold: cap.gold ? (state.resources.gold * lv.storeGold) / cap.gold * 0.2 : 0,
        elixir: cap.elixir ? (state.resources.elixir * lv.storeElixir) / cap.elixir * 0.2 : 0,
      };
    } else if (d.storage) {
      const share = cap[d.storage] ? (state.resources[d.storage] * lv.cap) / cap[d.storage] : 0;
      loot = { gold: 0, elixir: 0, [d.storage]: share * 0.2 };
    } else if (d.resource) {
      loot = { gold: 0, elixir: 0, [d.resource]: (b.stored || 0) * 0.5 };
    }
    out.push({ id: b.id, type: b.type, level: b.level, x: b.x, y: b.y, loot, active: !b.upgrade });
  }
  return out;
}

export function createRaid(state, seed = Date.now()) {
  const rng = makeRng(seed);
  const th = thLevel(state);
  const raiderTh = Math.max(1, Math.min(6, th + (rng() < 0.3 ? -1 : 0)));
  const { army, levels } = generateRaidArmy(raiderTh, rng);
  const plan = planRaid(army, rng);
  return { name: rng.pick(ENEMY_NAMES), th: raiderTh, army, levels, plan, seed };
}

export function makeDefenseSim(state, raid) {
  const defense = {};
  for (const b of state.buildings) if (BUILDINGS[b.type].defense) defense[b.id] = defenseMult(state, b);
  return new BattleSim({
    buildings: playerLayout(state),
    army: {},
    levels: raid.levels,
    mods: { defense },
    aiPlan: raid.plan,
    seed: raid.seed,
  });
}

export function applyDefenseResult(state, raid, sim) {
  const result = sim.result();
  let gold = 0, elixir = 0;
  for (const sb of sim.buildings) {
    if (!sb.loot) continue;
    const b = state.buildings.find((x) => x.id === sb.id);
    if (!b) continue;
    const d = BUILDINGS[b.type];
    if (d.resource) {
      const taken = sb.lootGiven[d.resource];
      b.stored = Math.max(0, (b.stored || 0) - taken);
    } else {
      gold += sb.lootGiven.gold;
      elixir += sb.lootGiven.elixir;
    }
  }
  const lostGold = Math.min(state.resources.gold, Math.floor(gold));
  const lostElixir = Math.min(state.resources.elixir, Math.floor(elixir));
  state.resources.gold -= lostGold;
  state.resources.elixir -= lostElixir;
  const totalLost = { gold: Math.floor(result.loot.gold), elixir: Math.floor(result.loot.elixir) };
  const won = result.stars === 0;
  const trophies = won ? 8 : -(6 + result.stars * 4);
  state.trophies = Math.max(0, state.trophies + trophies);
  state.stats.defenses++;
  if (won) state.stats.defenseWins++;
  state.shield = result.destruction >= 40 ? RAID_INTERVAL * 1.5 : 0;
  state.raidTimer = RAID_INTERVAL + state.shield;
  state.log.unshift({
    kind: 'defense',
    time: Date.now(),
    name: raid.name,
    stars: result.stars,
    destruction: result.destruction,
    gold: totalLost.gold,
    elixir: totalLost.elixir,
    trophies,
  });
  state.log.length = Math.min(state.log.length, 30);
  return { ...result, lost: totalLost, trophies, won };
}

export function armyPower(army) {
  let n = 0;
  for (const [t, c] of Object.entries(army)) n += TROOPS[t].housing * c;
  return n;
}
