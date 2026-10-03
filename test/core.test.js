import { describe, it, expect } from 'vitest';
import { newState, tickState, applyOffline } from '../src/core/state.js';
import {
  storageCap, placeNew, startUpgrade, collect, canPlace, thLevel, freeBuilders, buildSpeed,
} from '../src/core/economy.js';
import { assignVillager, openJobs } from '../src/core/villagers.js';
import { queueTroop, startResearch } from '../src/core/army.js';
import { findMatch, makeAttackSim, applyAttackResult, createRaid, makeDefenseSim, applyDefenseResult } from '../src/core/raids.js';
import { generateEnemy } from '../src/battle/enemyGen.js';
import { BattleSim } from '../src/battle/sim.js';
import { BUILDINGS } from '../src/data/buildings.js';

describe('village economy', () => {
  it('creates a valid starting village with no overlaps', () => {
    const s = newState(42);
    expect(thLevel(s)).toBe(1);
    for (const b of s.buildings) expect(canPlace(s, b.type, b.x, b.y, b.id)).toBe(true);
    expect(storageCap(s).gold).toBe(1000);
    expect(s.villagers.length).toBe(3);
  });

  it('produces resources and collects them', () => {
    const s = newState(1);
    const mine = s.buildings.find((b) => b.type === 'goldmine');
    s.resources.gold = 0;
    tickState(s, 60);
    expect(mine.stored).toBeGreaterThan(20); // worker bonus applies
    const got = collect(s, mine.id);
    expect(got).toBeGreaterThan(20);
    expect(s.resources.gold).toBe(got);
  });

  it('builds and upgrades with builders', () => {
    const s = newState(2);
    s.resources.gold = 1000;
    s.resources.elixir = 1000;
    const r = placeNew(s, 'goldstorage', 30, 30);
    expect(r.ok).toBe(true);
    expect(r.building.level).toBe(0);
    expect(freeBuilders(s)).toBe(1);
    applyOffline(s, 20);
    expect(r.building.level).toBe(1);
    expect(storageCap(s).gold).toBe(2500);
    s.resources.elixir = 1000;
    const up = startUpgrade(s, r.building.id);
    expect(up.ok).toBe(true);
  });

  it('assigns villagers and masons speed up construction', () => {
    const s = newState(3);
    const v = s.villagers[2];
    const jobs = openJobs(s, v);
    const hut = jobs.find((j) => j.building.type === 'builderhut');
    expect(hut).toBeTruthy();
    expect(assignVillager(s, v.id, hut.building.id).ok).toBe(true);
    expect(buildSpeed(s)).toBeGreaterThan(1);
  });

  it('trains troops and researches', () => {
    const s = newState(4);
    s.resources.elixir = 1000;
    expect(queueTroop(s, 'barbarian').ok).toBe(true);
    tickState(s, 10);
    expect(s.army.troops.barbarian).toBe(6);
    expect(startResearch(s, 'barbarian').ok).toBe(false); // no lab yet
  });
});

describe('battle', () => {
  it('generates enemy bases for all town hall levels', () => {
    for (let th = 1; th <= 6; th++) {
      const e = generateEnemy(th, 100 + th);
      expect(e.buildings.find((b) => b.type === 'townhall')).toBeTruthy();
      // no overlaps
      const seen = new Set();
      for (const b of e.buildings) {
        const s = BUILDINGS[b.type].size;
        for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) {
          const k = `${x},${y}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
      expect(e.loot.gold).toBeGreaterThan(0);
    }
  });

  it('a big army destroys a small base', () => {
    const e = generateEnemy(1, 7);
    const sim = new BattleSim({ buildings: e.buildings, army: { barbarian: 30, archer: 20, giant: 4 }, levels: {} });
    let placed = 0;
    for (const t of ['giant', 'barbarian', 'archer']) {
      while (sim.remaining(t) > 0) {
        const x = 3 + (placed % 38), y = 1.5;
        sim.deploy(t, x, y);
        placed++;
      }
    }
    const res = sim.runToEnd();
    expect(res.destruction).toBeGreaterThan(50);
    expect(res.stars).toBeGreaterThanOrEqual(1);
    expect(res.loot.gold).toBeGreaterThan(0);
  });

  it('rejects deployment inside the red zone', () => {
    const e = generateEnemy(2, 9);
    const sim = new BattleSim({ buildings: e.buildings, army: { barbarian: 1 }, levels: {} });
    const th = e.buildings[0];
    expect(sim.deploy('barbarian', th.x + 1, th.y + 1)).toBeNull();
    expect(sim.deploy('barbarian', 0.5, 0.5)).not.toBeNull();
  });

  it('runs attack and defense flows end to end', () => {
    const s = newState(5);
    s.army.troops = { barbarian: 20, archer: 10 };
    const enemy = findMatch(s, 11);
    const sim = makeAttackSim(s, enemy);
    for (let i = 0; i < 30; i++) sim.deploy(i < 20 ? 'barbarian' : 'archer', 2 + i, 0.5);
    const res = sim.runToEnd();
    const applied = applyAttackResult(s, enemy, res);
    expect(s.army.troops.barbarian || 0).toBe(0);
    expect(typeof applied.trophies).toBe('number');

    const raid = createRaid(s, 12);
    const dsim = makeDefenseSim(s, raid);
    dsim.runToEnd();
    const goldBefore = s.resources.gold;
    const d = applyDefenseResult(s, raid, dsim);
    expect(d.destruction).toBeGreaterThanOrEqual(0);
    expect(s.resources.gold).toBeLessThanOrEqual(goldBefore);
    expect(s.log.length).toBe(2);
  });
});
