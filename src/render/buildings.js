// Detailed procedural building models. Each model sits on y = 0 with its footprint
// centered on the origin; +z is the front. Levels change materials, trims and parts.

import * as THREE from 'three';
import {
  mat, mesh, box, rbox, cyl, cylX, cylZ, cone, sphere, dome, rock, gem, torus, gable, hipRoof, group, at, dyn, bake,
} from './kit.js';
import { blobTexture } from './textures.js';
import { BUILDINGS } from '../data/buildings.js';

// ---------- palette ----------
export const C = {
  stone: '#e2dccf',
  stoneWarm: '#ead9b8',
  stoneDark: '#a39c90',
  darkStone: '#8a8594',
  wood: '#c07c45',
  woodDark: '#86532a',
  woodLight: '#dca468',
  plaster: '#fbf1dc',
  thatch: '#f0cd73',
  roofRed: '#e05a3e',
  roofBlue: '#4f86df',
  roofPurple: '#9a5ad6',
  roofGreen: '#4f9a52',
  gold: '#ffd03f',
  goldDark: '#d9a018',
  iron: '#7a7f8c',
  ironDark: '#454852',
  glassDark: '#2d3550',
  dirt: '#d2ad74',
  cobble: '#e0d2b4',
  elixir: '#e451e0',
  canvas: '#f4ead2',
  black: '#1d1610',
};

const ST = { tex: 'stone' };
const PL = { tex: 'plank' };
const SH = { tex: 'shingle' };
const TH = { tex: 'thatch' };
const MT = { tex: 'metal' };
const PS = { tex: 'plaster' };
const BR = { tex: 'brick' };
const GLOW = (c) => ({ emissive: c, emissiveIntensity: 0.7 });

// ---------- shared details ----------
function basePad(size, kind = 'dirt') {
  const s = size * 0.94;
  if (kind === 'cobble') return rbox(s, 0.08, s, C.cobble, 0, 0, 0, { tex: 'cobble', r: 0.04 });
  return rbox(s, 0.07, s, C.dirt, 0, 0, 0, { tex: 'dirt', r: 0.035 });
}

// Window facing +z, bottom at y = 0.
function windowPane(w = 0.32, h = 0.4, frame = C.woodDark, lit = false) {
  const glass = lit ? mat('#ffd98a', GLOW('#ff9d2e')) : C.glassDark;
  return group(
    box(w + 0.1, h + 0.1, 0.06, frame, 0, -0.05, 0),
    box(w, h, 0.07, glass, 0, 0, 0.005),
    box(0.035, h, 0.09, frame, 0, 0, 0.01),
    box(w, 0.035, 0.09, frame, 0, h / 2 - 0.017, 0.01),
    box(w + 0.18, 0.06, 0.14, C.stoneDark, 0, -0.1, 0.03),
  );
}

// Arched plank door facing +z, bottom at y = 0.
function archDoor(w = 0.6, h = 0.9, frame = C.stone, wood = C.wood) {
  const r = w / 2;
  return group(
    rbox(w + 0.18, h + 0.1, 0.1, frame, 0, 0, -0.02, { ...ST, r: 0.03 }),
    box(w, h - r, 0.1, wood, 0, 0, 0.02, PL),
    cylZ(r, 0.1, wood, 0, h - r, 0.02, 12, PL),
    box(w * 0.75, 0.05, 0.12, C.ironDark, -w * 0.05, h * 0.22, 0.03),
    box(w * 0.75, 0.05, 0.12, C.ironDark, -w * 0.05, h * 0.62, 0.03),
    sphere(0.035, C.gold, w * 0.3, h * 0.42, 0.09, 6, 4),
  );
}

// A pole with a waving flag (the cloth is an animated part named 'flag').
function flagPole(color, h = 1.1, x = 0, y = 0, z = 0) {
  const cloth = dyn(new THREE.Group(), 'flag');
  cloth.add(box(0.5, 0.3, 0.03, color, 0.27, -0.32, 0));
  cloth.add(box(0.12, 0.12, 0.035, C.gold, 0.27, -0.25, 0));
  cloth.position.y = h;
  return at(group(cyl(0.035, 0.04, h, C.woodDark, 0, 0, 0, 6), sphere(0.06, C.gold, 0, h + 0.04, 0, 6, 4), cloth), x, y, z);
}

// Hanging banner facing +z; top of the rod at y = 0.
function banner(color, w = 0.42, h = 0.7, trim = C.gold) {
  const tip = cone(w * 0.36, w * 0.3, color, 0, -h - w * 0.3, 0, 3);
  tip.rotation.set(Math.PI, 0, 0);
  tip.scale.z = 0.12;
  tip.position.y = -h + 0.01;
  return group(
    cylX(0.03, w + 0.16, C.woodDark, 0, 0, 0.02, 6),
    box(w, h, 0.03, color, 0, -h, 0),
    tip,
    cylZ(w * 0.22, 0.045, trim, 0, -h * 0.45, 0.02, 10),
    box(w, 0.05, 0.04, trim, 0, -0.08, 0.005),
  );
}

// Battlements along the edge of a w x d rectangle at height y.
function crenels(w, d, y, color, opts = ST, size = 0.24) {
  const g = new THREE.Group();
  const nx = Math.max(2, Math.round(w / (size * 1.9)));
  const nz = Math.max(2, Math.round(d / (size * 1.9)));
  for (let i = 0; i < nx; i++) {
    const x = -w / 2 + size / 2 + (i * (w - size)) / (nx - 1);
    g.add(rbox(size, size, size * 0.9, color, x, y, -d / 2 + size * 0.45, { ...opts, r: 0.03 }));
    g.add(rbox(size, size, size * 0.9, color, x, y, d / 2 - size * 0.45, { ...opts, r: 0.03 }));
  }
  for (let i = 1; i < nz - 1; i++) {
    const z = -d / 2 + size / 2 + (i * (d - size)) / (nz - 1);
    g.add(rbox(size * 0.9, size, size, color, -w / 2 + size * 0.45, y, z, { ...opts, r: 0.03 }));
    g.add(rbox(size * 0.9, size, size, color, w / 2 - size * 0.45, y, z, { ...opts, r: 0.03 }));
  }
  return g;
}

function roundCrenels(r, y, color, n = 10, size = 0.22, opts = ST) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = rbox(size, size, size * 0.8, color, Math.cos(a) * r, y, Math.sin(a) * r, { ...opts, r: 0.03 });
    m.rotation.y = -a;
    g.add(m);
  }
  return g;
}

// Exposed timber beams on the outside of a w x h x d box (Tudor style).
function timberFrame(w, h, d, y = 0, color = C.woodDark, braces = true) {
  const g = new THREE.Group();
  const t = 0.08;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(t * 1.4, h, t * 1.4, color, x, y, z));
  for (const yy of [y, y + h - t, y + h * 0.5]) {
    g.add(box(w + 0.04, t, t, color, 0, yy, d / 2 + 0.01));
    g.add(box(w + 0.04, t, t, color, 0, yy, -d / 2 - 0.01));
    g.add(box(t, t, d + 0.04, color, w / 2 + 0.01, yy, 0));
    g.add(box(t, t, d + 0.04, color, -w / 2 - 0.01, yy, 0));
  }
  if (braces) {
    const len = Math.hypot(w * 0.28, h * 0.5);
    const ang = Math.atan2(h * 0.5, w * 0.28);
    for (const side of [1, -1]) {
      for (const sx of [-1, 1]) {
        const b = box(t * 0.8, len, t * 0.8, color, 0, 0, 0);
        b.position.set(sx * (w / 2 - w * 0.14), y + h * 0.75, side * (d / 2 + 0.015));
        b.rotation.z = sx * (Math.PI / 2 - ang);
        g.add(b);
      }
    }
  }
  return g;
}

function chimney(x, y, z, h = 0.9, color = C.stoneDark) {
  return group(rbox(0.3, h, 0.3, color, x, y, z, { ...BR, r: 0.03 }), rbox(0.38, 0.1, 0.38, color, x, y + h, z, { ...ST, r: 0.03 }));
}

function lantern(x, y, z) {
  return group(box(0.12, 0.16, 0.12, mat('#ffd36b', GLOW('#ffa020')), x, y, z), box(0.16, 0.04, 0.16, C.ironDark, x, y + 0.16, z), box(0.02, 0.1, 0.02, C.ironDark, x, y + 0.2, z));
}

