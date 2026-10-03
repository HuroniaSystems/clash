// Renders a BattleSim and handles troop deployment input.

import * as THREE from 'three';
import { BUILDINGS, GRID } from '../data/buildings.js';
import { TROOPS } from '../data/troops.js';
import { SIM_DT } from '../battle/sim.js';
import { buildingModel, wallModel, rubble, troopModel, projectileModel } from './models.js';
import { Effects } from './effects.js';
import { hpBar } from './overlay.js';
import { fmtNum } from '../util/format.js';
import { sound } from '../audio/sound.js';
import { animateRig } from './troops.js';

const MELEE_SOUND = { barbarian: 'sword', giant: 'punch', goblin: 'punch' };
const TROOP_FIRE_SOUND = { arrow: 'arrow', fireball: 'fireball', bomb: null };
const DEF_FIRE_SOUND = { ball: 'cannon', arrow: 'arrow', shell: 'mortar', rocket: 'rocket', orb: 'zap' };

const W = (x, y, h = 0) => new THREE.Vector3(x - GRID / 2, h, y - GRID / 2);

export class BattleView {
  /**
   * @param {object} game
   * @param {object} o  { sim, mode: 'attack' | 'defense', title }
   */
  constructor(game, { sim, mode, enemy = null, raid = null }) {
    this.game = game;
    this.engine = game.engine;
    this.overlay = game.overlay;
    this.sim = sim;
    this.mode = mode;
    this.enemy = enemy;
    this.raid = raid;
    this.root = new THREE.Group();
    this.engine.scene.add(this.root);
    this.effects = new Effects(this.root);
    this.bobjs = new Map();
    this.tobjs = new Map();
    this.pobjs = new Map();
    this.hpbars = new Map();
    this.acc = 0;
    this.speed = 1;
    this.time = 0;
    this.selectedTroop = null;
    this.holdTimer = 0;
    this.scoutLeft = mode === 'attack' ? 30 : 0;
    this.endTimer = null;
    this.redAlpha = 0;
    this.lootPulse = 0;

    this.buildScene();
    this.buildRedZone();
    this.engine.setHandler(this);
    this.redAlpha = mode === 'attack' ? 1.6 : 0;
    if (mode === 'attack') {
      const first = Object.entries(sim.army).find(([, n]) => n > 0);
      this.selectedTroop = first ? first[0] : null;
    }
  }

  dispose() {
    this.overlay.clear();
    this.effects.dispose();
    this.engine.scene.remove(this.root);
    this.engine.setHandler(null);
  }

  buildScene() {
    const walls = new Set(this.sim.buildings.filter((b) => b.isWall).map((b) => `${b.x},${b.y}`));
    for (const b of this.sim.buildings) {
      let obj;
      if (b.isWall) obj = wallModel(b.level, { e: walls.has(`${b.x + 1},${b.y}`), s: walls.has(`${b.x},${b.y + 1}`) });
      else obj = buildingModel(b.type, b.level);
      obj.position.copy(W(b.cx, b.cy));
      this.root.add(obj);
      const parts = {};
      obj.traverse((o) => {
        if (o.name && !parts[o.name]) parts[o.name] = o;
      });
      this.bobjs.set(b.idx, { obj, parts, recoil: 0 });
    }
  }

