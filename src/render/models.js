// Procedural low-poly models in a bright, chunky medieval style.
// All models sit on y = 0 with their footprint centered on the origin.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map();
function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// box with its bottom at y
export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = mesh(cachedGeo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), color, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8, opts) {
  const m = mesh(cachedGeo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), color, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cone(r, h, color, x = 0, y = 0, z = 0, seg = 4, opts) {
  const m = mesh(cachedGeo(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), color, opts);
  m.position.set(x, y + h / 2, z);
  if (seg === 4) m.rotation.y = Math.PI / 4;
  return m;
}

export function sphere(r, color, x = 0, y = 0, z = 0, ws = 10, hs = 8, opts) {
  const m = mesh(cachedGeo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)), color, opts);
  m.position.set(x, y, z);
  return m;
}

export function rock(r, color, x = 0, y = 0, z = 0, detail = 0) {
  const m = mesh(cachedGeo(`r${r},${detail}`, () => new THREE.DodecahedronGeometry(r, detail)), color);
  m.position.set(x, y, z);
  return m;
}

// Triangular prism roof running along X.
export function gable(w, h, d, color, x = 0, y = 0, z = 0) {
  const g = cachedGeo(`g${w},${h},${d}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(-d / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    geo.translate(-w / 2, 0, 0);
    return geo;
  });
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

// Merge static meshes by material to keep draw calls low. Children named 'dyn' stay separate.
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (o === root) return;
    let p = o;
    while (p && p !== root) {
      if (p.userData.dyn) return;
      p = p.parent;
    }
    if (!o.isMesh || o.material.transparent) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const list = buckets.get(o.material) || [];
    list.push(g);
    buckets.set(o.material, list);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  const statics = new THREE.Group();
  for (const [m, list] of buckets) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    const mm = new THREE.Mesh(merged, m);
    mm.castShadow = true;
    mm.receiveShadow = true;
    statics.add(mm);
  }
  root.add(statics);
  // drop now-empty groups
  const empties = [];
  root.traverse((o) => {
    if (o !== root && o.type === 'Group' && o.children.length === 0) empties.push(o);
  });
  for (const e of empties) e.parent?.remove(e);
  return root;
}

function dyn(g) {
  g.userData.dyn = true;
  return g;
}

// ---------- palettes ----------
const C = {
  grassDark: '#4e8a2c',
  dirt: '#b98a52',
  dirtDark: '#8e6638',
  wood: '#9b6232',
  woodDark: '#6e4320',
  woodLight: '#c08a4f',
  stone: '#b7b2a6',
  stoneDark: '#847f75',
  stoneLight: '#d6d1c4',
  roofRed: '#c8402f',
  roofBlue: '#3e6fc4',
  roofGreen: '#3d8a48',
  gold: '#f6c33b',
  goldDark: '#c99418',
  elixir: '#d63fd0',
  elixirDark: '#8f2b9b',
  iron: '#4a4d55',
  ironDark: '#2c2e33',
  white: '#f2ece0',
  black: '#1c1c1c',
};

function tier(level) {
  return level <= 2 ? 0 : level <= 4 ? 1 : 2;
}

function pad(size, color = C.dirt) {
  return box(size * 0.92, 0.06, size * 0.92, color, 0, 0, 0);
}

function flag(color, x, y, z, h = 1) {
  return group(cyl(0.035, 0.035, h, C.woodDark, x, y, z, 5), box(0.45, 0.28, 0.03, color, x + 0.24, y + h - 0.3, z));
}

function crenels(w, d, y, color, size = 0.22) {
  const g = new THREE.Group();
  const nx = Math.max(2, Math.round(w / 0.45));
  const nz = Math.max(2, Math.round(d / 0.45));
  for (let i = 0; i < nx; i++) {
    const x = -w / 2 + size / 2 + (i * (w - size)) / (nx - 1);
    g.add(box(size, size, size, color, x, y, -d / 2 + size / 2));
    g.add(box(size, size, size, color, x, y, d / 2 - size / 2));
  }
  for (let i = 1; i < nz - 1; i++) {
    const z = -d / 2 + size / 2 + (i * (d - size)) / (nz - 1);
    g.add(box(size, size, size, color, -w / 2 + size / 2, y, z));
    g.add(box(size, size, size, color, w / 2 - size / 2, y, z));
  }
  return g;
}

// ---------- buildings ----------
function townhall(level) {
  const t = tier(level);
  const wall = [C.woodLight, C.stoneLight, C.stoneLight][t];
  const roof = [C.roofRed, C.roofRed, C.roofBlue][t];
  const g = group(
    pad(4, C.dirtDark),
    box(3.5, 0.35, 3.5, C.stone, 0, 0, 0),
    box(2.7, 1.5, 2.7, wall, 0, 0.35, 0),
    box(2.9, 0.18, 2.9, t === 2 ? C.gold : C.woodDark, 0, 1.85, 0),
    cone(2.3, 1.5, roof, 0, 2.0, 0),
    box(0.7, 0.9, 0.08, C.woodDark, 0, 0.35, 1.36),
    box(0.85, 0.12, 0.1, C.stoneDark, 0, 1.25, 1.36),
  );
  // windows
  for (const x of [-0.85, 0.85]) {
    g.add(box(0.35, 0.4, 0.06, '#3a2a1a', x, 0.95, 1.36));
    g.add(box(0.06, 0.4, 0.35, '#3a2a1a', 1.36, 0.95, x));
  }
  if (t === 0) {
    for (const [x, z] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) g.add(box(0.25, 1.9, 0.25, C.woodDark, x, 0.35, z));
  } else {
    for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      g.add(cyl(0.38, 0.42, 2.3, C.stone, x, 0.2, z, 8));
      g.add(cone(0.5, 0.8, roof, x, 2.5, z, 8));
    }
  }
  if (level >= 4) g.add(box(1.2, 0.8, 0.08, C.roofBlue, 0, 2.1, 1.3));
  if (t === 2) {
    g.add(sphere(0.18, C.gold, 0, 3.6, 0, 8, 6));
    for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) g.add(sphere(0.1, C.gold, x, 3.35, z, 6, 4));
  }
  g.add(flag(level >= 3 ? C.roofBlue : C.roofRed, 0, 3.3, 0, 1.0));
  return g;
}

function goldmine(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  g.add(rock(1.05, '#8a7a66', -0.25, 0.45, -0.45, 0));
  g.add(rock(0.7, '#9c8b74', 0.6, 0.3, -0.6, 0));
  // tunnel entrance frame
  g.add(box(0.15, 1.1, 0.15, C.wood, -0.5, 0, 0.35));
  g.add(box(0.15, 1.1, 0.15, C.wood, 0.3, 0, 0.35));
  g.add(box(1.0, 0.15, 0.2, C.wood, -0.1, 1.05, 0.35));
  g.add(box(0.65, 0.85, 0.05, '#2a1e14', -0.1, 0.1, 0.3));
  // rails and cart
  g.add(box(0.08, 0.04, 1.2, C.iron, -0.3, 0.06, 0.95));
  g.add(box(0.08, 0.04, 1.2, C.iron, 0.1, 0.06, 0.95));
  g.add(box(0.6, 0.35, 0.5, t === 2 ? C.goldDark : C.woodDark, -0.1, 0.15, 1.05));
  for (let i = 0; i < 3 + t * 2; i++) g.add(rock(0.13, C.gold, -0.25 + (i % 3) * 0.14, 0.55, 0.95 + Math.floor(i / 3) * 0.12));
  // gold nuggets on the ground
  for (const [x, z] of [[0.95, 0.4], [1.05, 0.95], [-1.05, 0.9]]) g.add(rock(0.16, C.gold, x, 0.15, z));
  // wheel crank
  const wheel = dyn(new THREE.Group());
  wheel.name = 'spin';
  const wh = cyl(0.42, 0.42, 0.1, C.woodDark, 0, -0.05, 0, 10);
  wh.rotation.x = Math.PI / 2;
  wheel.add(wh);
  wheel.add(box(0.8, 0.08, 0.06, C.wood, 0, -0.04, 0.06));
  wheel.add(box(0.08, 0.8, 0.06, C.wood, 0, -0.4, 0.06));
  wheel.position.set(0.95, 0.95, -0.05);
  wheel.rotation.y = Math.PI / 2;
  g.add(box(0.12, 0.95, 0.12, C.wood, 0.95, 0, -0.15));
  g.add(wheel);
  if (t >= 1) g.add(flag(C.gold, -1.1, 0.1, -1.1, 1.4));
  return g;
}

function elixircollector(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  g.add(cyl(1.05, 1.15, 0.3, t === 0 ? C.wood : C.stone, 0, 0, 0, 10));
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) g.add(box(0.14, 1.3, 0.14, C.woodDark, x, 0.3, z));
  g.add(cyl(0.8, 0.8, 0.12, C.woodDark, 0, 1.55, 0, 10));
  const glass = sphere(0.75, '#e48fe8', 0, 1.9, 0, 14, 10, { transparent: true, opacity: 0.55 });
  g.add(glass);
  const liquid = sphere(0.6, C.elixir, 0, 1.85, 0, 12, 10, { emissive: '#5a0f60' });
  liquid.name = 'liquid';
  g.add(dyn(group(liquid)));
  g.add(cyl(0.18, 0.25, 0.3, C.iron, 0, 2.6, 0, 8));
  // pump arm
  const pump = dyn(new THREE.Group());
  pump.name = 'pump';
  pump.add(box(1.4, 0.1, 0.1, C.wood, 0.35, 0, 0));
  pump.add(box(0.12, 0.5, 0.12, C.iron, 1.0, -0.45, 0));
  pump.position.set(0.3, 0.95, 0.95);
  g.add(box(0.14, 0.95, 0.14, C.woodDark, 0.3, 0, 0.95));
  g.add(pump);
  if (t >= 2) g.add(sphere(0.12, C.gold, 0, 2.95, 0, 6, 4));
  return g;
}

function goldstorage(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  const body = [C.wood, C.stone, C.stoneLight][t];
  g.add(box(2.4, 1.0, 2.4, body, 0, 0, 0));
  const band = t === 2 ? C.gold : C.iron;
  for (const y of [0.1, 0.9]) {
    g.add(box(2.5, 0.14, 0.12, band, 0, y, 1.2));
    g.add(box(2.5, 0.14, 0.12, band, 0, y, -1.2));
    g.add(box(0.12, 0.14, 2.5, band, 1.2, y, 0));
    g.add(box(0.12, 0.14, 2.5, band, -1.2, y, 0));
  }
  g.add(box(2.2, 0.04, 2.2, C.woodDark, 0, 1.0, 0));
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) g.add(box(0.2, 1.15, 0.2, C.iron, x, 0, z));
  const fill = dyn(new THREE.Group());
  fill.name = 'fill';
  fill.add(cone(1.1, 0.9, C.gold, 0, 0, 0, 8));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    fill.add(cyl(0.18, 0.18, 0.06, C.goldDark, Math.cos(a) * 0.8, 0.05, Math.sin(a) * 0.8, 8));
  }
  fill.position.y = 1.07;
  g.add(fill);
  return g;
}

function elixirstorage(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  g.add(cyl(1.2, 1.25, 0.35, t === 0 ? C.woodDark : C.stone, 0, 0, 0, 10));
  g.add(cyl(1.0, 1.0, 1.7, '#f0b8f0', 0, 0.35, 0, 12, { transparent: true, opacity: 0.45 }));
  const fill = dyn(new THREE.Group());
  fill.name = 'fill';
  const liq = cyl(0.9, 0.9, 1, C.elixir, 0, 0, 0, 12, { emissive: '#4a0a50' });
  liq.position.y = 0.5;
  fill.add(liq);
  fill.position.y = 0.37;
  g.add(fill);
  for (const y of [0.55, 1.15, 1.75]) g.add(cyl(1.04, 1.04, 0.1, t === 2 ? C.gold : C.iron, 0, y, 0, 12));
  g.add(cone(1.1, 0.5, C.iron, 0, 2.05, 0, 12));
  if (t === 2) g.add(sphere(0.12, C.gold, 0, 2.6, 0, 6, 4));
  return g;
}

function house(level) {
  const t = tier(level);
  const wall = [C.woodLight, C.white, C.white][t];
  const roof = [C.roofRed, C.roofRed, C.roofBlue][t];
  const g = group(pad(2));
  g.add(box(1.5, 0.15, 1.3, C.stone, 0, 0, 0));
  g.add(box(1.35, 0.85, 1.15, wall, 0, 0.15, 0));
  if (t >= 1) {
    for (const x of [-0.6, 0.6]) g.add(box(0.1, 0.85, 1.17, C.woodDark, x, 0.15, 0));
  }
  g.add(gable(1.6, 0.75, 1.45, roof, 0, 1.0, 0));
  g.add(box(0.35, 0.55, 0.06, C.woodDark, 0.25, 0.15, 0.58));
  g.add(box(0.28, 0.28, 0.06, '#3a2a1a', -0.35, 0.5, 0.58));
  g.add(box(0.22, 0.6, 0.22, C.stoneDark, -0.45, 1.1, -0.25));
  return g;
}

function builderhut(level) {
  const g = group(pad(2));
  g.add(cyl(0.75, 0.8, 0.9, C.woodLight, 0, 0, 0, 8));
  g.add(cone(0.95, 0.8, C.roofBlue, 0, 0.9, 0, 8));
  g.add(box(0.36, 0.6, 0.06, C.woodDark, 0, 0, 0.77));
  // hammer sign
  g.add(box(0.06, 0.6, 0.06, C.woodDark, 0.65, 0.4, 0.55));
  g.add(box(0.3, 0.14, 0.14, C.iron, 0.65, 1.0, 0.55));
  g.add(box(0.5, 0.25, 0.4, C.woodLight, -0.5, 0, 0.65));
  return g;
}

function barracks(level) {
  const t = tier(level);
  const wall = [C.wood, C.stone, C.stoneLight][t];
  const g = group(pad(3, C.dirtDark));
  g.add(box(2.4, 1.2, 2.2, wall, 0, 0, 0));
  g.add(crenels(2.4, 2.2, 1.2, wall, 0.28));
  g.add(box(2.2, 0.08, 2.0, C.woodDark, 0, 1.18, 0));
  g.add(box(0.7, 0.9, 0.08, C.woodDark, 0, 0, 1.12));
  // shield with crossed swords
  g.add(cylAt(0.3, C.roofRed, -0.75, 0.65, 1.14));
  const s1 = box(0.07, 0.9, 0.04, '#d8d8d8', -0.75, 0.2, 1.2);
  s1.rotation.z = 0.7;
  const s2 = box(0.07, 0.9, 0.04, '#d8d8d8', -0.75, 0.2, 1.2);
  s2.rotation.z = -0.7;
  g.add(s1, s2);
  g.add(flag(C.roofRed, 0.95, 1.2, -0.85, 1.0));
  if (t >= 1) g.add(flag(C.roofBlue, -0.95, 1.2, -0.85, 1.0));
  return g;
}

function cylAt(r, color, x, y, z) {
  const m = cyl(r, r, 0.08, color, 0, 0, 0, 10);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

function armycamp(level) {
  const t = tier(level);
  const g = group();
  g.add(cyl(1.85, 1.9, 0.06, C.dirt, 0, 0, 0, 16));
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(rock(0.22, t === 0 ? '#9c9488' : C.stoneLight, Math.cos(a) * 1.8, 0.15, Math.sin(a) * 1.8));
  }
  // campfire
  for (let i = 0; i < 4; i++) {
    const l = box(0.7, 0.12, 0.12, C.woodDark, 0, 0.05, 0);
    l.rotation.y = (i / 4) * Math.PI;
    g.add(l);
  }
  const fire = dyn(new THREE.Group());
  fire.name = 'fire';
  fire.add(cone(0.25, 0.6, '#ff8a1e', 0, 0.1, 0, 6, { emissive: '#ff5500' }));
  fire.add(cone(0.14, 0.4, '#ffd23e', 0, 0.12, 0, 6, { emissive: '#ffaa00' }));
  g.add(fire);
  // tents
  g.add(gable(0.9, 0.7, 0.9, C.white, -1.0, 0.05, -0.95).rotateY(0.6));
  if (t >= 1) g.add(gable(0.9, 0.7, 0.9, C.roofRed, 1.05, 0.05, -0.9).rotateY(-0.6));
  g.add(flag(C.roofRed, 1.6, 0, 1.3, 1.3));
  return g;
}

function laboratory(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  g.add(box(2.3, 1.1, 2.1, [C.stone, C.stoneLight, C.stoneLight][t], 0, 0, 0));
  g.add(box(2.4, 0.12, 2.2, C.woodDark, 0, 1.1, 0));
  g.add(sphere(0.85, '#8fd3ff', 0, 1.2, 0, 12, 8, { transparent: true, opacity: 0.7 }));
  g.add(cyl(0.18, 0.2, 1.0, C.stoneDark, 0.8, 1.1, -0.7, 6));
  g.add(sphere(0.2, '#55e07a', 0.8, 2.2, -0.7, 8, 6, { emissive: '#1f6a30' }));
  g.add(box(0.6, 0.8, 0.06, C.roofBlue, 0, 0, 1.06));
  for (const x of [-0.75, 0.75]) g.add(box(0.3, 0.3, 0.06, '#5fc3ff', x, 0.55, 1.06));
  if (t >= 2) g.add(sphere(0.12, C.gold, 0, 2.05, 0, 6, 4));
  return g;
}

function defenseBase(level, round = true) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  if (round) {
    g.add(cyl(1.15, 1.25, 0.45, [C.woodDark, C.stone, C.stoneLight][t], 0, 0, 0, 8));
    g.add(cyl(1.0, 1.0, 0.06, [C.wood, C.stoneDark, C.stoneDark][t], 0, 0.45, 0, 8));
  } else {
    g.add(box(2.3, 0.45, 2.3, [C.woodDark, C.stone, C.stoneLight][t], 0, 0, 0));
  }
  return g;
}

function cannon(level) {
  const t = tier(level);
  const g = defenseBase(level);
  const turret = dyn(new THREE.Group());
  turret.name = 'turret';
  turret.add(box(0.9, 0.35, 0.9, t === 2 ? C.goldDark : C.wood, 0, 0, 0));
  const barrel = cyl(0.22, 0.3, 1.5, t === 2 ? '#3a3a44' : C.ironDark, 0, 0, 0, 10);
  barrel.rotation.x = Math.PI / 2 - 0.12;
  barrel.position.set(0, 0.6, 0.35);
  turret.add(barrel);
  turret.add(cylAt(0.31, t === 2 ? C.gold : C.iron, 0, 0.66, 1.08));
  for (const x of [-0.5, 0.5]) {
    const w = cyl(0.28, 0.28, 0.1, C.woodDark, 0, 0, 0, 10);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.28, -0.1);
    turret.add(w);
  }
  turret.position.y = 0.5;
  g.add(turret);
  return g;
}

function archertower(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  const legC = [C.wood, C.wood, C.stone][t];
  const h = 2.0 + t * 0.2;
  for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) g.add(box(0.24, h, 0.24, legC, x, 0, z));
  if (t === 2) g.add(box(1.5, h * 0.8, 1.5, C.stone, 0, 0, 0));
  else {
    const b1 = box(0.1, 2.0, 0.08, C.woodDark, 0, 0.1, 0.76);
    b1.rotation.z = 0.65;
    const b2 = box(0.1, 2.0, 0.08, C.woodDark, 0, 0.1, -0.76);
    b2.rotation.z = -0.65;
    g.add(b1, b2);
  }
  g.add(box(1.9, 0.2, 1.9, C.woodDark, 0, h, 0));
  g.add(crenels(1.9, 1.9, h + 0.2, t === 0 ? C.wood : C.stone, 0.22));
  if (t >= 1) {
    for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) g.add(box(0.1, 0.9, 0.1, C.woodDark, x, h + 0.2, z));
    g.add(cone(1.5, 0.7, C.roofRed, 0, h + 1.1, 0));
  }
  const turret = dyn(new THREE.Group());
  turret.name = 'turret';
  const archer = humanoid({ skin: '#f1c27d', shirt: '#3c8d3c', pants: '#2e5e2e', hair: '#e0459a', scale: 0.55 });
  turret.add(archer);
  turret.add(box(0.06, 0.5, 0.06, C.woodDark, 0.15, 0.35, 0.18));
  turret.position.y = h + 0.2;
  g.add(turret);
  return g;
}

function mortar(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  const ringC = [C.stoneDark, C.stone, C.stoneLight][t];
  g.add(cyl(1.25, 1.3, 0.8, ringC, 0, 0, 0, 10));
  g.add(cyl(0.95, 0.95, 0.05, C.dirtDark, 0, 0.8, 0, 10));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(box(0.28, 0.25, 0.28, ringC, Math.cos(a) * 1.1, 0.8, Math.sin(a) * 1.1));
  }
  const turret = dyn(new THREE.Group());
  turret.name = 'turret';
  const barrel = cyl(0.42, 0.34, 0.9, C.ironDark, 0, 0, 0, 10);
  barrel.rotation.x = 0.55;
  barrel.position.set(0, 0.35, 0.15);
  turret.add(barrel);
  turret.add(box(0.95, 0.3, 0.8, t === 2 ? C.goldDark : C.woodDark, 0, 0, -0.05));
  turret.position.y = 0.82;
  g.add(turret);
  return g;
}

function airdefense(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  g.add(cyl(0.9, 1.25, 1.4, [C.stone, C.stone, C.stoneLight][t], 0, 0, 0, 6));
  g.add(cyl(1.0, 1.0, 0.15, C.iron, 0, 1.4, 0, 6));
  const turret = dyn(new THREE.Group());
  turret.name = 'turret';
  turret.add(cyl(0.55, 0.6, 0.35, C.roofRed, 0, 0, 0, 8));
  for (const [x, y] of [[-0.3, 0.45], [0.3, 0.45], [-0.3, 0.85], [0.3, 0.85]]) {
    const tube = cyl(0.13, 0.13, 0.9, C.iron, 0, 0, 0, 8);
    tube.rotation.x = Math.PI / 2 - 0.5;
    tube.position.set(x, y, 0.15);
    turret.add(tube);
    const tip = cone(0.13, 0.25, C.roofRed, 0, 0, 0, 8);
    tip.rotation.x = Math.PI / 2 - 0.5;
    tip.position.set(x, y + 0.42, 0.55);
    turret.add(tip);
  }
  turret.position.y = 1.55;
  g.add(turret);
  return g;
}

function wizardtower(level) {
  const t = tier(level);
  const g = group(pad(3, C.dirtDark));
  g.add(cyl(0.9, 1.1, 2.0, [C.stone, C.stoneLight, C.stoneLight][t], 0, 0, 0, 10));
  g.add(cyl(1.05, 1.05, 0.15, C.roofBlue, 0, 2.0, 0, 10));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.25, 0.25, 0.25, C.stone, Math.cos(a) * 0.9, 2.15, Math.sin(a) * 0.9));
  }
  g.add(box(0.4, 0.7, 0.06, C.woodDark, 0, 0, 1.05));
  const turret = dyn(new THREE.Group());
  turret.name = 'turret';
  turret.add(wizardFigure(0.55));
  turret.position.y = 2.15;
  g.add(turret);
  return g;
}

const WALL_COLORS = [
  ['#a06a35', '#7a4d24'],
  ['#c9c3b6', '#9a9488'],
  ['#9a9590', '#6f6a66'],
  ['#5c5a66', '#3e3c46'],
  ['#f2c13a', '#b88a12'],
  ['#c86de0', '#8a3aa8'],
];

export function wallModel(level, neighbors = {}) {
  const [c1, c2] = WALL_COLORS[Math.min(WALL_COLORS.length, level) - 1];
  const g = new THREE.Group();
  if (level <= 1) {
    g.add(box(0.22, 0.8, 0.22, c1, 0, 0, 0));
    g.add(cone(0.13, 0.18, c1, 0, 0.8, 0, 4));
    if (neighbors.e) {
      g.add(box(1.0, 0.12, 0.08, c2, 0.5, 0.25, 0));
      g.add(box(1.0, 0.12, 0.08, c2, 0.5, 0.55, 0));
    }
    if (neighbors.s) {
      g.add(box(0.08, 0.12, 1.0, c2, 0, 0.25, 0.5));
      g.add(box(0.08, 0.12, 1.0, c2, 0, 0.55, 0.5));
    }
  } else {
    g.add(box(0.5, 0.85, 0.5, c1, 0, 0, 0));
    g.add(box(0.56, 0.12, 0.56, c2, 0, 0.8, 0));
    if (neighbors.e) g.add(box(0.6, 0.7, 0.4, c2, 0.5, 0, 0));
    if (neighbors.s) g.add(box(0.4, 0.7, 0.6, c2, 0, 0, 0.5));
    if (level >= 4) g.add(cone(0.1, 0.25, '#d0d0d0', 0, 0.92, 0, 4));
  }
  return g;
}

export function constructionSite(size) {
  const g = group(pad(size, C.dirtDark));
  const s = size * 0.42;
  const h = Math.min(2.2, 0.8 + size * 0.35);
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) g.add(box(0.12, h, 0.12, C.woodLight, x, 0, z));
  for (const y of [h * 0.45, h - 0.06]) {
    g.add(box(s * 2 + 0.12, 0.08, 0.1, C.wood, 0, y, -s));
    g.add(box(s * 2 + 0.12, 0.08, 0.1, C.wood, 0, y, s));
    g.add(box(0.1, 0.08, s * 2 + 0.12, C.wood, -s, y, 0));
    g.add(box(0.1, 0.08, s * 2 + 0.12, C.wood, s, y, 0));
  }
  g.add(box(s * 1.2, 0.3, s * 0.8, C.stone, -s * 0.2, 0.06, 0.1));
  g.add(box(0.5, 0.2, 0.3, C.woodLight, s * 0.5, 0.06, s * 0.5));
  return g;
}

export function rubble(size) {
  const g = group(box(size * 0.85, 0.05, size * 0.85, '#5a4a3a', 0, 0, 0));
  const n = size * 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i;
    const r = (0.2 + ((i * 37) % 10) / 25) * size * 0.4;
    g.add(rock(0.12 + (i % 3) * 0.07 * size * 0.5, i % 2 ? '#6b6158' : '#4a423b', Math.cos(a) * r, 0.08, Math.sin(a) * r));
  }
  return bake(g);
}

export function buildingModel(type, level) {
  const make = BUILD_FNS[type];
  const g = make ? make(level) : box(1, 1, 1, '#ff00ff');
  return bake(g);
}

const BUILD_FNS = {
  townhall, goldmine, elixircollector, goldstorage, elixirstorage, house, builderhut, barracks, armycamp, laboratory,
  cannon, archertower, mortar, airdefense, wizardtower,
};

// ---------- obstacles ----------
export function obstacleModel(type, seed = 0) {
  const g = new THREE.Group();
  const j = (k) => (((seed * 9301 + k * 49297) % 233280) / 233280 - 0.5) * 0.3;
  if (type === 'tree') {
    g.add(cyl(0.14, 0.2, 0.8, C.woodDark, j(1), 0, j(2), 6));
    g.add(sphere(0.75, '#3f8f2f', j(1), 1.2, j(2), 7, 5));
    g.add(sphere(0.55, '#4fa53a', j(1) + 0.25, 1.65, j(2) - 0.1, 7, 5));
  } else if (type === 'pine') {
    g.add(cyl(0.12, 0.16, 0.5, C.woodDark, 0, 0, 0, 6));
    g.add(cone(0.85, 1.1, '#2f6e34', 0, 0.4, 0, 7));
    g.add(cone(0.65, 0.9, '#3a8040', 0, 1.05, 0, 7));
    g.add(cone(0.42, 0.7, '#459048', 0, 1.6, 0, 7));
  } else if (type === 'rock') {
    g.add(rock(0.6, '#9a958c', j(1), 0.35, j(2)));
    g.add(rock(0.38, '#aaa59b', 0.45 + j(3), 0.2, 0.35));
    g.add(rock(0.25, '#8a857c', -0.45, 0.15, 0.4 + j(4)));
  } else {
    g.add(sphere(0.38, '#4c9a34', 0, 0.28, 0, 7, 5));
    g.add(sphere(0.28, '#5bb040', 0.2, 0.35, 0.12, 7, 5));
    g.add(sphere(0.06, '#e04848', 0.1, 0.6, 0.2, 5, 4));
  }
  return bake(g);
}

// ---------- characters ----------
// Simple chunky humanoid. Returns a group with userData.rig for animation.
export function humanoid({ skin, shirt, pants, hair, scale = 1, hairStyle = 0, beard = null, bareChest = false, hat = null }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.add(box(0.13, 0.3, 0.14, pants, 0, -0.3, 0));
  legR.add(box(0.13, 0.3, 0.14, pants, 0, -0.3, 0));
  legL.position.set(-0.08, 0.3, 0);
  legR.position.set(0.08, 0.3, 0);
  body.add(box(0.34, 0.34, 0.22, bareChest ? skin : shirt, 0, 0.3, 0));
  body.add(box(0.36, 0.06, 0.24, pants, 0, 0.3, 0));
  body.add(box(0.26, 0.26, 0.26, skin, 0, 0.66, 0));
  if (hair) {
    if (hairStyle === 1) body.add(box(0.3, 0.12, 0.3, hair, 0, 0.86, 0));
    else if (hairStyle === 2) body.add(box(0.3, 0.22, 0.14, hair, 0, 0.72, -0.1));
    else body.add(box(0.3, 0.08, 0.3, hair, 0, 0.88, 0));
  }
  if (beard) body.add(box(0.27, 0.12, 0.08, beard, 0, 0.6, 0.13));
  if (hat) body.add(cyl(0.18, 0.2, 0.12, hat, 0, 0.9, 0, 8));
  body.add(box(0.05, 0.05, 0.02, '#1a1a1a', -0.06, 0.72, 0.135));
  body.add(box(0.05, 0.05, 0.02, '#1a1a1a', 0.06, 0.72, 0.135));
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.add(box(0.1, 0.3, 0.1, bareChest ? skin : shirt, 0, -0.28, 0));
  armR.add(box(0.1, 0.3, 0.1, bareChest ? skin : shirt, 0, -0.28, 0));
  armL.position.set(-0.23, 0.6, 0);
  armR.position.set(0.23, 0.6, 0);
  body.add(armL, armR);
  body.position.y = 0.3;
  g.add(body, legL, legR);
  g.scale.setScalar(scale);
  g.userData.rig = { body, legL, legR, armL, armR };
  return g;
}

function wizardFigure(scale) {
  const g = new THREE.Group();
  g.add(cone(0.3, 0.75, '#3b5bd6', 0, 0, 0, 8));
  g.add(box(0.24, 0.24, 0.24, '#f1c27d', 0, 0.72, 0));
  g.add(box(0.26, 0.2, 0.06, '#e8e8e8', 0, 0.62, 0.12));
  g.add(cone(0.22, 0.45, '#2a3f9a', 0, 0.86, 0, 8));
  const staff = box(0.05, 0.9, 0.05, C.woodDark, 0.25, 0.1, 0.1);
  g.add(staff);
  g.add(sphere(0.08, '#ff9d2e', 0.25, 1.03, 0.1, 6, 4, { emissive: '#aa4400' }));
  g.scale.setScalar(scale);
  return g;
}

function weapon(rig, part) {
  rig.armR.add(part);
}

export function troopModel(type) {
  let g;
  switch (type) {
    case 'barbarian': {
      g = humanoid({ skin: '#f1c27d', shirt: '#f1c27d', pants: '#7a4a22', hair: '#f2c437', bareChest: true, beard: '#f2c437', scale: 0.85, hairStyle: 1 });
      const sword = box(0.06, 0.55, 0.1, '#d8d8e0', 0, -0.75, 0.12);
      sword.rotation.x = 1.3;
      weapon(g.userData.rig, sword);
      break;
    }
    case 'archer': {
      g = humanoid({ skin: '#f1c27d', shirt: '#3c8d3c', pants: '#2e5e2e', hair: '#e0459a', scale: 0.8, hairStyle: 2 });
      const bow = mesh(cachedGeo('bow', () => new THREE.TorusGeometry(0.25, 0.025, 4, 8, Math.PI)), C.woodDark);
      bow.position.set(0, -0.4, 0.12);
      bow.rotation.z = Math.PI / 2;
      g.userData.rig.armL.add(bow);
      break;
    }
    case 'giant': {
      g = humanoid({ skin: '#f1c27d', shirt: '#8a5a2b', pants: '#5a3a1a', hair: '#e2732a', beard: '#e2732a', scale: 1.5 });
      break;
    }
    case 'goblin': {
      g = humanoid({ skin: '#6fcf4a', shirt: '#6fcf4a', pants: '#7a4a22', hair: null, bareChest: true, scale: 0.65 });
      const { body } = g.userData.rig;
      const e1 = cone(0.06, 0.22, '#5cb83a', -0.17, 0.66, 0, 4);
      e1.rotation.z = 1.2;
      const e2 = cone(0.06, 0.22, '#5cb83a', 0.17, 0.66, 0, 4);
      e2.rotation.z = -1.2;
      body.add(e1, e2);
      body.add(box(0.12, 0.12, 0.1, C.gold, 0, 0.25, -0.17));
      break;
    }
    case 'wallbreaker': {
      g = humanoid({ skin: '#ecebe4', shirt: '#ecebe4', pants: '#ecebe4', hair: null, bareChest: true, scale: 0.7 });
      const bomb = sphere(0.24, C.ironDark, 0, 0.55, -0.15, 8, 6);
      g.userData.rig.body.add(bomb);
      g.userData.rig.body.add(cyl(0.03, 0.03, 0.15, C.woodLight, 0, 0.78, -0.15, 4));
      g.userData.rig.body.add(sphere(0.05, '#ffcc33', 0, 0.95, -0.15, 5, 4, { emissive: '#ff8800' }));
      break;
    }
    case 'wizard': {
      g = humanoid({ skin: '#f1c27d', shirt: '#3b5bd6', pants: '#2a3f9a', hair: null, beard: '#ddd', scale: 0.85 });
      const { body } = g.userData.rig;
      body.add(cone(0.22, 0.45, '#2a3f9a', 0, 0.78, 0, 8));
      const staffOrb = sphere(0.08, '#ff9d2e', 0, -0.5, 0.1, 6, 4, { emissive: '#aa4400' });
      weapon(g.userData.rig, staffOrb);
      break;
    }
    case 'balloon': {
      g = new THREE.Group();
      const b = sphere(0.7, '#5a4632', 0, 1.15, 0, 10, 8);
      g.add(b);
      g.add(cyl(0.72, 0.72, 0.12, '#c8402f', 0, 1.0, 0, 10));
      g.add(box(0.5, 0.3, 0.5, C.woodDark, 0, 0, 0));
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(box(0.02, 0.6, 0.02, '#ccc', x, 0.3, z));
      g.add(sphere(0.12, '#ecebe4', 0, 0.4, 0, 6, 4));
      g.add(sphere(0.15, C.ironDark, 0, -0.1, 0, 6, 4));
      g.userData.rig = null;
      break;
    }
    case 'dragon': {
      g = new THREE.Group();
      const red = '#d6402a';
      g.add(sphereScaled(0.55, red, [1, 0.8, 1.4], 0, 0, 0));
      g.add(sphere(0.32, red, 0, 0.35, 0.75, 8, 6));
      g.add(cone(0.06, 0.25, '#f2e2b0', -0.15, 0.55, 0.7, 4));
      g.add(cone(0.06, 0.25, '#f2e2b0', 0.15, 0.55, 0.7, 4));
      const tail = cone(0.2, 0.9, red, 0, 0, 0, 6);
      tail.rotation.x = -Math.PI / 2;
      tail.position.set(0, 0, -0.95);
      g.add(tail);
      const wingL = new THREE.Group();
      const wingR = new THREE.Group();
      wingL.add(box(1.1, 0.04, 0.7, '#a82a1a', -0.55, 0, 0));
      wingR.add(box(1.1, 0.04, 0.7, '#a82a1a', 0.55, 0, 0));
      wingL.position.set(-0.3, 0.2, 0);
      wingR.position.set(0.3, 0.2, 0);
      g.add(wingL, wingR);
      g.userData.rig = { wingL, wingR };
      g.scale.setScalar(1.1);
      break;
    }
    default:
      g = humanoid({ skin: '#f1c27d', shirt: '#888', pants: '#444', hair: '#333' });
  }
  return g;
}

function sphereScaled(r, color, s, x, y, z) {
  const m = sphere(r, color, x, y, z, 10, 8);
  m.scale.set(...s);
  return m;
}

export function villagerModel(look, jobColor = null) {
  return humanoid({
    skin: look.skin,
    shirt: look.shirt,
    pants: look.pants,
    hair: look.hair,
    hairStyle: look.hairStyle,
    hat: jobColor,
    scale: 0.62,
  });
}

// ---------- projectiles ----------
export function projectileModel(kind) {
  switch (kind) {
    case 'arrow': {
      const g = new THREE.Group();
      const a = box(0.04, 0.04, 0.45, '#6e4320', 0, -0.02, 0);
      g.add(a);
      const tip = cone(0.05, 0.1, '#ccc', 0, 0, 0.25, 4);
      tip.rotation.x = Math.PI / 2;
      g.add(tip);
      return g;
    }
    case 'ball':
      return sphere(0.16, '#1c1c1c', 0, 0, 0, 8, 6);
    case 'shell':
      return sphere(0.24, '#2a2a2a', 0, 0, 0, 8, 6);
    case 'orb':
      return sphere(0.2, '#b06bff', 0, 0, 0, 8, 6, { emissive: '#6a20c0' });
    case 'fireball':
      return sphere(0.2, '#ff8a1e', 0, 0, 0, 8, 6, { emissive: '#ff5500' });
    case 'rocket': {
      const g = new THREE.Group();
      const c = cone(0.09, 0.35, '#d6402a', 0, -0.17, 0, 6);
      c.rotation.x = Math.PI / 2;
      g.add(c);
      return g;
    }
    case 'bomb':
      return sphere(0.18, '#1c1c1c', 0, 0, 0, 8, 6);
    default:
      return sphere(0.12, '#fff', 0, 0, 0, 6, 4);
  }
}