function barrel(x, y, z, h = 0.38, r = 0.17) {
  return group(cyl(r * 0.9, r * 0.9, h, C.wood, x, y, z, 10, PL), torus(r * 0.93, 0.02, C.ironDark, x, y + h * 0.2, z, 12), torus(r * 0.93, 0.02, C.ironDark, x, y + h * 0.8, z, 12));
}

function crate(x, y, z, s = 0.32, ry = 0) {
  const g = group(rbox(s, s, s, C.woodLight, 0, 0, 0, { ...PL, r: 0.02 }), box(s + 0.02, 0.04, s + 0.02, C.woodDark, 0, s * 0.45, 0));
  return at(g, x, y, z, ry);
}

// Little archer / wizard figures that stand on top of towers.
function archerFigure(scale = 0.55) {
  const g = new THREE.Group();
  g.add(rbox(0.3, 0.36, 0.22, '#3c8d3c', 0, 0.3, 0, { r: 0.05 }));
  g.add(box(0.12, 0.3, 0.14, '#2e5e2e', -0.08, 0, 0), box(0.12, 0.3, 0.14, '#2e5e2e', 0.08, 0, 0));
  g.add(rbox(0.26, 0.26, 0.26, '#f1c27d', 0, 0.66, 0, { r: 0.05 }));
  g.add(rbox(0.3, 0.12, 0.3, '#e0459a', 0, 0.86, -0.02, { r: 0.04 }), box(0.3, 0.26, 0.1, '#e0459a', 0, 0.62, -0.14));
  const bow = mesh(new THREE.TorusGeometry(0.28, 0.025, 4, 10, Math.PI), C.woodDark);
  bow.rotation.z = Math.PI / 2;
  bow.position.set(0.22, 0.5, 0.2);
  g.add(bow);
  g.scale.setScalar(scale);
  return g;
}

function wizardFigure(scale = 0.6) {
  const g = new THREE.Group();
  g.add(cone(0.32, 0.8, '#3b5bd6', 0, 0, 0, 10));
  g.add(rbox(0.26, 0.26, 0.26, '#f1c27d', 0, 0.72, 0, { r: 0.05 }));
  g.add(cone(0.16, 0.26, '#eeeeee', 0, 0.5, 0.11, 6));
  g.add(cone(0.24, 0.5, '#2a3f9a', 0, 0.88, 0, 10));
  g.add(cyl(0.025, 0.025, 1.0, C.woodDark, 0.28, 0.0, 0.12, 5));
  g.add(sphere(0.09, mat('#ffb04a', GLOW('#ff6a00')), 0.28, 1.06, 0.12, 8, 6));
  g.scale.setScalar(scale);
  return g;
}

// ---------- Town Hall ----------
const TH_STYLE = [
  { walls: 'plank', roof: C.thatch, roofOpts: TH, towers: 0, h: 1.35, flag: C.roofRed },
  { walls: 'timber', roof: C.roofRed, roofOpts: SH, towers: 0, h: 1.45, flag: C.roofRed, dormer: true },
  { walls: 'stoneTimber', roof: C.roofRed, roofOpts: SH, towers: 2, h: 1.55, flag: C.roofRed, dormer: true, banners: C.roofRed },
  { walls: 'stoneTimber', roof: C.roofRed, roofOpts: SH, towers: 4, h: 1.6, flag: C.roofBlue, dormer: true, banners: C.roofBlue, gold: true },
  { walls: 'stone', roof: C.roofBlue, roofOpts: SH, towers: 4, h: 1.7, flag: C.roofBlue, keep: true, banners: C.roofBlue, gold: true },
  { walls: 'dark', roof: C.roofPurple, roofOpts: SH, towers: 4, h: 1.8, flag: C.roofPurple, keep: true, banners: C.roofPurple, gold: true },
];

function townhall(level) {
  const S = TH_STYLE[Math.min(TH_STYLE.length, level) - 1];
  const stoneC = S.walls === 'dark' ? C.darkStone : C.stone;
  const g = group(basePad(4, 'cobble'));
  const zc = -0.15;
  const bw = 2.6, bd = 2.3;
  const y0 = 0.42;
  const h = S.h;
  // foundation and front steps
  g.add(rbox(3.4, y0, 3.0, S.walls === 'plank' ? C.stoneDark : stoneC, 0, 0, zc, { ...ST, r: 0.08 }));
  g.add(rbox(1.1, 0.28, 0.32, stoneC, 0, 0, zc + 1.62, ST), rbox(1.1, 0.14, 0.3, stoneC, 0, 0, zc + 1.88, ST));

  // walls
  if (S.walls === 'plank') {
    g.add(rbox(bw, h, bd, C.wood, 0, y0, zc, { ...PL, r: 0.04 }));
    for (const [x, z] of [[-bw / 2, -bd / 2], [bw / 2, -bd / 2], [-bw / 2, bd / 2], [bw / 2, bd / 2]]) g.add(rbox(0.22, h, 0.22, C.woodDark, x, y0, z + zc, PL));
  } else if (S.walls === 'timber') {
    g.add(rbox(bw, h, bd, C.plaster, 0, y0, zc, { ...PS, r: 0.03 }));
    g.add(at(timberFrame(bw, h, bd, 0), 0, y0, zc));
  } else if (S.walls === 'stoneTimber') {
    const lh = h * 0.5;
    g.add(rbox(bw + 0.08, lh, bd + 0.08, stoneC, 0, y0, zc, { ...ST, r: 0.04 }));
    g.add(rbox(bw + 0.2, h - lh, bd + 0.2, C.plaster, 0, y0 + lh, zc, { ...PS, r: 0.03 }));
    g.add(at(timberFrame(bw + 0.2, h - lh, bd + 0.2, 0, C.woodDark, false), 0, y0 + lh, zc));
    g.add(rbox(bw + 0.3, 0.1, bd + 0.3, C.woodDark, 0, y0 + lh - 0.05, zc, PL));
  } else {
    g.add(rbox(bw, h, bd, stoneC, 0, y0, zc, { ...ST, r: 0.04 }));
    // corner quoins
    for (const [x, z] of [[-bw / 2, -bd / 2], [bw / 2, -bd / 2], [-bw / 2, bd / 2], [bw / 2, bd / 2]]) {
      for (let i = 0; i < 4; i++) g.add(rbox(0.3, h / 4 - 0.04, 0.3, i % 2 ? C.stoneDark : stoneC, x, y0 + i * (h / 4) + 0.02, z + zc, { ...ST, r: 0.03 }));
    }
    if (S.gold) g.add(rbox(bw + 0.06, 0.1, bd + 0.06, C.gold, 0, y0 + h * 0.55, zc, MT));
  }

  // door and windows
  g.add(at(archDoor(0.66, 0.98, S.walls === 'plank' ? C.woodDark : stoneC), 0, y0, zc + bd / 2 + (S.walls === 'stoneTimber' ? 0.05 : 0.02)));
  const lit = level >= 3;
  for (const x of [-0.82, 0.82]) {
    g.add(at(windowPane(0.32, 0.38, C.woodDark, lit), x, y0 + 0.55, zc + bd / 2 + 0.04));
    if (h > 1.5) g.add(at(windowPane(0.28, 0.32, C.woodDark, lit), x, y0 + h - 0.5, zc + bd / 2 + 0.12));
  }
  for (const side of [-1, 1]) {
    g.add(at(windowPane(0.32, 0.38, C.woodDark, lit), side * (bw / 2 + 0.04), y0 + 0.6, zc, (side * Math.PI) / 2));
  }
  if (S.banners) for (const x of [-1.13, 1.13]) g.add(at(banner(S.banners, 0.24, 0.55), x, y0 + h - 0.12, zc + bd / 2 + 0.16));

  // roof
  let top = y0 + h;
  if (S.keep) {
    g.add(crenels(bw + 0.25, bd + 0.25, top, stoneC, ST, 0.26).translateZ(zc));
    g.add(rbox(bw + 0.25, 0.12, bd + 0.25, stoneC, 0, top - 0.06, zc, ST));
    g.add(rbox(1.6, 0.75, 1.5, stoneC, 0, top, zc - 0.05, { ...ST, r: 0.04 }));
    g.add(at(windowPane(0.26, 0.3, C.woodDark, true), 0, top + 0.25, zc + 0.72));
    top += 0.75;
    g.add(rbox(1.95, 0.1, 1.85, S.gold ? C.gold : C.woodDark, 0, top - 0.04, zc - 0.05, MT));
    g.add(hipRoof(1.95, 1.25, 1.85, S.roof, 0, top, zc - 0.05, S.roofOpts));
    top += 1.25;
  } else {
    g.add(rbox(bw + 0.62, 0.1, bd + 0.62, S.gold ? C.gold : C.woodDark, 0, top - 0.04, zc, S.gold ? MT : PL));
    g.add(hipRoof(bw + 0.6, 1.45, bd + 0.6, S.roof, 0, top, zc, S.roofOpts));
    if (S.dormer) {
      const dz = zc + bd / 2 - 0.05;
      g.add(rbox(0.62, 0.5, 0.5, C.plaster, 0, top + 0.05, dz - 0.15, PS));
      g.add(at(windowPane(0.24, 0.28, C.woodDark, lit), 0, top + 0.17, dz + 0.11));
      g.add(at(gable(0.66, 0.38, 0.76, S.roof, 0, 0, 0, S.roofOpts), 0, top + 0.55, dz - 0.18, Math.PI / 2));
    }
    g.add(chimney(0.75, top - 0.2, zc - 0.55, 1.0));
    top += 1.45;
  }
  g.add(cone(0.08, 0.3, S.gold ? C.gold : C.woodDark, 0, top - 0.08, zc - (S.keep ? 0.05 : 0), 6));
  g.add(flagPole(S.flag, 0.9, 0, top + 0.1, zc - (S.keep ? 0.05 : 0)));

  // towers
  const tw = [];
  if (S.towers >= 2) tw.push([-1.45, zc + 1.25], [1.45, zc + 1.25]);
  if (S.towers >= 4) tw.push([-1.45, zc - 1.2], [1.45, zc - 1.2]);
  for (const [x, z] of tw) {
    const th = y0 + h + 0.55;
    g.add(cyl(0.4, 0.46, th, stoneC, x, 0, z, 10, ST));
    g.add(torus(0.42, 0.04, C.stoneDark, x, th * 0.45, z, 12));
    g.add(cyl(0.5, 0.42, 0.18, stoneC, x, th, z, 10, ST));
    g.add(cone(0.56, 1.0, S.roof, x, th + 0.17, z, 10, S.roofOpts));
    g.add(sphere(0.07, S.gold ? C.gold : C.woodDark, x, th + 1.22, z, 6, 4));
    const a = Math.atan2(x, z - zc);
    g.add(at(box(0.1, 0.3, 0.06, C.glassDark), x + Math.sin(a) * 0.43, th * 0.62, z + Math.cos(a) * 0.43, a));
  }
  if (level >= 4) g.add(barrel(1.6, 0.08, zc + 1.6), crate(-1.6, 0.08, zc + 1.62, 0.3, 0.3));
  return g;
}