  buildRedZone() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = GRID * 8;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255,40,40,0.55)';
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (this.sim.noDeploy[y * GRID + x]) ctx.fillRect(x * 8, y * 8, 8, 8);
    // white outline at the boundary
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const v = this.sim.noDeploy[y * GRID + x];
        if (!v) continue;
        const nb = (xx, yy) => xx >= 0 && yy >= 0 && xx < GRID && yy < GRID && this.sim.noDeploy[yy * GRID + xx];
        if (!nb(x - 1, y)) ctx.fillRect(x * 8, y * 8, 1, 8);
        if (!nb(x + 1, y)) ctx.fillRect(x * 8 + 7, y * 8, 1, 8);
        if (!nb(x, y - 1)) ctx.fillRect(x * 8, y * 8, 8, 1);
        if (!nb(x, y + 1)) ctx.fillRect(x * 8, y * 8 + 7, 8, 1);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    m.renderOrder = 1;
    this.redZone = m;
    this.root.add(m);
  }

  // ---------- input ----------
  pointerDown(info) {
    this.holdTimer = -0.25;
    return null;
  }

  tap(info) {
    this.tryDeploy(info);
  }

  tryDeploy(info) {
    if (this.mode !== 'attack' || this.sim.ended || !info.ground) return false;
    const t = this.selectedTroop;
    if (!t || !this.sim.remaining(t)) {
      this.game.ui.toast('Select a troop to deploy', 'warn');
      return false;
    }
    if (!this.sim.canDeploy(info.tx, info.ty)) {
      this.redAlpha = 1.4;
      return false;
    }
    this.sim.deploy(t, info.tx, info.ty);
    if (!this.sim.remaining(t)) {
      const next = Object.entries(this.sim.army).find(([, n]) => n > 0);
      if (next) this.selectedTroop = next[0];
    }
    this.game.ui.refresh();
    return true;
  }

  // ---------- update ----------
  update(dt) {
    this.time += dt;
    const sim = this.sim;
    // scouting countdown
    if (this.mode === 'attack' && !sim.started) {
      this.scoutLeft -= dt;
      if (this.scoutLeft <= 0) sim.start();
    }
    // hold to deploy
    const pr = this.engine.heldPress();
    if (pr && this.mode === 'attack') {
      this.holdTimer += dt;
      if (this.holdTimer >= 0.09) {
        this.holdTimer = 0;
        const g = this.engine.screenToGround(pr.x, pr.y);
        if (g) {
          const j = 0.35;
          this.tryDeploy({ ground: g, tx: g.x + GRID / 2 + (Math.random() - 0.5) * j, ty: g.z + GRID / 2 + (Math.random() - 0.5) * j });
        }
      }
    }

    this.acc += Math.min(0.25, dt) * this.speed;
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      sim.step(SIM_DT);
      this.handleEvents();
    }
    this.syncBuildings(dt);
    this.syncTroops(dt);
    this.syncProjectiles();
    this.redAlpha = Math.max(0, this.redAlpha - dt);
    this.redZone.material.opacity = Math.min(0.8, this.redAlpha);
    this.effects.update(dt);
    if (this.endTimer != null) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.endTimer = null;
        this.game.finishBattle();
      }
    }
  }

  sfx(name, x, y, o = {}) {
    if (!name) return;
    const s = this.engine.worldToScreen(W(x, y, 0));
    const off = s.x < -80 || s.x > this.engine.width + 80 || s.y < -80 || s.y > this.engine.height + 80;
    const pan = Math.max(-0.85, Math.min(0.85, (s.x / this.engine.width) * 2 - 1));
    sound.play(name, { pan, volume: (o.volume ?? 1) * (off ? 0.4 : 1), ...o });
  }

  handleEvents() {
    const evs = this.sim.events;
    const quiet = this.speed > 4;
    const stars = this.sim.stars();
    if (stars > (this.lastStars || 0)) {
      this.lastStars = stars;
      sound.play('star');
    }
    for (const e of evs) {
      if (!quiet) this.eventSound(e);
      switch (e.type) {
        case 'deploy': {
          const p = W(e.troop.x, e.troop.y, 0.2);
          this.effects.spawn({ pos: p, color: '#ffffff', size: 0.3, grow: 1.0, life: 0.3, opacity: 0.6 });
          break;
        }
        case 'destroyed': {
          const b = e.building;
          const rec = this.bobjs.get(b.idx);
          if (rec) {
            this.root.remove(rec.obj);
            const r = rubble(b.size);
            r.position.copy(rec.obj.position);
            this.root.add(r);
            rec.obj = r;
            rec.parts = {};
          }
          this.effects.debris(W(b.cx, b.cy, 0.8), b.isWall ? 0.6 : b.size * 0.6);
          this.removeHp(`b${b.idx}`);
          if (b.isTownHall) this.game.ui.toast('Town Hall destroyed! +1 star', 'good');
          break;
        }
        case 'explode':
          this.effects.explosion(W(e.x, e.y, e.z || 0.3), e.size || 1, e.kind === 'orb' ? 'fire' : 'fire');
          break;
        case 'hit':
          this.effects.hit(W(e.x, e.y, e.z || 0.5), e.kind === 'arrow' ? '#ffe9b0' : '#ffaa55');
          break;
        case 'melee':
          if (Math.random() < 0.5) this.effects.hit(W(e.x, e.y, 0.6), '#ffffff');
          break;
        case 'troopDied': {
          const t = e.troop;
          this.effects.spawn({ pos: W(t.x, t.y, t.z + 0.4), color: '#dddddd', size: 0.3, grow: 1.2, life: 0.5, opacity: 0.7 });
          this.removeHp(`t${t.id}`);
          break;
        }
        case 'defFire': {
          const rec = this.bobjs.get(e.building.idx);
          if (rec) rec.recoil = 1;
          if (e.kind === 'ball' || e.kind === 'shell') {
            const b = e.building;
            const a = b.aim;
            this.effects.spawn({ pos: W(b.cx + Math.cos(a) * 1.1, b.cy + Math.sin(a) * 1.1, e.kind === 'shell' ? 1.6 : 1.1), color: '#ffcc66', emissive: '#aa5500', size: 0.25, grow: 0.8, life: 0.2 });
          }
          break;
        }
        case 'loot':
          this.lootPulse = 0.3;
          break;
        case 'end':
          if (this.endTimer == null) this.endTimer = 1.6;
          break;
        default:
          break;
      }
    }
    evs.length = 0;
  }

  eventSound(e) {
    switch (e.type) {
      case 'deploy':
        if (this.mode === 'attack' && !this.hornPlayed) {
          this.hornPlayed = true;
          sound.play('horn');
        }
        this.sfx('deploy', e.troop.x, e.troop.y, { troop: e.troop.type, volume: this.mode === 'attack' ? 1 : 0.6 });
        break;
      case 'melee':
        this.sfx(MELEE_SOUND[e.troop.type] || 'smallHit', e.x, e.y, { volume: 0.8 });
        break;
      case 'troopFire':
        this.sfx(TROOP_FIRE_SOUND[e.kind], e.troop.x, e.troop.y, { volume: 0.8 });
        break;
      case 'defFire':
        this.sfx(DEF_FIRE_SOUND[e.kind], e.building.cx, e.building.cy, { volume: 0.85 });
        break;
      case 'hit':
        this.sfx(e.kind === 'arrow' ? 'arrowHit' : 'smallHit', e.x, e.y, { volume: 0.7 });
        break;
      case 'explode':
        this.sfx(e.kind === 'orb' ? 'zap' : 'explosion', e.x, e.y, { size: Math.min(1.4, e.size || 1) });
        break;
      case 'destroyed':
        if (e.building.isWall) this.sfx('wallBreak', e.building.cx, e.building.cy);
        else this.sfx('destroy', e.building.cx, e.building.cy, { big: e.building.size >= 3 });
        break;
      case 'troopDied':
        this.sfx('die', e.troop.x, e.troop.y, { volume: 0.8 });
        break;
      case 'loot':
        if (Math.random() < 0.15) this.sfx('coin', e.building.cx, e.building.cy, { amount: 10, volume: 0.5 });
        break;
      default:
        break;
    }
  }

  syncBuildings(dt) {
    for (const b of this.sim.buildings) {
      const rec = this.bobjs.get(b.idx);
      if (!rec) continue;
      if (!b.destroyed) {
        if (rec.parts.turret) {
          rec.parts.turret.rotation.y = Math.PI / 2 - b.aim;
          if (rec.recoil > 0) {
            rec.recoil = Math.max(0, rec.recoil - dt * 5);
            const k = rec.recoil * 0.12;
            rec.parts.turret.position.x = -Math.cos(b.aim) * k;
            rec.parts.turret.position.z = -Math.sin(b.aim) * k;
          }
        }
        if (rec.parts.fire) rec.parts.fire.scale.y = 1 + Math.sin(this.time * 12) * 0.2;
        // shake when hit
        const since = this.sim.time - b.lastHit;
        if (since < 0.12 && !b.isWall) {
          rec.obj.position.x = b.cx - GRID / 2 + (Math.random() - 0.5) * 0.06;
          rec.obj.position.z = b.cy - GRID / 2 + (Math.random() - 0.5) * 0.06;
        } else {
          rec.obj.position.x = b.cx - GRID / 2;
          rec.obj.position.z = b.cy - GRID / 2;
        }
      }
      const key = `b${b.idx}`;
      if (!b.destroyed && b.hp < b.maxHp) {
        let it = this.hpbars.get(key);
        if (!it) {
          const el = hpBar(b.isWall ? 'wall' : 'building');
          const h = b.isWall ? 1.0 : b.size * 0.55 + 1.0;
          it = this.overlay.add(el, W(b.cx, b.cy, h));
          this.hpbars.set(key, it);
        }
        it.el.setValue(b.hp / b.maxHp);
        it.el.style.visibility = this.sim.time - b.lastHit < 3 || !b.isWall ? '' : 'hidden';
      }
    }
  }

  removeHp(key) {
    const it = this.hpbars.get(key);
    if (it) {
      this.overlay.remove(it);
      this.hpbars.delete(key);
    }
  }

  syncTroops(dt) {
    const alive = new Set();
    for (const t of this.sim.troops) {
      alive.add(t.id);
      let rec = this.tobjs.get(t.id);
      if (!rec) {
        const mesh = troopModel(t.type, t.level);
        if (this.mode === 'defense') mesh.traverse((o) => o.isMesh && (o.castShadow = true));
        this.root.add(mesh);
        rec = { mesh, phase: Math.random() * 6 };
        this.tobjs.set(t.id, rec);
      }
      rec.phase += dt;
      const m = rec.mesh;
      const bob = t.air ? Math.sin(rec.phase * 2) * 0.15 : 0;
      m.position.copy(W(t.x, t.y, t.z + bob));
      m.rotation.y = Math.PI / 2 - t.facing;
      animateRig(m.userData.rig, t.moving ? 'walk' : t.attacking ? 'attack' : 'idle', rec.phase, { speed: t.speed / 1.8, pulse: t.attackPulse });
      const key = `t${t.id}`;
      if (t.hp < t.maxHp) {
        let it = this.hpbars.get(key);
        if (!it) {
          it = this.overlay.add(hpBar(this.mode === 'attack' ? 'troop' : 'enemy'), () => m.position.clone().setY(m.position.y + (t.air ? 1.9 : 1.0) * (t.type === 'giant' ? 1.5 : 1)));
          this.hpbars.set(key, it);
        }
        it.el.setValue(t.hp / t.maxHp);
      }
    }
    for (const [id, rec] of this.tobjs) {
      if (!alive.has(id)) {
        this.root.remove(rec.mesh);
        this.tobjs.delete(id);
        this.removeHp(`t${id}`);
      }
    }
  }

  syncProjectiles() {
    const alive = new Set();
    for (const p of this.sim.projectiles) {
      alive.add(p.id);
      let m = this.pobjs.get(p.id);
      if (!m) {
        m = projectileModel(p.kind);
        this.root.add(m);
        this.pobjs.set(p.id, m);
      }
      let h;
      if (p.kind === 'shell') {
        const k = Math.min(1, p.t / p.dur);
        h = p.sz + (0.2 - p.sz) * k + Math.sin(k * Math.PI) * 5;
      } else if (p.kind === 'bomb') {
        const k = Math.min(1, p.t / p.dur);
        h = p.sz * (1 - k * k) + 0.2;
      } else {
        const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
        const k = Math.min(1, Math.hypot(p.x - p.sx, p.y - p.sy) / total);
        const endH = p.side === 'def' ? (p.target?.z || 0) + 0.5 : 0.8;
        h = p.sz + (endH - p.sz) * k + (p.kind === 'arrow' ? Math.sin(k * Math.PI) * 0.8 : 0);
      }
      const next = W(p.x, p.y, h);
      if (p.kind === 'arrow' || p.kind === 'rocket') {
        const dir = new THREE.Vector3(p.tx - p.x, 0, p.ty - p.y);
        if (dir.lengthSq() > 1e-6) m.lookAt(next.clone().add(dir));
      }
      m.position.copy(next);
    }
    for (const [id, m] of this.pobjs) {
      if (!alive.has(id)) {
        this.root.remove(m);
        this.pobjs.delete(id);
      }
    }
  }

  lootText() {
    const l = this.sim.loot;
    return { gold: fmtNum(l.gold), elixir: fmtNum(l.elixir) };
  }
}

export function troopIconColor(type) {
  return {
    barbarian: '#f2c437',
    archer: '#e0459a',
    giant: '#e2732a',
    goblin: '#6fcf4a',
    wallbreaker: '#ecebe4',
    balloon: '#5a4632',
    wizard: '#3b5bd6',
    dragon: '#d6402a',
  }[type] || '#999';
}

export { TROOPS };
