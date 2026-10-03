// Renders the player's village and handles village-mode input.

import * as THREE from 'three';
import { BUILDINGS, GRID, OBSTACLES } from '../data/buildings.js';
import { TROOPS } from '../data/troops.js';
import { PathGrid } from '../battle/pathfinding.js';
import {
  buildingModel, wallModel, obstacleModel, constructionSite, villagerModel, troopModel, humanoid, box,
} from './models.js';
import { Effects } from './effects.js';
import { hpBar } from './overlay.js';
import { levelDef, storageCap, occupancy, canPlace, findBuilding } from '../core/economy.js';
import { fmtTime } from '../util/format.js';

const JOB_HAT = {
  mining: '#f2c437',
  alchemy: '#c04ad0',
  building: '#e07a2a',
  leadership: '#c8402f',
  scholarship: '#3e6fc4',
  combat: '#5a5d66',
};

const tmpV = new THREE.Vector3();

function centerOf(b) {
  const s = BUILDINGS[b.type].size;
  return new THREE.Vector3(b.x + s / 2 - GRID / 2, 0, b.y + s / 2 - GRID / 2);
}

function tileToWorld(x, y) {
  return new THREE.Vector3(x - GRID / 2, 0, y - GRID / 2);
}

export class VillageView {
  constructor(game) {
    this.game = game;
    this.engine = game.engine;
    this.overlay = game.overlay;
    this.root = new THREE.Group();
    this.engine.scene.add(this.root);
    this.effects = new Effects(this.root);
    this.bmeshes = new Map();
    this.omeshes = new Map();
    this.agents = new Map();
    this.builders = new Map();
    this.bubbles = new Map();
    this.timers = new Map();
    this.camp = { sig: '', group: new THREE.Group() };
    this.root.add(this.camp.group);
    this.pathGrid = new PathGrid(GRID, GRID);
    this.layoutSig = '';
    this.time = 0;
    this.ghost = null;
    this.label = null;
    this.selPulse = 0;

    const ringGeo = new THREE.RingGeometry(0.92, 1, 4, 1);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.rotateY(Math.PI / 4);
    this.selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }));
    this.selRing.visible = false;
    this.selRing.renderOrder = 2;
    this.root.add(this.selRing);

    this.engine.setHandler(this);
    this.sync();
  }

  dispose() {
    this.cancelGhost();
    this.overlay.clear();
    this.effects.dispose();
    this.engine.scene.remove(this.root);
    this.engine.setHandler(null);
  }

  // ---------- syncing state -> meshes ----------
  sync() {
    const state = this.game.state;
    const walls = new Set(state.buildings.filter((b) => b.type === 'wall').map((b) => `${b.x},${b.y}`));
    const seen = new Set();
    for (const b of state.buildings) {
      seen.add(b.id);
      let sig = `${b.type}:${b.level}:${b.upgrade ? 1 : 0}`;
      let nb = null;
      if (b.type === 'wall') {
        nb = { e: walls.has(`${b.x + 1},${b.y}`), s: walls.has(`${b.x},${b.y + 1}`) };
        sig += `:${nb.e ? 1 : 0}${nb.s ? 1 : 0}`;
      }
      let rec = this.bmeshes.get(b.id);
      if (!rec || rec.sig !== sig) {
        if (rec) this.root.remove(rec.obj);
        const obj = this.makeBuilding(b, nb);
        obj.userData.pick = { kind: 'building', id: b.id };
        this.root.add(obj);
        const isNew = rec && rec.sig.split(':')[1] !== String(b.level);
        rec = { obj, sig, parts: findParts(obj) };
        this.bmeshes.set(b.id, rec);
        if (isNew) {
          this.effects.sparkle(centerOf(b).add(new THREE.Vector3(0, 1.2, 0)));
          rec.pop = 1;
        }
      }
      const moving = this.game.placement?.moveId === b.id;
      rec.obj.visible = !moving;
      rec.obj.position.copy(centerOf(b));
    }
    for (const [id, rec] of this.bmeshes) {
      if (!seen.has(id)) {
        this.root.remove(rec.obj);
        this.bmeshes.delete(id);
      }
    }

    const oseen = new Set();
    for (const o of state.obstacles) {
      oseen.add(o.id);
      let obj = this.omeshes.get(o.id);
      if (!obj) {
        obj = obstacleModel(o.type, o.id);
        obj.userData.pick = { kind: 'obstacle', id: o.id };
        const s = OBSTACLES[o.type].size;
        obj.position.copy(tileToWorld(o.x + s / 2, o.y + s / 2));
        this.root.add(obj);
        this.omeshes.set(o.id, obj);
      }
    }
    for (const [id, obj] of this.omeshes) {
      if (!oseen.has(id)) {
        this.effects.dust(obj.position.clone(), 1);
        this.root.remove(obj);
        this.omeshes.delete(id);
      }
    }

    const lsig = state.buildings.map((b) => `${b.id}@${b.x},${b.y}`).join('|') + '#' + state.obstacles.length;
    if (lsig !== this.layoutSig) {
      this.layoutSig = lsig;
      const occ = occupancy(state);
      for (let i = 0; i < occ.length; i++) this.pathGrid.blocked[i] = occ[i] ? 1 : 0;
      for (const a of this.agents.values()) {
        a.path = null;
        if (a.state === 'work') a.state = 'idle';
      }
    }
  }

  makeBuilding(b, nb) {
    const size = BUILDINGS[b.type].size;
    if (b.type === 'wall') {
      const g = b.level === 0 ? constructionSite(1) : wallModel(b.level, nb);
      return g;
    }
    if (b.level === 0) return constructionSite(size);
    const g = buildingModel(b.type, b.level);
    if (b.upgrade) g.add(constructionSite(size, false));
    return g;
  }

  // ---------- villagers ----------
  syncAgents() {
    const state = this.game.state;
    const seen = new Set();
    for (const v of state.villagers) {
      seen.add(v.id);
      let a = this.agents.get(v.id);
      const hat = v.job ? JOB_HAT[jobSkill(state, v)] || null : null;
      const sig = `${v.job}:${hat}`;
      if (!a) {
        const spawn = this.randomFreeTile(state.buildings.find((b) => b.type === 'townhall'), 6) || { x: GRID / 2, y: GRID / 2 + 3 };
        a = { id: v.id, x: spawn.x + 0.5, y: spawn.y + 0.5, path: null, state: 'idle', timer: Math.random() * 2, sig: '', facing: 0, phase: Math.random() * 10 };
        this.agents.set(v.id, a);
      }
      if (a.sig !== sig) {
        if (a.mesh) this.root.remove(a.mesh);
        a.mesh = villagerModel(v.look, hat);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.y = 0.5;
        a.mesh.add(hit);
        a.mesh.userData.pick = { kind: 'villager', id: v.id };
        this.root.add(a.mesh);
        if (a.sig) {
          a.path = null;
          a.state = 'idle';
          a.timer = 0;
        }
        a.sig = sig;
      }
    }
    for (const [id, a] of this.agents) {
      if (!seen.has(id)) {
        this.root.remove(a.mesh);
        this.agents.delete(id);
      }
    }
  }

  randomFreeTile(near, radius) {
    const cx = near ? near.x + BUILDINGS[near.type].size / 2 : GRID / 2;
    const cy = near ? near.y + BUILDINGS[near.type].size / 2 : GRID / 2;
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(cx + (Math.random() - 0.5) * 2 * radius);
      const y = Math.floor(cy + (Math.random() - 0.5) * 2 * radius);
      if (this.pathGrid.isFree(x, y) && x > 1 && y > 1 && x < GRID - 2 && y < GRID - 2) return { x, y };
    }
    return null;
  }

  workSpot(b, index) {
    const s = BUILDINGS[b.type].size;
    const spots = [];
    for (let i = 0; i < s; i++) spots.push([b.x + i, b.y + s], [b.x + s, b.y + i], [b.x - 1, b.y + i], [b.x + i, b.y - 1]);
    const free = spots.filter(([x, y]) => this.pathGrid.isFree(x, y));
    if (!free.length) return null;
    const [x, y] = free[(index * 3) % free.length];
    return { x, y };
  }

  updateAgents(dt) {
    const state = this.game.state;
    const byBuilding = new Map();
    for (const v of state.villagers) {
      const a = this.agents.get(v.id);
      if (!a) continue;
      let job = v.job ? findBuilding(state, v.job) : null;
      if (job && job.level < 1) job = null;
      if (job) {
        const idx = byBuilding.get(job.id) || 0;
        byBuilding.set(job.id, idx + 1);
        if (!a.path && a.state !== 'work') {
          const spot = this.workSpot(job, idx);
          if (spot) this.pathTo(a, spot);
          a.state = 'walk';
          a.goal = 'work';
        }
        if (a.state === 'walk' && a.path && a.pathIdx >= a.path.length) {
          a.state = 'work';
          const c = centerOf(job);
          a.facing = Math.atan2(c.z - (a.y - GRID / 2), c.x - (a.x - GRID / 2));
        }
      } else {
        if (a.goal === 'work') {
          a.goal = null;
          a.state = 'idle';
          a.path = null;
          a.timer = 0.5;
        }
        if (a.state === 'idle') {
          a.timer -= dt;
          if (a.timer <= 0) {
            const homes = state.buildings.filter((b) => b.type === 'house' || b.type === 'townhall');
            const t = this.randomFreeTile(homes[Math.floor(Math.random() * homes.length)], 5);
            if (t) {
              this.pathTo(a, t);
              a.state = 'walk';
            } else a.timer = 2;
          }
        } else if (a.state === 'walk' && (!a.path || a.pathIdx >= a.path.length)) {
          a.state = 'idle';
          a.timer = 2 + Math.random() * 4;
        }
      }
      this.stepAgent(a, dt, 1.3);
      this.poseAgent(a, dt);
    }
  }

  pathTo(a, tile) {
    const tx = tile.x, ty = tile.y;
    const p = this.pathGrid.findPath(Math.floor(a.x), Math.floor(a.y), (x, y) => x === tx && y === ty, (x, y) => Math.hypot(x - tx, y - ty), 3000);
    a.path = p || [[tx, ty]];
    a.pathIdx = 0;
  }

  stepAgent(a, dt, speed) {
    a.moving = false;
    if (a.state !== 'walk' || !a.path || a.pathIdx >= a.path.length) return;
    const [nx, ny] = a.path[a.pathIdx];
    const px = nx + 0.5, py = ny + 0.5;
    const dx = px - a.x, dy = py - a.y;
    const d = Math.hypot(dx, dy);
    const s = speed * dt;
    a.moving = true;
    if (d > 1e-3) a.facing = Math.atan2(dy, dx);
    if (d <= s) {
      a.x = px;
      a.y = py;
      a.pathIdx++;
    } else {
      a.x += (dx / d) * s;
      a.y += (dy / d) * s;
    }
  }

  poseAgent(a, dt) {
    a.phase += dt;
    const m = a.mesh;
    m.position.set(a.x - GRID / 2, 0, a.y - GRID / 2);
    m.rotation.y = Math.PI / 2 - a.facing;
    const rig = m.userData.rig;
    if (!rig) return;
    if (a.moving) {
      const s = Math.sin(a.phase * 10);
      rig.legL.rotation.x = s * 0.6;
      rig.legR.rotation.x = -s * 0.6;
      rig.armL.rotation.x = -s * 0.5;
      rig.armR.rotation.x = s * 0.5;
      rig.body.position.y = 0.3 + Math.abs(s) * 0.03;
    } else if (a.state === 'work') {
      rig.legL.rotation.x = rig.legR.rotation.x = 0;
      rig.armR.rotation.x = -1.2 - Math.sin(a.phase * 7) * 0.9;
      rig.armL.rotation.x = -0.4;
      rig.body.position.y = 0.3;
    } else {
      rig.legL.rotation.x = rig.legR.rotation.x = 0;
      rig.armL.rotation.x = rig.armR.rotation.x = Math.sin(a.phase * 1.5) * 0.05;
      rig.body.position.y = 0.3 + Math.sin(a.phase * 2) * 0.01;
    }
  }

  // builder figures hammering at construction sites
  updateBuilders(dt) {
    const state = this.game.state;
    const active = new Set();
    for (const b of state.buildings) {
      if (!b.upgrade) continue;
      active.add(b.id);
      let w = this.builders.get(b.id);
      if (!w) {
        const mesh = humanoid({ skin: '#f1c27d', shirt: '#e07a2a', pants: '#3b3b55', hair: null, hat: '#f2c437', scale: 0.7, beard: '#6e4320' });
        mesh.userData.rig.armR.add(box(0.06, 0.06, 0.3, '#5a5d66', 0, -0.45, 0.12));
        this.root.add(mesh);
        w = { mesh, phase: Math.random() * 5 };
        this.builders.set(b.id, w);
      }
      const s = BUILDINGS[b.type].size;
      const p = tileToWorld(b.x + s + 0.15, b.y + s + 0.15);
      w.mesh.position.copy(p);
      w.mesh.rotation.y = Math.PI + Math.PI / 4;
      w.phase += dt;
      w.mesh.userData.rig.armR.rotation.x = -1.4 - Math.sin(w.phase * 9) * 0.9;
    }
    for (const [id, w] of this.builders) {
      if (!active.has(id)) {
        this.root.remove(w.mesh);
        this.builders.delete(id);
      }
    }
  }

  // trained troops idling inside army camps
  updateCampTroops(dt) {
    const state = this.game.state;
    const camps = state.buildings.filter((b) => b.type === 'armycamp' && b.level >= 1);
    const sig = JSON.stringify(state.army.troops) + camps.map((c) => `${c.id}@${c.x},${c.y}`).join();
    if (sig !== this.camp.sig) {
      this.camp.sig = sig;
      this.root.remove(this.camp.group);
      this.camp.group = new THREE.Group();
      this.root.add(this.camp.group);
      if (camps.length) {
        const list = [];
        for (const [t, n] of Object.entries(state.army.troops)) for (let i = 0; i < n; i++) list.push(t);
        const perCamp = camps.map(() => []);
        list.forEach((t, i) => perCamp[i % camps.length].push(t));
        camps.forEach((c, ci) => {
          const center = centerOf(c);
          const shown = perCamp[ci].slice(0, 24);
          shown.forEach((t, i) => {
            const m = troopModel(t);
            const ring = i < 8 ? 0.85 : i < 18 ? 1.35 : 0.45;
            const k = i < 8 ? i / 8 : i < 18 ? (i - 8) / 10 : (i - 18) / 6;
            const a = k * Math.PI * 2 + ci;
            m.position.set(center.x + Math.cos(a) * ring, TROOPS[t].air ? 1.2 : 0.05, center.z + Math.sin(a) * ring);
            m.rotation.y = -a - Math.PI / 2;
            if (TROOPS[t].air) m.scale.multiplyScalar(0.6);
            m.userData.phase = Math.random() * 6;
            this.camp.group.add(m);
          });
        });
      }
    }
    for (const m of this.camp.group.children) {
      m.userData.phase += dt;
      const rig = m.userData.rig;
      if (rig?.body) rig.body.position.y = 0.3 + Math.abs(Math.sin(m.userData.phase * 2)) * 0.03;
      if (rig?.wingL) {
        rig.wingL.rotation.z = Math.sin(m.userData.phase * 4) * 0.5;
        rig.wingR.rotation.z = -Math.sin(m.userData.phase * 4) * 0.5;
      }
    }
  }

  // ---------- overlays ----------
  updateOverlays() {
    const state = this.game.state;
    const caps = storageCap(state);
    const ids = new Set(state.buildings.map((b) => b.id));
    for (const b of state.buildings) {
      const d = BUILDINGS[b.type];
      // collect bubbles
      if (d.resource && b.level >= 1) {
        const cap = levelDef(b).cap;
        const show = b.stored >= Math.max(5, cap * 0.04) && !b.upgrade && !this.game.placement;
        let item = this.bubbles.get(b.id);
        if (show && !item) {
          const el = document.createElement('button');
          el.className = `bubble bubble-${d.resource}`;
          el.innerHTML = `<span class="icon icon-${d.resource}"></span>`;
          el.addEventListener('pointerdown', (e) => e.stopPropagation());
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game.collect(b.id);
          });
          item = this.overlay.add(el, () => centerOf(b).setY(2.4), { interactive: true });
          this.bubbles.set(b.id, item);
        } else if (!show && item) {
          this.overlay.remove(item);
          this.bubbles.delete(b.id);
        }
        if (item) item.el.classList.toggle('full', b.stored >= cap - 0.5);
      }
      // construction timers
      let t = this.timers.get(b.id);
      if (b.upgrade) {
        if (!t) {
          const el = document.createElement('div');
          el.className = 'build-timer';
          el.innerHTML = '<div class="bt-time"></div>';
          const bar = hpBar('progress');
          el.appendChild(bar);
          el.bar = bar;
          t = this.overlay.add(el, () => centerOf(b).setY(BUILDINGS[b.type].size * 0.55 + 1.2), {});
          this.timers.set(b.id, t);
        }
        const speed = this.game.buildSpeed();
        t.el.querySelector('.bt-time').textContent = fmtTime(b.upgrade.remaining / speed);
        t.el.bar.setValue(1 - b.upgrade.remaining / b.upgrade.total);
      } else if (t) {
        this.overlay.remove(t);
        this.timers.delete(b.id);
      }
    }
    for (const [id, it] of this.bubbles) if (!ids.has(id)) { this.overlay.remove(it); this.bubbles.delete(id); }
    for (const [id, it] of this.timers) if (!ids.has(id)) { this.overlay.remove(it); this.timers.delete(id); }

    // storage fill levels
    for (const b of state.buildings) {
      const rec = this.bmeshes.get(b.id);
      if (!rec?.parts.fill) continue;
      const kind = BUILDINGS[b.type].storage;
      const f = caps[kind] ? state.resources[kind] / caps[kind] : 0;
      const fill = rec.parts.fill;
      if (kind === 'gold') {
        fill.scale.setScalar(0.3 + 0.7 * f);
      } else {
        fill.scale.y = 0.12 + f * 1.5;
      }
    }
  }

  updateSelection(dt) {
    const sel = this.game.selection;
    this.selPulse += dt;
    let target = null, size = 1;
    if (sel?.kind === 'building') {
      const b = findBuilding(this.game.state, sel.id);
      if (b) {
        target = centerOf(b);
        size = BUILDINGS[b.type].size;
      }
    } else if (sel?.kind === 'obstacle') {
      const o = this.game.state.obstacles.find((x) => x.id === sel.id);
      if (o) {
        size = OBSTACLES[o.type].size;
        target = tileToWorld(o.x + size / 2, o.y + size / 2);
      }
    } else if (sel?.kind === 'villager') {
      const a = this.agents.get(sel.id);
      if (a) {
        target = tileToWorld(a.x, a.y);
        size = 0.9;
      }
    }
    if (target && !this.game.placement) {
      this.selRing.visible = true;
      this.selRing.position.set(target.x, 0.04, target.z);
      const s = (size / 2) * Math.SQRT2 * (1.05 + Math.sin(this.selPulse * 5) * 0.03);
      this.selRing.scale.set(s, 1, s);
    } else this.selRing.visible = false;

    const key = sel ? `${sel.kind}:${sel.id}` : '';
    if (key !== this.labelKey) {
      this.labelKey = key;
      if (this.label) this.overlay.remove(this.label);
      this.label = null;
      if (sel && !this.game.placement) {
        const el = document.createElement('div');
        el.className = 'sel-label';
        this.label = this.overlay.add(el, () => this.labelPos(), { offsetY: 6 });
      }
    }
    if (this.label) {
      const text = this.game.selectionTitle();
      if (this.label.el.innerHTML !== text) this.label.el.innerHTML = text;
    }
  }

  labelPos() {
    const sel = this.game.selection;
    if (!sel) return null;
    if (sel.kind === 'building') {
      const b = findBuilding(this.game.state, sel.id);
      if (!b) return null;
      const rec = this.bmeshes.get(b.id);
      const s = BUILDINGS[b.type].size;
      const h = rec ? new THREE.Box3().setFromObject(rec.obj).max.y : s;
      return centerOf(b).setY(h + 0.4);
    }
    if (sel.kind === 'obstacle') {
      const o = this.game.state.obstacles.find((x) => x.id === sel.id);
      if (!o) return null;
      const s = OBSTACLES[o.type].size;
      return tileToWorld(o.x + s / 2, o.y + s / 2).setY(2.4);
    }
    const a = this.agents.get(sel.id);
    return a ? tileToWorld(a.x, a.y).setY(1.0) : null;
  }

  animateParts(dt) {
    this.time += dt;
    for (const rec of this.bmeshes.values()) {
      const p = rec.parts;
      if (p.spin) p.spin.rotation.z += dt * 2;
      if (p.pump) p.pump.rotation.z = Math.sin(this.time * 3) * 0.25;
      if (p.fire) {
        const s = 1 + Math.sin(this.time * 17 + rec.obj.position.x) * 0.12;
        p.fire.scale.set(s, 1 + Math.sin(this.time * 11) * 0.2, s);
      }
      if (p.liquid) p.liquid.scale.setScalar(1 + Math.sin(this.time * 2.5) * 0.04);
      for (let i = 0; i < p.flags.length; i++) p.flags[i].rotation.y = Math.sin(this.time * 2.2 + i + rec.obj.position.x) * 0.35;
      if (p.turret && p.idleTurret) p.turret.rotation.y = Math.sin(this.time * 0.4 + rec.obj.position.x) * 1.2;
      if (rec.pop > 0) {
        rec.pop = Math.max(0, rec.pop - dt * 2.5);
        const k = Math.sin(rec.pop * Math.PI) * 0.12;
        rec.obj.scale.set(1 - k * 0.5, 1 + k, 1 - k * 0.5);
      }
    }
  }

  // ---------- placement ----------
  startGhost() {
    this.cancelGhost();
    const pl = this.game.placement;
    if (!pl) return;
    const level = pl.moveId ? Math.max(1, findBuilding(this.game.state, pl.moveId).level) : 1;
    const size = BUILDINGS[pl.type].size;
    const model = pl.type === 'wall' ? wallModel(level, {}) : buildingModel(pl.type, level);
    model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.75;
        o.castShadow = false;
      }
    });
    const foot = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#3ad65a', transparent: true, opacity: 0.45, depthWrite: false }));
    foot.rotation.x = -Math.PI / 2;
    foot.position.y = 0.03;
    const g = new THREE.Group();
    g.add(foot, model);
    this.ghost = { group: g, foot, model };
    this.root.add(g);
    this.game.terrain.showGrid(true);
    this.updateGhost();
  }

  cancelGhost() {
    if (this.ghost) {
      this.root.remove(this.ghost.group);
      this.ghost = null;
    }
    this.game.terrain?.showGrid(false);
  }

  updateGhost() {
    const pl = this.game.placement;
    if (!pl || !this.ghost) return;
    const size = BUILDINGS[pl.type].size;
    pl.valid = canPlace(this.game.state, pl.type, pl.x, pl.y, pl.moveId);
    this.ghost.group.position.copy(tileToWorld(pl.x + size / 2, pl.y + size / 2));
    this.ghost.foot.material.color.set(pl.valid ? '#3ad65a' : '#e04040');
    this.ghost.group.position.y = 0.12 + Math.sin(this.time * 6) * 0.04;
  }

  ghostTileFor(info) {
    const size = BUILDINGS[this.game.placement.type].size;
    return { x: Math.round(info.tx - size / 2), y: Math.round(info.ty - size / 2) };
  }

  // ---------- input ----------
  pointerDown(info) {
    const pl = this.game.placement;
    if (!pl || !info.ground) return null;
    const size = BUILDINGS[pl.type].size;
    const inside = info.tx >= pl.x - 0.5 && info.tx <= pl.x + size + 0.5 && info.ty >= pl.y - 0.5 && info.ty <= pl.y + size + 0.5;
    if (inside) {
      this.dragOffset = { x: info.tx - pl.x, y: info.ty - pl.y };
      return 'capture';
    }
    return null;
  }

  drag(info) {
    const pl = this.game.placement;
    if (!pl || !info.ground) return;
    const nx = Math.round(info.tx - this.dragOffset.x);
    const ny = Math.round(info.ty - this.dragOffset.y);
    if (nx !== pl.x || ny !== pl.y) {
      pl.x = nx;
      pl.y = ny;
      this.updateGhost();
      this.game.ui.refresh();
    }
  }

  dragEnd() {
    this.game.ui.refresh();
  }

  tap(info) {
    const pl = this.game.placement;
    if (pl) {
      if (!info.ground) return;
      const t = this.ghostTileFor(info);
      pl.x = t.x;
      pl.y = t.y;
      this.updateGhost();
      this.game.ui.refresh();
      return;
    }
    const pickables = [];
    for (const a of this.agents.values()) pickables.push(a.mesh);
    for (const rec of this.bmeshes.values()) pickables.push(rec.obj);
    for (const o of this.omeshes.values()) pickables.push(o);
    const hit = this.engine.pick(info.sx, info.sy, pickables);
    let pick = null;
    for (let o = hit?.object; o; o = o.parent) {
      if (o.userData.pick) {
        pick = o.userData.pick;
        break;
      }
    }
    if (!pick && info.ground) {
      // fall back to the tile under the cursor
      const tx = Math.floor(info.tx), ty = Math.floor(info.ty);
      const b = this.game.state.buildings.find((b) => {
        const s = BUILDINGS[b.type].size;
        return tx >= b.x && ty >= b.y && tx < b.x + s && ty < b.y + s;
      });
      if (b) pick = { kind: 'building', id: b.id };
    }
    if (pick) {
      const rec = pick.kind === 'building' ? this.bmeshes.get(pick.id) : null;
      if (rec) rec.pop = 1;
    }
    this.game.select(pick);
  }

  focusOn(pos) {
    this.engine.target.set(pos.x, 0, pos.z);
    this.engine.updateCamera();
  }

  update(dt) {
    this.sync();
    this.syncAgents();
    this.updateAgents(dt);
    this.updateBuilders(dt);
    this.updateCampTroops(dt);
    this.animateParts(dt);
    this.updateOverlays();
    this.updateSelection(dt);
    if (this.ghost) this.updateGhost();
    this.effects.update(dt);
  }

  burst(id, kind) {
    const b = findBuilding(this.game.state, id);
    if (!b) return;
    this.effects.sparkle(centerOf(b).setY(1.5), kind === 'elixir' ? '#e070ff' : '#ffd84a');
  }

  worldPosOf(id) {
    const b = findBuilding(this.game.state, id);
    return b ? centerOf(b).setY(2) : tmpV.set(0, 2, 0);
  }
}

function findParts(obj) {
  const parts = { flags: [] };
  obj.traverse((o) => {
    if (o.name === 'flag') parts.flags.push(o);
    else if (o.name && !parts[o.name]) parts[o.name] = o;
  });
  if (parts.turret) parts.idleTurret = true;
  return parts;
}

function jobSkill(state, v) {
  const b = findBuilding(state, v.job);
  return b ? BUILDINGS[b.type].job?.skill : null;
}