// ---------- resources ----------
function goldmine(level) {
  const g = group(basePad(3));
  const rockC = ['#b09c83', '#a8957d', '#a0917e', '#9a8e80', '#958b80', '#8f8790'][level - 1];
  const rocks = [[-0.45, 0.55, -0.6, 1.0], [0.6, 0.45, -0.7, 0.75], [-1.0, 0.32, -0.15, 0.55], [0.15, 1.05, -0.8, 0.65], [1.0, 0.25, 0.0, 0.42]];
  for (const [x, y, z, r] of rocks) {
    const m = rock(r, rockC, x, y, z, 0);
    m.rotation.set(x * 2, z * 3, y);
    g.add(m);
  }
  // gold veins
  const veins = [[-0.75, 0.85, -0.15], [0.85, 0.7, -0.3], [-0.2, 1.4, -0.35], [0.4, 1.15, -0.25], [-1.25, 0.45, 0.15], [1.2, 0.4, 0.2], [-0.4, 1.0, 0.05], [0.95, 0.95, -0.6]];
  for (const [x, y, z] of veins.slice(0, 2 + level)) g.add(gem(0.13, mat(C.gold, GLOW('#7a5000')), x, y, z));
  // tunnel entrance
  const frameC = level >= 5 ? C.iron : C.wood;
  const fo = level >= 5 ? MT : PL;
  g.add(box(0.72, 0.85, 0.4, C.black, 0, 0.05, -0.05));
  g.add(rbox(0.15, 1.0, 0.15, frameC, -0.43, 0.05, 0.12, fo), rbox(0.15, 1.0, 0.15, frameC, 0.43, 0.05, 0.12, fo));
  g.add(rbox(1.12, 0.17, 0.22, frameC, 0, 1.0, 0.12, fo));
  for (const sx of [-1, 1]) {
    const b = box(0.08, 0.36, 0.08, frameC, sx * 0.3, 0.75, 0.18, fo);
    b.rotation.z = sx * 0.8;
    g.add(b);
  }
  if (level >= 2) g.add(lantern(0.43, 0.8, 0.28));
  // rails and cart
  for (const x of [-0.17, 0.17]) g.add(box(0.05, 0.05, 1.4, C.iron, x, 0.09, 0.78, MT));
  for (let i = 0; i < 6; i++) g.add(box(0.56, 0.035, 0.1, C.woodDark, 0, 0.07, 0.15 + i * 0.25, PL));
  const cart = group(
    rbox(0.62, 0.32, 0.48, C.wood, 0, 0.12, 0, { ...PL, r: 0.03 }),
    box(0.66, 0.05, 0.52, C.ironDark, 0, 0.42, 0),
    box(0.66, 0.05, 0.52, C.ironDark, 0, 0.15, 0),
    cone(0.27, 0.2, C.gold, 0, 0.44, 0, 7),
    gem(0.08, C.gold, 0.12, 0.6, 0.05),
    gem(0.07, C.gold, -0.1, 0.58, -0.08),
  );
  for (const x of [-0.33, 0.33]) for (const z of [-0.15, 0.15]) cart.add(cylX(0.1, 0.06, C.ironDark, x, 0.13, z, 10));
  g.add(at(cart, 0, 0, 1.0, 0));
  // winch wheel
  const wheel = dyn(new THREE.Group(), 'spin');
  const rim = mesh(new THREE.TorusGeometry(0.36, 0.05, 5, 14), C.woodDark);
  wheel.add(rim);
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI) / 4;
    holder.add(box(0.06, 0.7, 0.05, C.wood, 0, -0.35, 0));
    wheel.add(holder);
  }
  wheel.add(cylZ(0.07, 0.2, C.iron, 0, 0, 0, 8));
  wheel.position.set(1.12, 0.95, -0.15);
  wheel.rotation.y = Math.PI / 2;
  g.add(wheel);
  g.add(rbox(0.12, 1.0, 0.12, C.woodDark, 1.12, 0, -0.38, PL), rbox(0.12, 1.0, 0.12, C.woodDark, 1.12, 0, 0.08, PL));
  if (level >= 3) g.add(at(gable(0.7, 0.3, 0.75, C.roofRed, 0, 0, 0, SH), 1.12, 1.33, -0.15, Math.PI / 2));
  // gold on the ground
  const piles = [[0.85, 0.75], [-0.85, 0.85], [-1.1, 1.1], [1.15, 1.15], [0.6, 1.25]];
  for (const [x, z] of piles.slice(0, 1 + Math.ceil(level / 2))) g.add(gem(0.14, C.gold, x, 0.14, z), gem(0.1, C.goldDark, x + 0.15, 0.1, z - 0.1));
  if (level >= 4) g.add(flagPole(C.gold, 1.2, -1.25, 0.05, -1.2));
  return g;
}

