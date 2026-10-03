// Deterministic-ish battle simulation, independent of rendering.
// Coordinates are in tile units: tile (x, y) spans [x, x+1) x [y, y+1).

import { BUILDINGS, GRID, isDefense, isResourceBuilding } from '../data/buildings.js';
import { TROOPS } from '../data/troops.js';
import { PathGrid } from './pathfinding.js';
import { makeRng } from '../util/rng.js';

export const SIM_DT = 1 / 30;
export const BATTLE_TIME = 180;
const HITBOX_INSET = 0.2;
const AIR_HEIGHT = { balloon: 2.6, dragon: 3.2 };
const PROJ_SPEED = { ball: 14, arrow: 18, rocket: 12, orb: 10, fireball: 10, bomb: 0 };

export function distToRect(px, py, b) {
  const x0 = b.x + HITBOX_INSET, y0 = b.y + HITBOX_INSET;
  const x1 = b.x + b.size - HITBOX_INSET, y1 = b.y + b.size - HITBOX_INSET;
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

export class BattleSim {
  /**
   * @param {object} o
   * @param {Array} o.buildings  [{id,type,level,x,y,loot?,active?}]
   * @param {object} o.army      {troopType: count}
   * @param {object} o.levels    {troopType: level}
   * @param {object} [o.mods]    {troopDmg, troopHp, defense: {buildingId: mult}}
   * @param {Array}  [o.aiPlan]  [{t, type, x, y}] scripted deployments (defense mode)
   */
  constructor({ buildings, army, levels = {}, mods = {}, aiPlan = null, seed = 1 }) {
    this.rng = makeRng(seed);
    this.time = 0;
    this.started = false;
    this.ended = false;
    this.timeLeft = BATTLE_TIME;
    this.levels = levels;
    this.mods = { troopDmg: 1, troopHp: 1, defense: {}, ...mods };
    this.army = { ...army };
    this.deployed = {};
    this.loot = { gold: 0, elixir: 0 };
    this.events = [];
    this.troops = [];
    this.projectiles = [];
    this.nextId = 1;
    this.aiPlan = aiPlan ? [...aiPlan].sort((a, b) => a.t - b.t) : null;

    this.grid = new PathGrid(GRID, GRID);
    this.wallAt = new Int32Array(GRID * GRID).fill(-1);
    this.noDeploy = new Uint8Array(GRID * GRID);

    this.buildings = buildings
      .filter((b) => b.level >= 1)
      .map((b, i) => {
        const d = BUILDINGS[b.type];
        const lv = d.levels[b.level - 1];
        return {
          idx: i,
          id: b.id,
          type: b.type,
          level: b.level,
          x: b.x,
          y: b.y,
          size: d.size,
          cx: b.x + d.size / 2,
          cy: b.y + d.size / 2,
          hp: lv.hp,
          maxHp: lv.hp,
          isWall: b.type === 'wall',
          isDefense: isDefense(b.type),
          isResource: isResourceBuilding(b.type),
          isTownHall: b.type === 'townhall',
          defense: d.defense || null,
          dps: lv.dps || 0,
          dmgMult: this.mods.defense[b.id] ?? 1,
          active: b.active !== false,
          cooldown: 0.5,
          target: null,
          aim: Math.PI * 0.25,
          destroyed: false,
          loot: b.loot ? { gold: b.loot.gold || 0, elixir: b.loot.elixir || 0 } : null,
          lootGiven: { gold: 0, elixir: 0 },
          lastHit: -10,
        };
      });
    this.byId = new Map(this.buildings.map((b) => [b.id, b]));

    for (const b of this.buildings) {
      for (let y = b.y; y < b.y + b.size; y++) {
        for (let x = b.x; x < b.x + b.size; x++) {
          const i = y * GRID + x;
          if (b.isWall) {
            this.wallAt[i] = b.idx;
            this.grid.extra[i] = 4 + b.hp / 60;
          } else {
            this.grid.blocked[i] = 1;
          }
        }
      }
      for (let y = b.y - 1; y < b.y + b.size + 1; y++) {
        for (let x = b.x - 1; x < b.x + b.size + 1; x++) {
          if (x >= 0 && y >= 0 && x < GRID && y < GRID) this.noDeploy[y * GRID + x] = 1;
        }
      }
    }
    this.totalCountable = this.buildings.filter((b) => !b.isWall).length;
    this.destroyedCount = 0;
    this.thDestroyed = false;
    if (this.aiPlan) this.started = true;
  }

  // ---------- queries ----------
  canDeploy(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) return false;
    return !this.noDeploy[ty * GRID + tx];
  }

  remaining(type) {
    return this.army[type] || 0;
  }

  totalRemaining() {
    let n = 0;
    for (const k in this.army) n += this.army[k];
    return n;
  }

  destruction() {
    if (!this.totalCountable) return 100;
    return Math.floor((this.destroyedCount / this.totalCountable) * 100);
  }

  stars() {
    const d = this.destruction();
    return (d >= 50 ? 1 : 0) + (this.thDestroyed ? 1 : 0) + (d >= 100 ? 1 : 0);
  }

  result() {
    return {
      stars: this.stars(),
      destruction: this.destruction(),
      loot: { gold: Math.floor(this.loot.gold), elixir: Math.floor(this.loot.elixir) },
      used: { ...this.deployed },
      remaining: { ...this.army },
      thDestroyed: this.thDestroyed,
    };
  }

  totalLootAvailable() {
    let gold = 0, elixir = 0;
    for (const b of this.buildings) {
      if (!b.loot) continue;
      gold += b.loot.gold;
      elixir += b.loot.elixir;
    }
    return { gold: Math.floor(gold), elixir: Math.floor(elixir) };
  }

  // ---------- actions ----------
  start() {
    this.started = true;
  }

  deploy(type, x, y, force = false) {
    if (this.ended) return null;
    if (!force && (!this.army[type] || !this.canDeploy(x, y))) return null;
    if (!force) this.army[type]--;
    this.deployed[type] = (this.deployed[type] || 0) + 1;
    this.started = true;
    return this.spawnTroop(type, x, y);
  }

  spawnTroop(type, x, y) {
    const T = TROOPS[type];
    const lvl = Math.min(T.hp.length, Math.max(1, this.levels[type] || 1));
    const hp = T.hp[lvl - 1] * this.mods.troopHp;
    const t = {
      id: this.nextId++,
      type,
      level: lvl,
      x,
      y,
      z: AIR_HEIGHT[type] || 0,
      hp,
      maxHp: hp,
      air: !!T.air,
      speed: T.speed,
      range: T.range,
      dps: T.dps[lvl - 1] * this.mods.troopDmg,
      cooldown: this.rng() * 0.4,
      target: null,
      wallBlock: null,
      path: null,
      pathIdx: 0,
      jx: (this.rng() - 0.5) * 0.5,
      jy: (this.rng() - 0.5) * 0.5,
      facing: 0,
      moving: false,
      attacking: false,
      attackPulse: 0,
      dead: false,
      lastHit: -10,
    };
    this.troops.push(t);
    this.events.push({ type: 'deploy', troop: t });
    return t;
  }

  // ---------- stepping ----------
  step(dt = SIM_DT) {
    if (this.ended) return;
    this.time += dt;
    if (this.aiPlan) {
      while (this.aiPlan.length && this.aiPlan[0].t <= this.time) {
        const p = this.aiPlan.shift();
        this.deploy(p.type, p.x, p.y, true);
      }
    }
    for (const t of this.troops) if (!t.dead) this.updateTroop(t, dt);
    for (const b of this.buildings) if (b.isDefense && !b.destroyed && b.active) this.updateDefense(b, dt);
    this.updateProjectiles(dt);
    if (this.troops.some((t) => t.dead)) this.troops = this.troops.filter((t) => !t.dead);

    if (this.started) this.timeLeft -= dt;
    const allDestroyed = this.destroyedCount >= this.totalCountable;
    const outOfTroops =
      this.started &&
      this.troops.length === 0 &&
      this.totalRemaining() === 0 &&
      (!this.aiPlan || this.aiPlan.length === 0) &&
      !this.projectiles.some((p) => p.side === 'att');
    if (allDestroyed || outOfTroops || this.timeLeft <= 0) this.end();
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.events.push({ type: 'end', result: this.result() });
  }

  // ---------- troops ----------
  pickTarget(t) {
    const pref = TROOPS[t.type].target;
    let pool;
    if (pref === 'wall') pool = this.buildings.filter((b) => !b.destroyed && b.isWall);
    else if (pref === 'defense') pool = this.buildings.filter((b) => !b.destroyed && b.isDefense);
    else if (pref === 'resource') pool = this.buildings.filter((b) => !b.destroyed && b.isResource);
    if (!pool || pool.length === 0) pool = this.buildings.filter((b) => !b.destroyed && !b.isWall);
    let best = null, bestD = Infinity;
    for (const b of pool) {
      const d = distToRect(t.x, t.y, b);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  computePath(t) {
    const b = t.target;
    const range = t.range;
    const isGoal = (x, y) => distToRect(x + 0.5, y + 0.5, b) <= range;
    const h = (x, y) => Math.max(0, distToRect(x + 0.5, y + 0.5, b) - range);
    // let the target's own tiles be walkable for the search's goal test only
    t.path = this.grid.findPath(Math.floor(t.x), Math.floor(t.y), isGoal, h) || [];
    t.pathIdx = 0;
  }

  updateTroop(t, dt) {
    t.cooldown -= dt;
    t.attackPulse = Math.max(0, t.attackPulse - dt * 4);
    if (!t.target || t.target.destroyed) {
      t.target = this.pickTarget(t);
      t.path = null;
      t.wallBlock = null;
      if (!t.target) {
        t.moving = false;
        t.attacking = false;
        return;
      }
    }
    if (t.wallBlock && t.wallBlock.destroyed) t.wallBlock = null;

    if (t.wallBlock) return this.troopAttack(t, t.wallBlock);
    if (distToRect(t.x, t.y, t.target) <= t.range) return this.troopAttack(t, t.target);

    t.attacking = false;
    t.moving = true;
    const step = t.speed * dt;
    if (t.air) {
      this.moveToward(t, t.target.cx, t.target.cy, step);
      return;
    }
    if (!t.path) this.computePath(t);
    if (t.pathIdx >= t.path.length) {
      // end of path (or no path): walk straight at the target
      this.moveToward(t, t.target.cx, t.target.cy, step);
      return;
    }
    const [nx, ny] = t.path[t.pathIdx];
    const wi = this.wallAt[ny * GRID + nx];
    if (wi >= 0) {
      const w = this.buildings[wi];
      if (!w.destroyed) {
        t.wallBlock = w;
        return this.troopAttack(t, w);
      }
    }
    const last = t.pathIdx === t.path.length - 1;
    const px = nx + 0.5 + (last ? t.jx : t.jx * 0.4);
    const py = ny + 0.5 + (last ? t.jy : t.jy * 0.4);
    if (this.moveToward(t, px, py, step)) t.pathIdx++;
  }

  moveToward(t, px, py, step) {
    const dx = px - t.x, dy = py - t.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-4) t.facing = Math.atan2(dy, dx);
    if (d <= step) {
      t.x = px;
      t.y = py;
      return true;
    }
    t.x += (dx / d) * step;
    t.y += (dy / d) * step;
    return false;
  }

  troopAttack(t, b) {
    const T = TROOPS[t.type];
    t.moving = false;
    t.attacking = true;
    t.facing = Math.atan2(b.cy - t.y, b.cx - t.x);
    if (t.cooldown > 0) return;
    t.cooldown = T.attackSpeed;
    t.attackPulse = 1;
    const dmg = t.dps * T.attackSpeed;
    if (T.suicide) {
      this.splashBuildings(t.x, t.y, T.splash, dmg, T);
      this.events.push({ type: 'explode', x: t.x, y: t.y, z: 0.3, size: T.splash });
      this.killTroop(t);
      return;
    }
    if (T.projectile) {
      const kind = T.projectile;
      this.projectiles.push({
        id: this.nextId++,
        side: 'att',
        kind,
        x: t.x,
        y: t.y,
        z: t.z + 0.6,
        sx: t.x,
        sy: t.y,
        sz: t.z + 0.6,
        tx: b.cx,
        ty: b.cy,
        target: b,
        t: 0,
        dur: kind === 'bomb' ? 0.55 : 0,
        speed: PROJ_SPEED[kind] || 10,
        dmg,
        splash: T.splash || 0,
        troopType: t.type,
      });
      this.events.push({ type: 'troopFire', troop: t, kind });
      return;
    }
    this.damageBuilding(b, dmg * this.multFor(T, b), t);
    this.events.push({ type: 'melee', troop: t, x: t.x + Math.cos(t.facing) * 0.4, y: t.y + Math.sin(t.facing) * 0.4 });
  }

  multFor(T, b) {
    let m = 1;
    if (T.resourceMult && b.isResource) m *= T.resourceMult;
    if (T.wallMult && b.isWall) m *= T.wallMult;
    return m;
  }

  splashBuildings(x, y, radius, dmg, T) {
    for (const b of this.buildings) {
      if (b.destroyed) continue;
      if (distToRect(x, y, b) <= radius) this.damageBuilding(b, dmg * this.multFor(T, b));
    }
  }

  damageBuilding(b, dmg) {
    if (b.destroyed || dmg <= 0) return;
    const before = b.hp;
    b.hp = Math.max(0, b.hp - dmg);
    b.lastHit = this.time;
    if (b.loot) {
      const frac = b.hp <= 0 ? 1 : (b.maxHp - b.hp) / b.maxHp;
      for (const r of ['gold', 'elixir']) {
        const owed = b.loot[r] * frac - b.lootGiven[r];
        if (owed > 0) {
          b.lootGiven[r] += owed;
          this.loot[r] += owed;
        }
      }
      if (before > b.hp) this.events.push({ type: 'loot', building: b });
    }
    if (b.hp <= 0) this.destroyBuilding(b);
  }

  destroyBuilding(b) {
    b.destroyed = true;
    b.target = null;
    for (let y = b.y; y < b.y + b.size; y++) {
      for (let x = b.x; x < b.x + b.size; x++) {
        const i = y * GRID + x;
        this.grid.blocked[i] = 0;
        this.grid.extra[i] = 0;
        if (b.isWall) this.wallAt[i] = -1;
      }
    }
    if (!b.isWall) this.destroyedCount++;
    if (b.isTownHall) this.thDestroyed = true;
    this.events.push({ type: 'destroyed', building: b });
  }

  killTroop(t) {
    if (t.dead) return;
    t.dead = true;
    t.hp = 0;
    this.events.push({ type: 'troopDied', troop: t });
  }

  // ---------- defenses ----------
  canTarget(b, t) {
    if (t.dead) return false;
    const D = b.defense;
    if (t.air ? !D.air : !D.ground) return false;
    const d = Math.hypot(t.x - b.cx, t.y - b.cy);
    return d <= D.range && d >= D.minRange;
  }

  updateDefense(b, dt) {
    b.cooldown -= dt;
    if (b.target && !this.canTarget(b, b.target)) b.target = null;
    if (!b.target) {
      let best = null, bestD = Infinity;
      for (const t of this.troops) {
        if (!this.canTarget(b, t)) continue;
        const d = Math.hypot(t.x - b.cx, t.y - b.cy);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      b.target = best;
    }
    if (!b.target) return;
    const want = Math.atan2(b.target.y - b.cy, b.target.x - b.cx);
    let diff = want - b.aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    b.aim += Math.max(-dt * 8, Math.min(dt * 8, diff));
    if (b.cooldown > 0) return;
    const D = b.defense;
    b.cooldown = D.speed;
    const dmg = b.dps * D.speed * b.dmgMult;
    const t = b.target;
    const kind = D.projectile;
    const sz = b.type === 'archertower' || b.type === 'wizardtower' ? 2.6 : b.type === 'airdefense' ? 2 : 0.8;
    const p = {
      id: this.nextId++,
      side: 'def',
      kind,
      x: b.cx,
      y: b.cy,
      z: sz,
      sx: b.cx,
      sy: b.cy,
      sz,
      tx: t.x,
      ty: t.y,
      target: kind === 'shell' ? null : t,
      t: 0,
      dur: kind === 'shell' ? 1.4 : 0,
      speed: PROJ_SPEED[kind] || 12,
      dmg,
      splash: D.splash,
      hitsAir: D.air,
      hitsGround: D.ground,
      from: b,
    };
    this.projectiles.push(p);
    this.events.push({ type: 'defFire', building: b, kind });
  }

  // ---------- projectiles ----------
  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.t += dt;
      let arrived = false;
      if (p.dur > 0) {
        const k = Math.min(1, p.t / p.dur);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        arrived = k >= 1;
      } else {
        if (p.target && !(p.target.dead || p.target.destroyed)) {
          p.tx = p.side === 'def' ? p.target.x : p.target.cx;
          p.ty = p.side === 'def' ? p.target.y : p.target.cy;
        }
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        const s = p.speed * dt;
        if (d <= s) {
          p.x = p.tx;
          p.y = p.ty;
          arrived = true;
        } else {
          p.x += (dx / d) * s;
          p.y += (dy / d) * s;
        }
      }
      if (arrived) this.impact(p);
      else keep.push(p);
    }
    this.projectiles = keep;
  }

  impact(p) {
    if (p.side === 'def') {
      if (p.splash > 0) {
        for (const t of this.troops) {
          if (t.dead) continue;
          if (t.air ? !p.hitsAir : !p.hitsGround) continue;
          if (Math.hypot(t.x - p.x, t.y - p.y) <= p.splash) this.damageTroop(t, p.dmg);
        }
        this.events.push({ type: 'explode', x: p.x, y: p.y, z: p.kind === 'shell' ? 0.2 : (p.target?.z || 0) + 0.3, size: p.splash, kind: p.kind });
      } else if (p.target && !p.target.dead) {
        this.damageTroop(p.target, p.dmg);
        this.events.push({ type: 'hit', x: p.x, y: p.y, z: (p.target.z || 0) + 0.4, kind: p.kind });
      }
    } else {
      const T = TROOPS[p.troopType];
      if (p.splash > 0) {
        this.splashBuildings(p.x, p.y, p.splash, p.dmg, T);
        this.events.push({ type: 'explode', x: p.x, y: p.y, z: 0.5, size: p.splash, kind: p.kind });
      } else if (p.target && !p.target.destroyed) {
        this.damageBuilding(p.target, p.dmg * this.multFor(T, p.target));
        this.events.push({ type: 'hit', x: p.x, y: p.y, z: 0.8, kind: p.kind });
      }
    }
  }

  damageTroop(t, dmg) {
    t.hp -= dmg;
    t.lastHit = this.time;
    if (t.hp <= 0) this.killTroop(t);
  }

  // Run the whole battle without rendering (used for offline raids).
  runToEnd(maxTime = BATTLE_TIME + 5) {
    let guard = Math.ceil(maxTime / SIM_DT);
    while (!this.ended && guard-- > 0) {
      this.step(SIM_DT);
      this.events.length = 0;
    }
    this.end();
    return this.result();
  }
}