function elixircollector(level) {
  const g = group(basePad(3));
  const metal = level >= 5 ? C.gold : C.iron;
  if (level <= 2) g.add(rbox(2.3, 0.26, 2.3, C.wood, 0, 0.05, 0, { ...PL, r: 0.05 }));
  else g.add(cyl(1.15, 1.25, 0.32, C.stone, 0, 0.05, 0, 12, ST));
  if (level >= 5) g.add(torus(1.2, 0.05, C.gold, 0, 0.36, 0, 20));
  const legC = level >= 3 ? C.iron : C.woodDark;
  for (const [x, z] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.3, z);
    holder.rotation.set(-z * 0.13, 0, x * 0.13);
    holder.add(rbox(0.15, 1.55, 0.15, legC, 0, 0, 0, level >= 3 ? MT : PL));
    g.add(holder);
  }
  g.add(torus(0.62, 0.07, metal, 0, 1.78, 0, 18, MT));
  const glass = sphere(0.8, mat('#f5c9ff', { transparent: true, opacity: 0.42, smooth: true, depthWrite: false }), 0, 2.3, 0, 20, 14);
  glass.castShadow = false;
  g.add(glass);
  const liquid = sphere(0.68, mat(C.elixir, { ...GLOW('#6a1070'), smooth: true }), 0, 2.27, 0, 18, 12);
  liquid.name = 'liquid';
  g.add(dyn(group(liquid)));
  const band = mesh(new THREE.TorusGeometry(0.81, 0.05, 5, 22), metal);
  band.position.y = 2.3;
  g.add(band);
  const band2 = mesh(new THREE.TorusGeometry(0.81, 0.04, 5, 22), metal);
  band2.position.y = 2.3;
  band2.rotation.x = Math.PI / 2;
  g.add(band2);
  g.add(cyl(0.22, 0.32, 0.3, metal, 0, 2.98, 0, 10, MT), cyl(0.08, 0.08, 0.3, metal, 0, 3.25, 0, 6), sphere(0.1, metal, 0, 3.6, 0, 8, 6));
  g.add(cyl(0.09, 0.09, 1.5, C.ironDark, 0, 0.3, 0, 8));
  // pump
  const pump = dyn(new THREE.Group(), 'pump');
  pump.add(rbox(1.3, 0.1, 0.12, C.wood, 0.35, 0, 0, PL));
  pump.add(box(0.1, 0.5, 0.1, C.iron, 0.95, -0.48, 0, MT));
  pump.position.set(0.3, 1.0, 1.0);
  g.add(rbox(0.14, 1.0, 0.14, C.woodDark, 0.3, 0.05, 1.0, PL), pump);
  const puddle = cyl(0.2, 0.24, 0.02, mat('#c9579a', GLOW('#40102a')), 1.05, 0.06, 1.1, 12);
  puddle.castShadow = false;
  g.add(puddle);
  if (level >= 4) for (const [x, z] of [[-1.15, 1.1], [1.15, -1.1], [-1.1, -1.1]]) g.add(gem(0.14, mat('#ff8af5', GLOW('#80207a')), x, 0.2, z), gem(0.09, mat('#ff8af5', GLOW('#80207a')), x + 0.15, 0.13, z + 0.08));
  return g;
}

function goldstorage(level) {
  const g = group(basePad(3));
  let y0 = 0.05;
  if (level >= 5) {
    g.add(rbox(2.75, 0.3, 2.75, C.stone, 0, 0.05, 0, { ...ST, r: 0.06 }));
    y0 = 0.35;
  }
  const bodyC = level >= 4 ? C.woodDark : C.wood;
  const trim = level >= 7 ? C.gold : level >= 3 ? C.iron : C.woodDark;
  const to = level >= 3 ? MT : PL;
  const H = 1.1;
  g.add(rbox(2.4, H, 2.4, bodyC, 0, y0, 0, { ...PL, r: 0.05 }));
  for (const y of [y0 + 0.08, y0 + H - 0.2]) {
    for (const s of [-1, 1]) {
      g.add(box(2.46, 0.14, 0.08, trim, 0, y, s * 1.21, to));
      g.add(box(0.08, 0.14, 2.46, trim, s * 1.21, y, 0, to));
    }
  }
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) g.add(rbox(0.26, H + 0.12, 0.26, trim, x, y0, z, { ...to, r: 0.04 }));
  // rim around the open top
  for (const s of [-1, 1]) {
    g.add(rbox(2.5, 0.12, 0.2, bodyC, 0, y0 + H, s * 1.15, PL));
    g.add(rbox(0.2, 0.12, 2.5, bodyC, s * 1.15, y0 + H, 0, PL));
  }
  g.add(box(2.2, 0.04, 2.2, C.woodDark, 0, y0 + H - 0.02, 0, PL));
  g.add(cone(0.7, 0.12, C.goldDark, 0, y0 + H, 0, 10));
  // coin emblem on the front
  g.add(cylZ(0.3, 0.06, C.goldDark, 0, y0 + H * 0.5, 1.22, 14), cylZ(0.22, 0.08, C.gold, 0, y0 + H * 0.5, 1.23, 14));
  const fill = dyn(new THREE.Group(), 'fill');
  fill.add(cone(1.05, 0.8, mat(C.gold, { smooth: false }), 0, 0, 0, 10));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const c = cyl(0.15, 0.15, 0.05, C.goldDark, Math.cos(a) * 0.82, 0.05 + (i % 3) * 0.04, Math.sin(a) * 0.82, 10);
    c.rotation.set(0.4 * Math.sin(i), 0, 0.4 * Math.cos(i));
    fill.add(c);
  }
  fill.add(gem(0.12, mat('#ff5a5a', GLOW('#600')), 0.3, 0.45, 0.2), gem(0.1, mat('#5ad0ff', GLOW('#036')), -0.3, 0.35, -0.25));
  fill.position.y = y0 + H + 0.02;
  g.add(fill);
  return g;
}

function elixirstorage(level) {
  const g = group(basePad(3));
  const metal = level >= 7 ? C.gold : C.iron;
  g.add(cyl(1.25, 1.32, 0.36, level >= 3 ? C.stone : C.woodDark, 0, 0.05, 0, 14, level >= 3 ? ST : PL));
  const glass = cyl(1.0, 1.0, 1.8, mat('#f6d2ff', { transparent: true, opacity: 0.4, smooth: true, depthWrite: false }), 0, 0.41, 0, 20);
  glass.castShadow = false;
  g.add(glass);
  const fill = dyn(new THREE.Group(), 'fill');
  fill.add(cyl(0.92, 0.92, 1, mat(C.elixir, { ...GLOW('#5a0a60'), smooth: true }), 0, 0, 0, 20));
  fill.position.y = 0.43;
  g.add(fill);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    g.add(rbox(0.16, 1.9, 0.16, level >= 3 ? metal : C.wood, Math.cos(a) * 1.02, 0.38, Math.sin(a) * 1.02, level >= 3 ? MT : PL));
  }
  for (const y of [0.48, 1.3, 2.12]) g.add(torus(1.03, 0.06, metal, 0, y, 0, 22, MT));
  const lid = level >= 7 ? C.gold : level >= 3 ? '#b8bdc8' : C.wood;
  g.add(dome(1.08, lid, 0, 2.18, 0, 16, level >= 3 ? MT : PL), cyl(0.18, 0.24, 0.3, metal, 0, 3.1, 0, 10, MT), sphere(0.12, level >= 5 ? C.gold : metal, 0, 3.48, 0, 8, 6));
  if (level >= 5) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(sphere(0.07, C.gold, Math.cos(a) * 0.9, 2.62, Math.sin(a) * 0.9, 6, 4));
  }
  return g;
}

// ---------- village ----------
const HOUSE_STYLE = [
  { walls: 'plank', roof: C.thatch, ro: TH },
  { walls: 'timber', roof: C.roofRed, ro: SH, chimney: true },
  { walls: 'stoneTimber', roof: C.roofRed, ro: SH, chimney: true, flowers: true },
  { walls: 'stoneTimber', roof: C.roofBlue, ro: SH, chimney: true, flowers: true, tall: true },
  { walls: 'stone', roof: C.roofBlue, ro: SH, chimney: true, flowers: true, tall: true, vane: true },
];

function house(level) {
  const S = HOUSE_STYLE[level - 1];
  const g = group(basePad(2, 'cobble'));
  const w = 1.42, d = 1.15;
  const h = S.tall ? 1.25 : 0.88;
  g.add(rbox(1.6, 0.16, 1.32, C.stoneDark, 0, 0.05, -0.02, ST));
  const y0 = 0.21;
  let wallC = C.plaster;
  if (S.walls === 'plank') {
    wallC = C.wood;
    g.add(rbox(w, h, d, C.wood, 0, y0, 0, { ...PL, r: 0.03 }));
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(0.14, h, 0.14, C.woodDark, x, y0, z));
  } else if (S.walls === 'timber') {
    g.add(rbox(w, h, d, C.plaster, 0, y0, 0, { ...PS, r: 0.03 }));
    g.add(at(timberFrame(w, h, d, 0), 0, y0, 0));
  } else if (S.walls === 'stoneTimber') {
    const lh = 0.38;
    g.add(rbox(w + 0.04, lh, d + 0.04, C.stone, 0, y0, 0, { ...ST, r: 0.03 }));
    g.add(rbox(w + 0.1, h - lh, d + 0.1, C.plaster, 0, y0 + lh, 0, { ...PS, r: 0.03 }));
    g.add(at(timberFrame(w + 0.1, h - lh, d + 0.1, 0, C.woodDark, h - lh > 0.6), 0, y0 + lh, 0));
  } else {
    wallC = C.stoneWarm;
    g.add(rbox(w, h, d, C.stoneWarm, 0, y0, 0, { ...ST, r: 0.03 }));
  }
  g.add(at(archDoor(0.34, 0.56, S.walls === 'plank' ? C.woodDark : C.stone, C.woodDark), 0.28, y0, d / 2 + 0.03));
  g.add(at(windowPane(0.26, 0.26, C.woodDark, level >= 3), -0.36, y0 + 0.32, d / 2 + 0.04));
  if (S.tall) g.add(at(windowPane(0.24, 0.26, C.woodDark, true), 0, y0 + h - 0.36, d / 2 + 0.09));
  for (const s of [-1, 1]) g.add(at(windowPane(0.24, 0.26, C.woodDark, level >= 3), s * (w / 2 + 0.06), y0 + 0.34, 0, (s * Math.PI) / 2));
  if (S.flowers) {
    g.add(box(0.36, 0.1, 0.12, C.woodDark, -0.36, y0 + 0.22, d / 2 + 0.12));
    for (let i = 0; i < 3; i++) g.add(sphere(0.06, i % 2 ? '#ff6a8a' : '#ffd23f', -0.48 + i * 0.12, y0 + 0.34, d / 2 + 0.13, 6, 4));
  }
  // gable ends and roof
  const top = y0 + h;
  g.add(gable(w - 0.02, 0.68, d - 0.02, wallC, 0, top, 0, S.walls === 'plank' ? PL : S.walls === 'stone' ? ST : PS));
  g.add(gable(w + 0.36, 0.78, d + 0.42, S.roof, 0, top - 0.04, 0, S.ro));
  g.add(cylX(0.06, w + 0.4, S.roof === C.thatch ? '#c9a24a' : C.woodDark, 0, top + 0.74, 0, 6));
  if (S.chimney) g.add(chimney(-0.42, top - 0.2, -0.25, 0.85));
  if (S.vane) g.add(cyl(0.02, 0.02, 0.35, C.gold, 0.5, top + 0.75, 0, 4), gable(0.25, 0.15, 0.04, C.gold, 0.55, top + 1.05, 0));
  if (level >= 2) g.add(barrel(-0.72, 0.06, 0.7, 0.3, 0.13));
  return g;
}

function builderhut() {
  const g = group(basePad(2, 'cobble'));
  g.add(cyl(0.82, 0.88, 0.16, C.stone, 0, 0.05, 0, 12, ST));
  g.add(cyl(0.66, 0.7, 0.78, C.woodLight, 0, 0.2, 0, 12, PL));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.add(at(box(0.07, 0.8, 0.07, C.woodDark), Math.cos(a) * 0.68, 0.2, Math.sin(a) * 0.68));
  }
  g.add(torus(0.7, 0.04, C.woodDark, 0, 0.95, 0, 14));
  g.add(cone(0.95, 0.78, '#5f8acb', 0, 0.97, 0, 12, SH));
  g.add(cyl(0.07, 0.08, 0.35, C.ironDark, 0.3, 1.35, -0.2, 6));
  g.add(at(archDoor(0.32, 0.55, C.woodDark, C.woodDark), 0, 0.2, 0.66));
  g.add(at(windowPane(0.2, 0.2, C.woodDark, true), 0.6, 0.48, 0.25, Math.PI / 2 - 0.4));
  // tools and supplies
  g.add(crate(-0.68, 0.06, 0.6, 0.3, 0.4), crate(-0.75, 0.36, 0.58, 0.22, 0.1), barrel(0.7, 0.06, 0.62, 0.32, 0.13));
  const sign = group(rbox(0.06, 0.75, 0.06, C.woodDark, 0, 0, 0, PL), rbox(0.36, 0.14, 0.14, C.iron, 0, 0.75, 0, MT), rbox(0.06, 0.3, 0.06, C.wood, 0, 0.5, 0));
  g.add(at(sign, -0.7, 0.06, -0.55, 0.5));
  return g;
}

// ---------- army ----------
function barracks(level) {
  const t = level <= 2 ? 0 : level <= 4 ? 1 : level <= 6 ? 2 : 3;
  const g = group(basePad(3, 'cobble'));
  const stoneC = C.stone;
  g.add(rbox(2.75, 0.28, 2.55, C.stoneDark, 0, 0.05, -0.05, ST));
  const y0 = 0.33;
  // main hall
  const hw = 2.3, hd = 1.45, hh = 1.0, hz = -0.42;
  if (t === 0) g.add(rbox(hw, hh, hd, C.wood, 0, y0, hz, PL));
  else if (t === 1) {
    g.add(rbox(hw, hh * 0.45, hd, stoneC, 0, y0, hz, ST));
    g.add(rbox(hw - 0.04, hh * 0.55, hd - 0.04, C.wood, 0, y0 + hh * 0.45, hz, PL));
  } else g.add(rbox(hw, hh, hd, stoneC, 0, y0, hz, ST));
  const roofC = t === 3 ? C.roofPurple : C.roofRed;
  g.add(gable(hw - 0.02, 0.75, hd - 0.02, t === 0 ? C.wood : stoneC, 0, y0 + hh, hz, t === 0 ? PL : ST));
  g.add(gable(hw + 0.3, 0.85, hd + 0.4, roofC, 0, y0 + hh - 0.05, hz, SH));
  g.add(cylX(0.06, hw + 0.34, t === 3 ? C.gold : C.woodDark, 0, y0 + hh + 0.8, hz, 6));
  for (const x of [-0.75, 0.75]) g.add(at(windowPane(0.26, 0.3, C.woodDark, t >= 2), x, y0 + 0.4, hz - hd / 2 - 0.04, Math.PI));
  // gatehouse
  const gw = 1.35, gd = 0.8, gh = 1.45, gz = 0.62;
  const gateC = t === 0 ? C.wood : stoneC;
  g.add(rbox(gw, gh, gd, gateC, 0, y0, gz, { ...(t === 0 ? PL : ST), r: 0.04 }));
  g.add(crenels(gw + 0.12, gd + 0.12, y0 + gh, gateC, t === 0 ? PL : ST, 0.24).translateZ(gz));
  g.add(at(archDoor(0.62, 0.88, t === 0 ? C.woodDark : C.stoneDark, C.woodDark), 0, y0, gz + gd / 2 + 0.02));
  // shield and crossed swords
  const shield = group(
    cylZ(0.27, 0.07, t === 3 ? C.gold : C.roofRed, 0, 0, 0, 14),
    cylZ(0.19, 0.08, t >= 2 ? C.gold : C.woodLight, 0, 0, 0.005, 14),
  );
  for (const s of [-1, 1]) {
    const sw = group(box(0.06, 0.78, 0.03, '#e2e6ee', 0, -0.39, 0, MT), box(0.2, 0.05, 0.05, C.goldDark, 0, -0.42, 0), box(0.05, 0.16, 0.05, C.woodDark, 0, -0.6, 0));
    sw.rotation.z = s * 0.75 + Math.PI;
    sw.position.z = -0.03;
    shield.add(sw);
  }
  g.add(at(shield, 0, y0 + 1.15, gz + gd / 2 + 0.05));
  for (const s of [-1, 1]) g.add(at(banner(t === 3 ? C.roofPurple : C.roofRed, 0.24, 0.55), s * 0.52, y0 + gh - 0.06, gz + gd / 2 + 0.03));
  // weapon rack
  if (level >= 2) {
    const rack = group(rbox(0.06, 0.6, 0.06, C.woodDark, -0.3, 0, 0, PL), rbox(0.06, 0.6, 0.06, C.woodDark, 0.3, 0, 0, PL), rbox(0.7, 0.06, 0.08, C.wood, 0, 0.45, 0, PL));
    for (let i = 0; i < 3; i++) {
      rack.add(cyl(0.02, 0.02, 0.85, C.woodDark, -0.2 + i * 0.2, 0.02, 0.05, 5));
      rack.add(cone(0.045, 0.14, '#d8dde6', -0.2 + i * 0.2, 0.86, 0.05, 4, MT));
    }
    g.add(at(rack, 1.05, 0.08, 0.75, -Math.PI / 2));
  }
  // training dummy
  if (level >= 3) {
    const dummy = group(cyl(0.04, 0.05, 0.9, C.woodDark, 0, 0, 0, 6), cyl(0.15, 0.15, 0.38, '#e8c870', 0, 0.38, 0, 8, TH), sphere(0.12, '#e8c870', 0, 0.9, 0, 8, 6, TH), cylX(0.04, 0.55, C.woodDark, 0, 0.66, 0, 6));
    g.add(at(dummy, -1.1, 0.08, 0.95));
  }
  if (level >= 5) {
    g.add(cyl(0.38, 0.42, 2.0, stoneC, -0.95, 0.05, -1.05, 10, ST), cone(0.52, 0.75, roofC, -0.95, 2.05, -1.05, 10, SH));
    g.add(flagPole(t === 3 ? C.roofPurple : C.roofRed, 0.6, -0.95, 2.7, -1.05));
  }
  if (t === 3) g.add(rbox(gw + 0.05, 0.08, gd + 0.05, C.gold, 0, y0 + gh - 0.15, gz, MT));
  return g;
}

function armycamp(level) {
  const g = new THREE.Group();
  g.add(cyl(1.9, 1.96, 0.05, C.dirt, 0, 0, 0, 24, { tex: 'dirt' }));
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = rock(0.17 + (i % 3) * 0.03, level >= 3 ? C.stone : '#b7ad9e', Math.cos(a) * 1.86, 0.12, Math.sin(a) * 1.86);
    m.rotation.set(i, i * 2, 0);
    g.add(m);
  }
  // fire pit
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(rock(0.1, '#8e877c', Math.cos(a) * 0.36, 0.08, Math.sin(a) * 0.36));
  }
  for (let i = 0; i < 3; i++) {
    const l = cylX(0.06, 0.6, C.woodDark, 0, 0.09, 0, 6, PL);
    l.rotation.y = (i / 3) * Math.PI;
    g.add(l);
  }
  const fire = dyn(new THREE.Group(), 'fire');
  fire.add(cone(0.24, 0.62, mat('#ff8a1e', GLOW('#ff5500')), 0, 0.1, 0, 7));
  fire.add(cone(0.14, 0.42, mat('#ffd23e', GLOW('#ffaa00')), 0.04, 0.12, 0.02, 6));
  fire.add(cone(0.1, 0.3, mat('#ff6a1e', GLOW('#ff4400')), -0.1, 0.1, -0.05, 6));
  g.add(fire);
  // log benches
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const b = cylX(0.1, 0.7, C.wood, Math.cos(a) * 0.82, 0.12, Math.sin(a) * 0.82, 8, PL);
    b.rotation.y = -a + Math.PI / 2;
    g.add(b);
  }
  // tents
  const tents = Math.min(4, level);
  const spots = [[-1.12, -1.12], [1.12, -1.12], [-1.12, 1.12], [1.12, 1.12]];
  for (let i = 0; i < tents; i++) {
    const [x, z] = spots[i];
    const band = i % 2 ? C.roofRed : C.roofBlue;
    const tent = group(
      hipRoof(0.86, 0.95, 0.86, C.canvas, 0, 0, 0, PS),
      hipRoof(0.42, 0.46, 0.42, band, 0, 0.5, 0),
      box(0.3, 0.34, 0.05, C.black, 0, 0, 0.3),
      cyl(0.025, 0.025, 0.3, C.woodDark, 0, 0.9, 0, 5),
      box(0.2, 0.12, 0.02, band, 0.1, 1.08, 0),
    );
    tent.position.set(x, 0.05, z);
    tent.rotation.y = Math.atan2(-x, -z);
    g.add(tent);
  }
  if (level >= 3) g.add(flagPole(C.roofRed, 1.4, 1.7, 0.05, 0.0));
  if (level >= 5) g.add(flagPole(C.roofBlue, 1.4, -1.7, 0.05, 0.0));
  return g;
}

function laboratory(level) {
  const g = group(basePad(3, 'cobble'));
  const gold = level >= 4;
  g.add(rbox(2.65, 0.26, 2.45, C.stoneDark, 0, 0.05, 0, ST));
  g.add(rbox(2.25, 1.15, 2.05, level >= 3 ? C.stone : '#d8b490', 0, 0.31, 0, level >= 3 ? ST : BR));
  for (const [x, z] of [[-1.1, -1.0], [1.1, -1.0], [-1.1, 1.0], [1.1, 1.0]]) g.add(rbox(0.3, 1.3, 0.3, C.stoneDark, x, 0.31, z, ST));
  for (const sd of [-1, 1]) {
    g.add(rbox(2.4, 0.16, 0.22, gold ? C.gold : C.stone, 0, 1.44, sd * 1.0, gold ? MT : ST));
    g.add(rbox(0.22, 0.16, 2.2, gold ? C.gold : C.stone, sd * 1.1, 1.44, 0, gold ? MT : ST));
  }
  g.add(box(2.1, 0.05, 1.9, C.stoneDark, 0, 1.44, 0, ST));
  const domeC = level >= 5 ? '#d29aff' : '#9fdcff';
  const glass = dome(0.98, mat(domeC, { transparent: true, opacity: 0.55, smooth: true, depthWrite: false }), 0, 1.56, 0, 20);
  glass.castShadow = false;
  g.add(glass);
  for (let i = 0; i < 2; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.99, 0.04, 4, 20, Math.PI), gold ? C.gold : C.iron);
    rib.position.y = 1.56;
    rib.rotation.y = (i * Math.PI) / 2;
    g.add(rib);
  }
  g.add(torus(0.99, 0.06, gold ? C.gold : C.iron, 0, 1.58, 0, 22), sphere(0.1, gold ? C.gold : C.iron, 0, 2.58, 0, 8, 6));
  g.add(sphere(0.3, mat('#5cff8a', GLOW('#1f9a40')), 0, 1.75, 0, 12, 10), cyl(0.06, 0.1, 0.25, '#bfe6ff', 0, 2.0, 0, 8));
  // chimney with a bubbling flask
  g.add(rbox(0.32, 1.2, 0.32, '#c98a6a', 0.85, 1.3, -0.75, { ...BR, r: 0.03 }), sphere(0.2, mat('#7aff6a', GLOW('#2a8a20')), 0.85, 2.65, -0.75, 10, 8), cyl(0.05, 0.08, 0.2, '#cfe8ff', 0.85, 2.78, -0.75, 6));
  // pipes
  g.add(cyl(0.06, 0.06, 1.0, C.iron, -1.24, 0.31, 0.5, 6, MT), cylX(0.06, 0.4, C.iron, -1.05, 1.28, 0.5, 6, MT));
  g.add(at(archDoor(0.5, 0.78, C.stoneDark, C.roofBlue), 0, 0.31, 1.04));
  for (const x of [-0.72, 0.72]) g.add(at(windowPane(0.3, 0.34, C.ironDark, true), x, 0.75, 1.05));
  g.add(barrel(-1.25, 0.06, 1.2, 0.3, 0.13), crate(1.25, 0.06, 1.2, 0.28, 0.4));
  return g;
}

// ---------- defenses ----------
function cannon(level) {
  const g = group(basePad(3));
  const wood = level <= 2;
  if (wood) {
    g.add(cyl(1.22, 1.3, 0.36, C.wood, 0, 0.05, 0, 8, PL), torus(1.24, 0.05, C.iron, 0, 0.38, 0, 8));
  } else {
    g.add(cyl(1.22, 1.32, 0.45, level >= 5 ? C.stoneWarm : C.stone, 0, 0.05, 0, 8, ST));
    g.add(cyl(1.08, 1.08, 0.05, C.stoneDark, 0, 0.5, 0, 8, ST));
    if (level >= 5) g.add(torus(1.25, 0.05, C.gold, 0, 0.48, 0, 8));
  }
  // ammo
  for (const [x, z] of [[1.15, 1.15], [-1.15, 1.15]]) {
    for (const [dx, dz] of [[0, 0], [0.17, 0], [0.085, 0.15]]) g.add(sphere(0.09, C.ironDark, x + dx - 0.08, 0.17, z + dz - 0.07, 8, 6));
    g.add(sphere(0.09, C.ironDark, x, 0.31, z - 0.02, 8, 6));
  }
  const barrelC = level >= 6 ? C.gold : level >= 5 ? '#353842' : level >= 3 ? '#4a4f5c' : C.ironDark;
  const ringC = level >= 5 ? C.gold : C.iron;
  const turret = dyn(new THREE.Group(), 'turret');
  turret.add(cyl(0.72, 0.78, 0.12, wood ? C.woodDark : C.ironDark, 0, 0, 0, 12, wood ? PL : MT));
  for (const s of [-1, 1]) {
    const cheek = rbox(0.16, 0.5, 1.0, C.wood, s * 0.3, 0.1, -0.05, { ...PL, r: 0.04 });
    turret.add(cheek);
    const wheel = group(cylX(0.27, 0.1, C.woodDark, 0, 0, 0, 12, PL));
    const rim = mesh(new THREE.TorusGeometry(0.27, 0.035, 4, 14), C.ironDark);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    wheel.add(cylX(0.07, 0.14, C.iron, 0, 0, 0, 8));
    wheel.position.set(s * 0.44, 0.3, -0.15);
    turret.add(wheel);
  }
  const barrel = new THREE.Group();
  const tube = cyl(0.19, 0.27, 1.55, barrelC, 0, -0.78, 0, 14, MT);
  barrel.add(tube);
  for (const y of [-0.62, -0.1, 0.42]) {
    const ring = mesh(new THREE.TorusGeometry(0.235 - y * 0.045, 0.045, 5, 14), ringC);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    barrel.add(ring);
  }
  const muzzle = mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 14), ringC);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.y = 0.76;
  barrel.add(muzzle);
  barrel.add(cyl(0.13, 0.13, 0.04, C.black, 0, 0.74, 0, 12));
  barrel.add(sphere(0.12, barrelC, 0, -0.85, 0, 8, 6));
  barrel.rotation.x = Math.PI / 2 - 0.12;
  barrel.position.set(0, 0.68, 0.25);
  turret.add(barrel);
  turret.add(cylX(0.06, 0.75, C.ironDark, 0, 0.66, 0.2, 8));
  turret.position.y = wood ? 0.41 : 0.55;
  g.add(turret);
  return g;
}

function archertower(level) {
  const g = group(basePad(3));
  const H = [2.0, 2.1, 2.2, 2.3, 2.45, 2.6][level - 1];
  const roofC = level >= 6 ? C.roofPurple : level >= 5 ? C.roofBlue : C.roofRed;
  if (level <= 2) {
    for (const [x, z] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) {
      const leg = new THREE.Group();
      leg.add(rbox(0.24, H, 0.24, C.wood, 0, 0, 0, PL));
      leg.position.set(x, 0.05, z);
      leg.rotation.set(-z * 0.06, 0, x * 0.06);
      g.add(leg);
    }
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2;
      for (const k of [1, -1]) {
        const br = box(0.08, 1.75, 0.07, C.woodDark, 0, 0, 0, PL);
        br.rotation.z = k * 0.72;
        const holder = new THREE.Group();
        holder.add(br);
        br.position.set(0, 0, 0.78);
        holder.rotation.y = a;
        holder.position.y = H * 0.42;
        g.add(holder);
      }
    }
    // ladder
    const ladder = group(box(0.05, H, 0.05, C.woodDark, -0.16, 0, 0), box(0.05, H, 0.05, C.woodDark, 0.16, 0, 0));
    for (let i = 1; i < 7; i++) ladder.add(box(0.32, 0.04, 0.04, C.wood, 0, (i * H) / 7, 0));
    ladder.rotation.x = -0.12;
    g.add(at(ladder, 0, 0.05, 1.0));
  } else if (level <= 4) {
    g.add(cyl(0.95, 1.15, H * 0.5, C.stone, 0, 0.05, 0, 4, ST).rotateY(Math.PI / 4));
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) g.add(rbox(0.22, H * 0.52, 0.22, C.wood, x, H * 0.5, z, PL));
    g.add(at(archDoor(0.4, 0.62, C.stoneDark, C.woodDark), 0, 0.05, 0.82));
  } else {
    g.add(cyl(0.92, 1.2, H, C.stone, 0, 0.05, 0, 4, ST).rotateY(Math.PI / 4));
    g.add(at(archDoor(0.42, 0.66, C.stoneDark, C.woodDark), 0, 0.05, 0.86));
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2;
      g.add(at(box(0.1, 0.32, 0.06, C.glassDark), Math.sin(a) * 0.74, H * 0.6, Math.cos(a) * 0.74, a));
    }
  }
  // platform
  g.add(rbox(2.0, 0.22, 2.0, level >= 5 ? C.stone : C.woodDark, 0, H, 0, level >= 5 ? ST : PL));
  g.add(crenels(2.0, 2.0, H + 0.22, level >= 3 ? C.stone : C.wood, level >= 3 ? ST : PL, 0.24));
  if (level >= 3) {
    for (const [x, z] of [[-0.88, -0.88], [0.88, -0.88], [-0.88, 0.88], [0.88, 0.88]]) g.add(box(0.1, 0.95, 0.1, C.woodDark, x, H + 0.22, z));
    g.add(rbox(2.2, 0.08, 2.2, level >= 6 ? C.gold : C.woodDark, 0, H + 1.15, 0, PL));
    g.add(hipRoof(2.2, 0.85, 2.2, roofC, 0, H + 1.18, 0, SH));
    g.add(sphere(0.08, level >= 5 ? C.gold : C.woodDark, 0, H + 2.05, 0, 6, 4));
  }
  if (level >= 4) g.add(flagPole(roofC, 0.7, 0.88, H + (level >= 3 ? 1.2 : 0.4), 0.88));
  const turret = dyn(new THREE.Group(), 'turret');
  turret.add(archerFigure(0.55));
  turret.position.y = H + 0.22;
  g.add(turret);
  return g;
}

function mortar(level) {
  const g = group(basePad(3));
  g.add(cyl(1.25, 1.36, 0.6, level >= 3 ? C.stone : C.stoneDark, 0, 0.05, 0, 14, ST));
  g.add(cyl(1.0, 1.0, 0.02, C.dirt, 0, 0.65, 0, 14, { tex: 'dirt' }));
  const bags = level >= 3 ? 2 : 1;
  for (let layer = 0; layer < bags; layer++) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = ((i + layer * 0.5) / n) * Math.PI * 2;
      const b = rbox(0.5, 0.2, 0.3, '#dcc590', Math.cos(a) * 1.12, 0.63 + layer * 0.18, Math.sin(a) * 1.12, { tex: 'plaster', r: 0.08 });
      b.rotation.y = -a + Math.PI / 2;
      g.add(b);
    }
  }
  for (const [x, z] of [[1.15, 1.15], [-1.2, 1.1]]) g.add(sphere(0.13, C.ironDark, x, 0.2, z, 8, 6), sphere(0.13, C.ironDark, x + 0.12, 0.2, z - 0.15, 8, 6));
  const turret = dyn(new THREE.Group(), 'turret');
  turret.add(rbox(0.95, 0.24, 0.85, C.woodDark, 0, 0, -0.05, { ...PL, r: 0.04 }));
  const tube = new THREE.Group();
  tube.add(cyl(0.44, 0.36, 0.9, level >= 4 ? '#3a3d46' : C.ironDark, 0, 0, 0, 14, MT));
  const lip = mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 16), level >= 4 ? C.gold : C.iron);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.9;
  tube.add(lip, cyl(0.34, 0.34, 0.02, C.black, 0, 0.9, 0, 14));
  const band = mesh(new THREE.TorusGeometry(0.42, 0.045, 5, 16), level >= 4 ? C.gold : C.iron);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.3;
  tube.add(band);
  tube.rotation.x = 0.6;
  tube.position.set(0, 0.2, 0.05);
  turret.add(tube);
  turret.position.y = 0.67;
  g.add(turret);
  return g;
}

function airdefense(level) {
  const g = group(basePad(3));
  const metal = level >= 4 ? C.gold : C.iron;
  g.add(cyl(0.85, 1.22, 1.55, level >= 3 ? C.stone : C.stoneDark, 0, 0.05, 0, 8, ST));
  for (const y of [0.45, 1.25]) g.add(torus(1.0 - (y - 0.45) * 0.3, 0.05, metal, 0, y, 0, 8, MT));
  g.add(at(archDoor(0.4, 0.62, C.stoneDark, C.ironDark), 0, 0.05, 1.08));
  g.add(cyl(1.05, 0.95, 0.2, C.ironDark, 0, 1.6, 0, 8, MT));
  const turret = dyn(new THREE.Group(), 'turret');
  turret.add(cyl(0.62, 0.68, 0.32, '#c8402f', 0, 0, 0, 10, MT));
  turret.add(box(0.95, 0.5, 0.18, C.ironDark, 0, 0.3, -0.35, MT));
  for (const [x, y] of [[-0.28, 0.48], [0.28, 0.48], [-0.28, 0.86], [0.28, 0.86]]) {
    const pod = new THREE.Group();
    pod.add(cyl(0.13, 0.13, 0.85, metal, 0, -0.42, 0, 10, MT));
    pod.add(cone(0.12, 0.26, '#e04a2e', 0, 0.42, 0, 8));
    pod.add(torus(0.135, 0.025, C.ironDark, 0, -0.1, 0, 10));
    pod.rotation.x = Math.PI / 2 - 0.55;
    pod.position.set(x, y, 0.12);
    turret.add(pod);
  }
  turret.position.y = 1.8;
  g.add(turret);
  return g;
}

function wizardtower(level) {
  const g = group(basePad(3));
  const stoneC = level >= 3 ? C.stone : C.stoneDark;
  g.add(cyl(0.88, 1.08, 2.15, stoneC, 0, 0.05, 0, 12, ST));
  g.add(torus(0.98, 0.06, C.roofBlue, 0, 0.7, 0, 16));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(at(box(0.14, 0.2, 0.05, mat('#c07bff', GLOW('#7a20d0'))), Math.sin(a) * 0.97, 1.2, Math.cos(a) * 0.97, a));
  }
  g.add(cyl(1.02, 0.92, 0.16, C.roofBlue, 0, 2.15, 0, 12, ST));
  g.add(roundCrenels(0.92, 2.3, stoneC, 10, 0.24));
  g.add(at(archDoor(0.42, 0.66, C.stoneDark, C.roofBlue), 0, 0.05, 1.0));
  const crystals = 2 + level;
  for (let i = 0; i < crystals; i++) {
    const a = (i / crystals) * Math.PI * 2 + 0.4;
    const cr = gem(0.16 + (i % 2) * 0.06, mat('#b57bff', GLOW('#6020b0')), Math.cos(a) * 1.25, 0.25, Math.sin(a) * 1.25);
    cr.scale.y = 1.8;
    g.add(cr);
  }
  if (level >= 4) g.add(torus(0.93, 0.05, C.gold, 0, 2.31, 0, 16));
  const turret = dyn(new THREE.Group(), 'turret');
  turret.add(wizardFigure(0.62));
  turret.position.y = 2.31;
  g.add(turret);
  return g;
}

// ---------- walls ----------
const WALL = [
  { kind: 'palisade', c1: '#c08a52', c2: '#8e5a2c' },
  { kind: 'rough', c1: '#cfc6b6', c2: '#a8a094' },
  { kind: 'block', c1: '#d9d3c8', c2: '#b3ab9f' },
  { kind: 'block', c1: '#8c8896', c2: '#6c6876', spikes: true },
  { kind: 'block', c1: '#f2c84a', c2: '#c99a1c', cap: '#fff0a0' },
  { kind: 'block', c1: '#b878e6', c2: '#8048b8', crystal: true },
];

export function wallModel(level, nb = {}) {
  const S = WALL[Math.min(WALL.length, Math.max(1, level)) - 1];
  const g = new THREE.Group();
  if (S.kind === 'palisade') {
    const stake = (x, z, h) => g.add(cyl(0.09, 0.1, h, S.c1, x, 0, z, 6, PL), cone(0.09, 0.16, S.c1, x, h, z, 6));
    stake(0, 0, 0.75);
    if (nb.e) {
      stake(0.33, 0, 0.7);
      stake(0.66, 0, 0.72);
      g.add(box(1, 0.07, 0.06, S.c2, 0.5, 0.25, 0.08), box(1, 0.07, 0.06, S.c2, 0.5, 0.5, 0.08));
    }
    if (nb.s) {
      stake(0, 0.33, 0.7);
      stake(0, 0.66, 0.72);
      g.add(box(0.06, 0.07, 1, S.c2, 0.08, 0.25, 0.5), box(0.06, 0.07, 1, S.c2, 0.08, 0.5, 0.5));
    }
    return g;
  }
  const opts = S.crystal ? { tex: 'crystal' } : ST;
  if (S.kind === 'rough') {
    g.add(rbox(0.56, 0.5, 0.56, S.c1, 0, 0, 0, { ...opts, r: 0.12 }), rbox(0.46, 0.34, 0.46, S.c2, 0.02, 0.48, -0.02, { ...opts, r: 0.1 }));
    if (nb.e) g.add(rbox(0.6, 0.62, 0.44, S.c2, 0.5, 0, 0, { ...opts, r: 0.1 }));
    if (nb.s) g.add(rbox(0.44, 0.62, 0.6, S.c2, 0, 0, 0.5, { ...opts, r: 0.1 }));
    return g;
  }
  g.add(rbox(0.56, 0.86, 0.56, S.c1, 0, 0, 0, { ...opts, r: 0.06 }));
  g.add(rbox(0.64, 0.14, 0.64, S.cap || S.c2, 0, 0.82, 0, { ...(S.cap ? { tex: 'metal' } : opts), r: 0.05 }));
  if (nb.e) g.add(rbox(0.62, 0.7, 0.44, S.c2, 0.5, 0, 0, { ...opts, r: 0.05 }), rbox(0.62, 0.08, 0.5, S.c1, 0.5, 0.68, 0, { ...opts, r: 0.03 }));
  if (nb.s) g.add(rbox(0.44, 0.7, 0.62, S.c2, 0, 0, 0.5, { ...opts, r: 0.05 }), rbox(0.5, 0.08, 0.62, S.c1, 0, 0.68, 0.5, { ...opts, r: 0.03 }));
  if (S.spikes) for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) g.add(cone(0.06, 0.24, '#d8dde6', x, 0.96, z, 6, MT));
  if (S.crystal) g.add(gem(0.14, mat('#f0c8ff', GLOW('#8a30d0')), 0, 1.1, 0));
  if (S.cap) g.add(sphere(0.08, S.cap, 0, 1.0, 0, 8, 6));
  return g;
}

// ---------- construction, rubble ----------
export function constructionSite(size, withPad = true) {
  const g = group(withPad ? basePad(size) : null);
  const s = size * 0.42;
  const h = Math.min(2.4, 0.9 + size * 0.38);
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) g.add(rbox(0.12, h, 0.12, C.woodLight, x, 0, z, PL));
  for (const y of [h * 0.45, h - 0.08]) {
    g.add(box(s * 2 + 0.14, 0.07, 0.24, C.wood, 0, y, -s, PL), box(s * 2 + 0.14, 0.07, 0.24, C.wood, 0, y, s, PL));
    g.add(box(0.24, 0.07, s * 2 + 0.14, C.wood, -s, y, 0, PL), box(0.24, 0.07, s * 2 + 0.14, C.wood, s, y, 0, PL));
  }
  const br = box(0.06, Math.hypot(s * 2, h * 0.45), 0.06, C.woodDark, 0, h * 0.02, s + 0.04);
  br.rotation.z = Math.atan2(s * 2, h * 0.45);
  g.add(br);
  if (withPad) {
    g.add(rbox(s * 0.9, 0.24, s * 0.7, C.stone, -s * 0.25, 0.06, 0.1, ST), rbox(s * 0.6, 0.2, s * 0.5, C.stone, -s * 0.2, 0.3, 0.1, ST));
    g.add(rbox(0.6, 0.18, 0.3, C.woodLight, s * 0.45, 0.06, s * 0.45, PL), crate(s * 0.4, 0.06, -s * 0.4, 0.3, 0.3));
  }
  return g;
}

// ---------- public ----------
const FNS = {
  townhall, goldmine, elixircollector, goldstorage, elixirstorage, house, builderhut, barracks, armycamp, laboratory,
  cannon, archertower, mortar, airdefense, wizardtower,
};

function contactShadow(size) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.22, size * 1.22),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = -1;
  m.userData.keep = true;
  return m;
}

const templates = new Map();

function fromTemplate(key, make) {
  let t = templates.get(key);
  if (!t) {
    t = bake(make());
    templates.set(key, t);
  }
  return t.clone(true);
}

export function buildingModel(type, level) {
  const size = BUILDINGS[type]?.size || 1;
  return fromTemplate(`${type}:${level}`, () => {
    const make = FNS[type];
    const g = make ? make(Math.max(1, level)) : box(1, 1, 1, '#ff00ff');
    g.add(contactShadow(size));
    return g;
  });
}

export function cachedWall(level, nb = {}) {
  return fromTemplate(`wall:${level}:${nb.e ? 1 : 0}${nb.s ? 1 : 0}`, () => wallModel(level, nb));
}

export function cachedSite(size, withPad = true) {
  return fromTemplate(`site:${size}:${withPad}`, () => constructionSite(size, withPad));
}
