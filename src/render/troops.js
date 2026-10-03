// Detailed troop and villager characters. Every humanoid shares one rig
// (body, head, jointed arms and legs) and gets its own gear on top.
// Troop gear improves at levels 3 and 5, the way troops visibly upgrade in Clash games.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, mesh, box, rbox, cyl, cone, sphere, torus, gem } from './kit.js';

const SKIN = '#f6c48e';
const STEEL = '#d9dee8';
const STEEL_DARK = '#8d94a3';
const LEATHER = '#8a5426';
const LEATHER_DARK = '#5c3416';
const GOLD = '#ffd03f';
const GOLD_DARK = '#c9940f';
const BONE = '#efeadb';
const IRON = '#3f434c';

const smooth = (c, extra = {}) => mat(c, { smooth: true, ...extra });
const glow = (c, e) => mat(c, { emissive: e, emissiveIntensity: 0.9 });

const tierOf = (level = 1) => (level >= 5 ? 2 : level >= 3 ? 1 : 0);

function named(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

function ell(r, color, x, y, z, sx = 1, sy = 1, sz = 1, seg = 14) {
  const m = sphere(r, typeof color === 'string' ? smooth(color) : color, x, y, z, seg, Math.max(8, Math.round(seg * 0.75)));
  m.scale.set(sx, sy, sz);
  return m;
}

// limb segment: rounded box hanging down from y = 0
function seg(w, h, d, color, y = 0, opts) {
  return rbox(w, h, d, color, 0, y - h, 0, { r: Math.min(w, d) * 0.35, ...opts });
}

// ---------- base body ----------
// Proportions follow the chunky Clash style: big head, broad torso, short legs.
// Returns the root group and its rig parts (all named so clones can find them).
function body({
  skin = SKIN,
  top = null,
  topDark = null,
  bottom = '#6b4a2a',
  boots = LEATHER_DARK,
  belt = LEATHER,
  buckle = GOLD,
  width = 1,
  arms = 1,
  bare = false,
} = {}) {
  const root = new THREE.Group();
  const hips = named('body');
  hips.position.y = 0.36;
  root.add(hips);

  // torso
  const chest = bare ? skin : top;
  const tw = 0.42 * width;
  if (bare) {
    hips.add(rbox(tw, 0.34, 0.26, smooth(skin), 0, 0.04, 0, { r: 0.09 }));
    // pecs and belly for a muscular look
    hips.add(ell(0.1, skin, -0.09 * width, 0.27, 0.1, 1.1, 0.7, 0.6), ell(0.1, skin, 0.09 * width, 0.27, 0.1, 1.1, 0.7, 0.6));
    hips.add(ell(0.11, skin, 0, 0.13, 0.09, 1.2, 0.8, 0.6));
  } else {
    hips.add(rbox(tw, 0.34, 0.26, chest, 0, 0.04, 0, { r: 0.09 }));
    if (topDark) hips.add(rbox(tw * 0.32, 0.3, 0.02, topDark, 0, 0.06, 0.13, { r: 0.01 }));
  }
  // pelvis, belt, buckle
  hips.add(rbox(tw * 0.95, 0.12, 0.24, bottom, 0, -0.06, 0, { r: 0.05 }));
  hips.add(rbox(tw + 0.02, 0.06, 0.28, belt, 0, 0.0, 0, { r: 0.02 }));
  hips.add(rbox(0.08, 0.07, 0.03, buckle, 0, -0.005, 0.14, { r: 0.015 }));

  // head
  const head = named('head');
  head.position.y = 0.38;
  hips.add(head);
  head.add(ell(0.2, skin, 0, 0.19, 0, 1, 0.98, 0.95));
  // ears
  head.add(ell(0.045, skin, -0.19, 0.18, -0.01, 0.6, 1, 0.8, 8), ell(0.045, skin, 0.19, 0.18, -0.01, 0.6, 1, 0.8, 8));
  // eyes: white, pupil, highlight
  for (const s of [-1, 1]) {
    head.add(ell(0.045, '#ffffff', s * 0.075, 0.21, 0.172, 1, 1.15, 0.6, 10));
    head.add(ell(0.024, '#1b1410', s * 0.072, 0.205, 0.192, 1, 1.15, 0.6, 8));
    head.add(ell(0.008, '#ffffff', s * 0.064, 0.218, 0.208, 1, 1, 1, 6));
  }
  // nose
  head.add(ell(0.035, skin, 0, 0.16, 0.19, 1, 0.9, 1, 8));
  // mouth
  head.add(rbox(0.07, 0.018, 0.02, '#5a1e14', 0, 0.09, 0.175, { r: 0.006 }));

  // arms
  const armLen = 0.2 * arms;
  for (const side of [-1, 1]) {
    const arm = named(side < 0 ? 'armL' : 'armR');
    arm.position.set(side * (tw / 2 + 0.05), 0.34, 0);
    const sleeve = bare ? skin : top;
    arm.add(ell(0.075 * arms, sleeve, 0, -0.02, 0, 1, 1, 1, 10));
    arm.add(seg(0.11 * arms, armLen, 0.11 * arms, bare ? smooth(skin) : sleeve, 0));
    arm.add(seg(0.1 * arms, 0.12 * arms, 0.1 * arms, smooth(skin), -armLen + 0.02));
    const hand = ell(0.065 * arms, skin, 0, -armLen - 0.12 * arms, 0.01, 1, 1, 1, 10);
    hand.name = 'hand';
    arm.add(hand);
    hips.add(arm);
  }

  // legs
  for (const side of [-1, 1]) {
    const leg = named(side < 0 ? 'legL' : 'legR');
    leg.position.set(side * 0.1 * width, 0.36, 0);
    leg.add(seg(0.15 * width, 0.2, 0.15, bottom, 0));
    leg.add(rbox(0.16 * width, 0.15, 0.2, boots, 0, -0.36, 0.025, { r: 0.05 }));
    leg.add(rbox(0.17 * width, 0.04, 0.17, boots, 0, -0.22, 0, { r: 0.015 }));
    root.add(leg);
  }
  return root;
}

const part = (root, name) => root.getObjectByName(name);

// Something held in a hand: positioned at the hand of the given arm.
function holdIn(root, armName, obj) {
  const arm = part(root, armName);
  const hand = arm.getObjectByName('hand');
  obj.position.add(hand.position);
  arm.add(obj);
  return obj;
}

// ---------- hair helpers ----------
function spikyHair(head, color, n = 9) {
  head.add(ell(0.205, color, 0, 0.27, -0.02, 1.02, 0.6, 1.0));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = cone(0.06, 0.16, smooth(color), 0, 0, 0, 6);
    c.position.set(Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12 - 0.02);
    c.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    head.add(c);
  }
  head.add(cone(0.07, 0.18, smooth(color), 0, 0.36, 0, 6));
}

function mustache(head, color, droop = true) {
  for (const s of [-1, 1]) {
    const m = ell(0.05, color, s * 0.06, 0.115, 0.19, 1.6, 0.6, 0.7, 8);
    m.rotation.z = s * -0.3;
    head.add(m);
    if (droop) {
      const d = cone(0.035, 0.14, smooth(color), s * 0.12, -0.02, 0.17, 6);
      d.rotation.x = Math.PI;
      d.rotation.z = s * 0.15;
      d.position.y = 0.11;
      head.add(d);
    }
  }
}

function brows(head, color, angry = 0.25) {
  for (const s of [-1, 1]) {
    const b = rbox(0.08, 0.025, 0.03, color, s * 0.075, 0.255, 0.18, { r: 0.01 });
    b.rotation.z = s * angry;
    head.add(b);
  }
}

// ---------- weapons ----------
function sword(tier) {
  const blade = tier >= 1 ? STEEL : '#c9ccd4';
  const hilt = tier >= 2 ? GOLD : tier >= 1 ? GOLD_DARK : LEATHER_DARK;
  const g = new THREE.Group();
  g.add(rbox(0.05, 0.12, 0.05, LEATHER_DARK, 0, -0.06, 0, { r: 0.015 }));
  g.add(sphere(0.035, hilt, 0, -0.08, 0, 8, 6));
  g.add(rbox(0.2, 0.04, 0.05, hilt, 0, 0.05, 0, { r: 0.015 }));
  g.add(rbox(0.075, 0.48 + tier * 0.06, 0.025, blade, 0, 0.08, 0, { r: 0.01 }));
  g.add(cone(0.038, 0.09, blade, 0, 0.56 + tier * 0.06, 0, 4).rotateY(Math.PI / 4));
  if (tier >= 2) g.add(gem(0.025, glow('#ff4a4a', '#600'), 0, 0.05, 0.03));
  return g;
}

// Bow with its grip at the origin; the limbs curve forward along +x.
function bow(tier) {
  const wood = tier >= 2 ? GOLD : tier >= 1 ? '#5a3418' : LEATHER;
  const g = new THREE.Group();
  const arc = mesh(new THREE.TorusGeometry(0.3, 0.022, 5, 16, Math.PI * 0.9), wood);
  arc.rotation.z = Math.PI / 2 + Math.PI * 0.05;
  arc.position.x = 0.3;
  g.add(arc);
  const sx = 0.3 + Math.cos(Math.PI * 0.55) * 0.3;
  g.add(box(0.008, 0.59, 0.008, '#f5f0e0', sx, -0.295, 0));
  g.add(rbox(0.05, 0.1, 0.05, LEATHER_DARK, 0, -0.05, 0, { r: 0.015 }));
  if (tier >= 1) for (const y of [0.18, -0.18]) g.add(sphere(0.025, GOLD, Math.cos(Math.asin(y / 0.3)) * -0.3 + 0.3, y, 0, 6, 4));
  return g;
}

// ---------- troops ----------
function barbarian(level) {
  const t = tierOf(level);
  const r = body({ bare: true, bottom: t >= 2 ? '#6b4a8a' : '#8a5a2b', belt: LEATHER_DARK, buckle: t >= 1 ? GOLD : '#c0c0c0', width: 1.08, arms: 1.1 });
  const head = part(r, 'head');
  spikyHair(head, '#ffcf3a');
  mustache(head, '#ffcf3a');
  brows(head, '#e0a21a', 0.35);
  // fur kilt
  const hips = part(r, 'body');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const flap = rbox(0.12, 0.14, 0.04, t >= 2 ? '#7a5a9a' : '#9a6a38', Math.sin(a) * 0.2, -0.2, Math.cos(a) * 0.13, { r: 0.015 });
    flap.rotation.y = a;
    hips.add(flap);
  }
  // wrist bands and boots fur
  for (const n of ['armL', 'armR']) part(r, n).add(torus(0.065, 0.02, t >= 1 ? GOLD_DARK : LEATHER, 0, -0.24, 0, 10));
  for (const n of ['legL', 'legR']) part(r, n).add(torus(0.09, 0.03, '#c9a46a', 0, -0.2, 0, 10));
  if (t >= 1) hips.add(rbox(0.07, 0.3, 0.03, LEATHER_DARK, 0.02, 0.07, 0.14, { r: 0.01 }).rotateZ(0.7));
  if (t >= 2) {
    // horned helmet
    head.add(ell(0.21, STEEL_DARK, 0, 0.27, 0, 1, 0.55, 1, 12));
    for (const s of [-1, 1]) {
      const horn = cone(0.045, 0.2, smooth('#f2ead6'), 0, 0, 0, 8);
      horn.position.set(s * 0.21, 0.32, 0);
      horn.rotation.z = -s * 1.0;
      head.add(horn);
    }
  }
  const s = sword(t);
  s.rotation.x = Math.PI / 2 - 0.2;
  s.position.z = 0.05;
  holdIn(r, 'armR', s);
  r.scale.setScalar(0.85);
  return r;
}

function archer(level) {
  const t = tierOf(level);
  const green = t >= 2 ? '#2f7a8a' : '#3f9a3c';
  const r = body({ top: green, topDark: '#2b6a2a', bottom: '#3d5a2a', boots: LEATHER, belt: LEATHER_DARK, buckle: t >= 1 ? GOLD : '#c0c0c0', width: 0.9, arms: 0.95 });
  const head = part(r, 'head');
  const hair = '#ff4fa6';
  // fringe, side locks and long ponytail
  head.add(ell(0.205, hair, 0, 0.26, -0.02, 1.02, 0.62, 1.02));
  head.add(ell(0.08, hair, -0.15, 0.2, 0.08, 0.6, 1.2, 0.8, 10), ell(0.08, hair, 0.15, 0.2, 0.08, 0.6, 1.2, 0.8, 10));
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.add(ell(0.07, hair, 0, -0.08, -0.05, 0.9, 1.6, 0.9, 10), ell(0.055, hair, 0, -0.24, -0.08, 0.9, 1.4, 0.9, 10));
  tail.position.set(0, 0.28, -0.18);
  head.add(tail);
  head.add(torus(0.035, 0.015, t >= 1 ? GOLD : '#ffffff', 0, 0.26, -0.21, 8).rotateX(Math.PI / 2));
  // eyelashes
  for (const s of [-1, 1]) head.add(rbox(0.06, 0.015, 0.02, '#2a1a10', s * 0.078, 0.25, 0.188, { r: 0.005 }).rotateZ(s * -0.2));
  // hood
  if (t >= 1) {
    head.add(ell(0.23, t >= 2 ? '#2f7a8a' : green, 0, 0.22, -0.08, 1.06, 0.95, 0.9, 14));
    head.add(torus(0.215, 0.015, GOLD, 0, 0.2, 0.0, 20).rotateX(-0.2));
  }
  // cape
  const hips = part(r, 'body');
  hips.add(rbox(0.4, 0.42, 0.03, t >= 2 ? '#1f5a6a' : '#2b6a2a', 0, -0.08, -0.15, { r: 0.015 }).rotateX(0.1));
  // quiver with arrows
  const quiver = new THREE.Group();
  quiver.add(cyl(0.06, 0.055, 0.3, LEATHER, 0, 0, 0, 10));
  quiver.add(torus(0.062, 0.012, t >= 1 ? GOLD : LEATHER_DARK, 0, 0.27, 0, 10));
  for (let i = 0; i < 4; i++) {
    quiver.add(cyl(0.008, 0.008, 0.12, '#d8c8a0', -0.03 + i * 0.02, 0.28, 0, 4));
    quiver.add(cone(0.02, 0.05, '#ff6a8a', -0.03 + i * 0.02, 0.4, 0, 3));
  }
  quiver.position.set(0.08, 0.05, -0.16);
  quiver.rotation.z = -0.35;
  hips.add(quiver);
  // bracer
  part(r, 'armL').add(rbox(0.11, 0.08, 0.11, t >= 1 ? GOLD_DARK : LEATHER_DARK, 0, -0.26, 0, { r: 0.02 }));
  const b = bow(t);
  b.rotation.set(0, -Math.PI / 2, 0.15);
  holdIn(r, 'armL', b);
  r.scale.setScalar(0.82);
  return r;
}

function giant(level) {
  const t = tierOf(level);
  const r = body({ top: '#9a6a3a', topDark: '#7a4f28', bottom: '#5a3a1a', boots: '#3a2410', belt: '#3a2410', buckle: t >= 1 ? GOLD : '#9a9a9a', width: 1.25, arms: 1.35 });
  const head = part(r, 'head');
  head.scale.setScalar(0.92);
  // bald crown with orange sides and huge beard
  head.add(ell(0.08, '#ff8a2a', -0.17, 0.22, -0.04, 0.7, 1.2, 1.2, 10), ell(0.08, '#ff8a2a', 0.17, 0.22, -0.04, 0.7, 1.2, 1.2, 10));
  head.add(ell(0.17, '#ff8a2a', 0, 0.06, 0.1, 1.15, 1.0, 0.75, 12));
  head.add(ell(0.08, '#ff8a2a', 0, -0.07, 0.13, 1.1, 1.3, 0.8, 10));
  mustache(head, '#ff7a1a', false);
  brows(head, '#d0601a', 0.3);
  // rope belt + shoulder pads
  const hips = part(r, 'body');
  hips.add(torus(0.28, 0.025, '#d8b878', 0, 0.02, 0, 16).rotateX(0.05));
  if (t >= 1) {
    for (const n of ['armL', 'armR']) {
      const a = part(r, n);
      a.add(ell(0.12, t >= 2 ? STEEL_DARK : LEATHER, 0, 0.0, 0, 1.2, 0.8, 1.1, 12));
      if (t >= 2) a.add(cone(0.035, 0.1, STEEL, 0, 0.07, 0, 6));
    }
  }
  // fists and bracers
  for (const n of ['armL', 'armR']) {
    const a = part(r, n);
    a.add(rbox(0.16, 0.1, 0.16, t >= 2 ? STEEL_DARK : LEATHER_DARK, 0, -0.33, 0, { r: 0.03 }));
    if (t >= 2) a.add(ell(0.1, STEEL_DARK, 0, -0.46, 0.01, 1, 0.9, 1, 10));
  }
  // patches on the tunic
  hips.add(rbox(0.1, 0.1, 0.02, '#c08a50', -0.1, 0.2, 0.135, { r: 0.01 }));
  r.scale.setScalar(1.5);
  return r;
}

function goblin(level) {
  const t = tierOf(level);
  const green = '#7fd64a';
  const r = body({ bare: true, skin: green, bottom: '#8a5a2b', boots: '#5a3416', belt: LEATHER_DARK, buckle: t >= 1 ? GOLD : '#c0c0c0', width: 0.85, arms: 0.9 });
  const head = part(r, 'head');
  head.scale.setScalar(1.12);
  // long pointy ears
  for (const s of [-1, 1]) {
    const e = cone(0.06, 0.26, smooth(green), 0, 0, 0, 8);
    e.position.set(s * 0.26, 0.21, -0.02);
    e.rotation.z = -s * 1.25;
    head.add(e);
    if (t >= 1 && s > 0) head.add(torus(0.03, 0.01, GOLD, 0.3, 0.17, 0.0, 8));
  }
  // big nose, cheeky grin with teeth
  head.add(ell(0.06, '#6ac43a', 0, 0.16, 0.21, 0.9, 0.8, 1.3, 10));
  head.add(rbox(0.12, 0.03, 0.02, '#4a1a10', 0, 0.085, 0.18, { r: 0.008 }));
  for (const s of [-1, 1]) head.add(box(0.025, 0.025, 0.02, '#ffffff', s * 0.03, 0.08, 0.19));
  brows(head, '#3a7a1a', -0.25);
  if (t >= 2) {
    head.add(ell(0.21, '#d6402a', 0, 0.28, -0.02, 1.02, 0.5, 1.02, 12));
    head.add(cone(0.05, 0.16, smooth('#d6402a'), 0, 0.2, -0.22, 6).rotateX(-1.4));
  }
  // loot sack
  const hips = part(r, 'body');
  const sack = new THREE.Group();
  sack.add(ell(0.15, '#c8a46a', 0, 0, 0, 1, 1.1, 0.9, 12));
  sack.add(torus(0.05, 0.02, '#8a6a3a', 0, 0.15, 0, 8));
  sack.add(gem(0.05, GOLD, 0.02, 0.2, 0.02), gem(0.04, GOLD, -0.04, 0.18, 0.0));
  sack.position.set(0, 0.22, -0.22);
  hips.add(sack);
  hips.add(rbox(0.04, 0.3, 0.02, '#8a6a3a', 0.08, 0.08, 0.13, { r: 0.01 }).rotateZ(0.7));
  // little dagger
  const dagger = new THREE.Group();
  dagger.add(rbox(0.04, 0.08, 0.04, LEATHER_DARK, 0, -0.04, 0, { r: 0.01 }), rbox(0.05, 0.22, 0.02, t >= 1 ? STEEL : '#b8bcc4', 0, 0.04, 0, { r: 0.01 }));
  dagger.rotation.x = Math.PI / 2;
  holdIn(r, 'armR', dagger);
  r.scale.setScalar(0.68);
  return r;
}

function wallbreaker(level) {
  const t = tierOf(level);
  const root = new THREE.Group();
  const hips = named('body');
  hips.position.y = 0.36;
  root.add(hips);
  // spine, ribs, pelvis
  hips.add(cyl(0.025, 0.025, 0.34, BONE, 0, 0, -0.04, 6));
  for (let i = 0; i < 4; i++) hips.add(torus(0.11 - i * 0.012, 0.018, BONE, 0, 0.32 - i * 0.07, 0.0, 12));
  hips.add(rbox(0.22, 0.08, 0.14, BONE, 0, -0.06, 0, { r: 0.04 }));
  // skull
  const head = named('head');
  head.position.y = 0.38;
  hips.add(head);
  head.add(ell(0.17, BONE, 0, 0.2, 0, 1, 1, 1, 14));
  head.add(rbox(0.2, 0.08, 0.14, BONE, 0, 0.04, 0.04, { r: 0.03 }));
  for (const s of [-1, 1]) head.add(ell(0.045, '#1a1410', s * 0.065, 0.2, 0.15, 1, 1.1, 0.5, 10));
  for (let i = 0; i < 4; i++) head.add(box(0.025, 0.035, 0.02, '#ffffff', -0.045 + i * 0.03, 0.06, 0.11));
  head.add(ell(0.02, '#1a1410', 0, 0.135, 0.165, 1, 1.3, 0.5, 6));
  if (t >= 2) head.add(ell(0.18, IRON, 0, 0.27, 0, 1.05, 0.6, 1.05, 12), rbox(0.03, 0.12, 0.05, IRON, 0, 0.18, 0.17, { r: 0.01 }));
  // bony arms raised to carry the bomb
  for (const side of [-1, 1]) {
    const arm = named(side < 0 ? 'armL' : 'armR');
    arm.position.set(side * 0.13, 0.32, 0);
    arm.add(cyl(0.022, 0.022, 0.22, BONE, 0, -0.22, 0, 6), sphere(0.03, BONE, 0, -0.22, 0, 6, 4), cyl(0.02, 0.02, 0.2, BONE, 0, -0.42, 0, 6));
    const hand = sphere(0.04, BONE, 0, -0.44, 0, 6, 4);
    hand.name = 'hand';
    arm.add(hand);
    arm.rotation.x = Math.PI - 0.3;
    arm.rotation.z = side * 0.25;
    hips.add(arm);
  }
  for (const side of [-1, 1]) {
    const leg = named(side < 0 ? 'legL' : 'legR');
    leg.position.set(side * 0.07, 0.36, 0);
    leg.add(cyl(0.024, 0.024, 0.18, BONE, 0, -0.18, 0, 6), sphere(0.032, BONE, 0, -0.19, 0, 6, 4), cyl(0.022, 0.022, 0.16, BONE, 0, -0.35, 0, 6));
    leg.add(rbox(0.07, 0.04, 0.12, BONE, 0, -0.36, 0.03, { r: 0.015 }));
    root.add(leg);
  }
  // the bomb, held over the head
  const bomb = new THREE.Group();
  bomb.name = 'bomb';
  if (t >= 1) {
    bomb.add(cyl(0.2, 0.2, 0.34, mat('#7a4a24', { tex: 'plank' }), 0, -0.17, 0, 12));
    bomb.add(torus(0.205, 0.02, IRON, 0, -0.12, 0, 14), torus(0.205, 0.02, IRON, 0, 0.12, 0, 14));
    bomb.rotation.z = Math.PI / 2;
  } else {
    bomb.add(ell(0.22, '#2a2d34', 0, 0, 0, 1, 1, 1, 16));
    bomb.add(ell(0.06, '#ffffff', -0.08, 0.1, 0.12, 1, 0.7, 0.4, 8));
  }
  const fuse = new THREE.Group();
  fuse.add(cyl(0.03, 0.035, 0.06, IRON, 0, 0, 0, 8), cyl(0.012, 0.012, 0.12, '#d8b878', 0.02, 0.05, 0, 4));
  const spark = gem(0.05, glow('#ffe24a', '#ff8800'), 0.03, 0.18, 0);
  spark.name = 'spark';
  fuse.add(spark);
  fuse.position.y = t >= 1 ? 0.2 : 0.2;
  if (t >= 1) fuse.rotation.z = -Math.PI / 2;
  bomb.add(fuse);
  bomb.position.set(0, 0.82, 0.02);
  hips.add(bomb);
  root.scale.setScalar(0.8);
  return root;
}

function wizard(level) {
  const t = tierOf(level);
  const robe = t >= 2 ? '#7a3fc8' : '#3f63e0';
  const robeDark = t >= 2 ? '#552a96' : '#2a44a8';
  const r = body({ top: robe, topDark: robeDark, bottom: robe, boots: '#3a2a5a', belt: GOLD_DARK, buckle: GOLD, width: 0.95 });
  const hips = part(r, 'body');
  // long robe skirt over the legs
  hips.add(cyl(0.2, 0.3, 0.34, smooth(robe), 0, -0.36, 0, 14));
  hips.add(torus(0.3, 0.02, GOLD_DARK, 0, -0.35, 0, 16));
  // wide sleeves
  for (const n of ['armL', 'armR']) part(r, n).add(cyl(0.07, 0.11, 0.14, smooth(robe), 0, -0.3, 0, 10));
  const head = part(r, 'head');
  // long white beard and moustache
  head.add(cone(0.14, 0.32, smooth('#f2f2f2'), 0, -0.2, 0.11, 10).rotateX(Math.PI));
  head.children[head.children.length - 1].position.set(0, 0.09, 0.12);
  mustache(head, '#ffffff', false);
  brows(head, '#ffffff', -0.1);
  // pointed hat with brim and band
  head.add(cyl(0.29, 0.29, 0.03, smooth(robeDark), 0, 0.3, 0, 18));
  const hat = cone(0.19, 0.42, smooth(robe), 0, 0.32, 0, 14);
  head.add(hat);
  const tip = cone(0.06, 0.16, smooth(robe), 0.06, 0.66, -0.04, 8);
  tip.rotation.z = -0.6;
  head.add(tip);
  head.add(torus(0.19, 0.025, t >= 1 ? GOLD : robeDark, 0, 0.35, 0, 16));
  if (t >= 1) head.add(gem(0.04, glow('#9af0ff', '#2080a0'), 0, 0.38, 0.19));
  // cape
  if (t >= 2) hips.add(rbox(0.46, 0.6, 0.03, '#3a1a6a', 0, -0.26, -0.15, { r: 0.015 }));
  // fireball in hand
  const fire = new THREE.Group();
  fire.add(ell(0.08, glow('#ffb03a', '#ff6a00'), 0, 0, 0, 1, 1, 1, 10), ell(0.05, glow('#fff0a0', '#ffaa00'), 0, 0.01, 0.02, 1, 1, 1, 8));
  fire.name = 'fire';
  fire.position.set(0, -0.05, 0.08);
  holdIn(r, 'armR', fire);
  r.scale.setScalar(0.88);
  return r;
}

function balloon(level) {
  const t = tierOf(level);
  const g = new THREE.Group();
  const c1 = t >= 2 ? '#3a2a3a' : '#6a4a30';
  const c2 = t >= 2 ? '#b8302a' : t >= 1 ? '#8a6a40' : '#a04a2a';
  // striped envelope
  const n = 10;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.SphereGeometry(0.72, 4, 12, (i / n) * Math.PI * 2, (Math.PI * 2) / n);
    const m = mesh(geo, smooth(i % 2 ? c1 : c2));
    m.position.y = 1.25;
    m.scale.y = 1.05;
    g.add(m);
  }
  g.add(torus(0.7, 0.035, t >= 1 ? STEEL_DARK : LEATHER_DARK, 0, 1.0, 0, 20));
  g.add(cone(0.32, 0.25, smooth(c1), 0, 0.42, 0, 12).rotateX(Math.PI));
  g.children[g.children.length - 1].position.y = 0.67;
  if (t >= 1) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.add(rbox(0.18, 0.18, 0.03, STEEL_DARK, Math.cos(a) * 0.62, 1.45, Math.sin(a) * 0.62, { r: 0.02 }).rotateY(-a + Math.PI / 2));
  }
  if (t >= 2) {
    const skull = new THREE.Group();
    skull.add(ell(0.13, BONE, 0, 0, 0, 1, 1, 0.5, 12));
    skull.add(ell(0.03, '#1a1410', -0.045, 0.01, 0.06, 1, 1, 0.5, 6), ell(0.03, '#1a1410', 0.045, 0.01, 0.06, 1, 1, 0.5, 6));
    skull.position.set(0, 1.35, 0.7);
    g.add(skull);
  }
  // ropes
  for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
    const rope = cyl(0.008, 0.008, 0.62, '#d8c8a0', 0, 0, 0, 4);
    rope.position.set(x * 1.2, 0.3, z * 1.2);
    rope.rotation.set(z * 0.5, 0, -x * 0.5);
    g.add(rope);
  }
  // wicker basket
  g.add(rbox(0.5, 0.3, 0.5, mat('#c08a4a', { tex: 'thatch' }), 0, 0, 0, { r: 0.05 }));
  g.add(rbox(0.54, 0.05, 0.54, LEATHER_DARK, 0, 0.28, 0, { r: 0.02 }));
  // skeleton pilot peeking out
  const pilot = new THREE.Group();
  pilot.add(ell(0.11, BONE, 0, 0, 0, 1, 1, 1, 12));
  pilot.add(ell(0.028, '#1a1410', -0.04, 0.0, 0.09, 1, 1.1, 0.5, 6), ell(0.028, '#1a1410', 0.04, 0.0, 0.09, 1, 1.1, 0.5, 6));
  pilot.add(ell(0.12, t >= 1 ? STEEL_DARK : LEATHER, 0, 0.06, -0.01, 1, 0.55, 1, 10));
  pilot.position.set(0.05, 0.42, 0.05);
  g.add(pilot);
  // hanging bombs
  for (const [x, z] of [[-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) {
    g.add(cyl(0.006, 0.006, 0.12, '#d8c8a0', x, -0.1, z, 4), ell(0.08, '#2a2d34', x, -0.15, z, 1, 1, 1, 10));
  }
  return g;
}

function dragon(level) {
  const t = tierOf(level);
  const main = ['#e0442c', '#9a2a3a', '#5a3a9a'][t];
  const dark = ['#a82a1a', '#6a1a2a', '#3a2068'][t];
  const belly = ['#f6c86a', '#f0b05a', '#c8a0ff'][t];
  const horn = t >= 2 ? GOLD : '#f2e6c8';
  const g = new THREE.Group();
  // body and belly plates
  g.add(ell(0.5, main, 0, 0, 0, 1, 0.85, 1.35, 16));
  for (let i = 0; i < 4; i++) g.add(ell(0.2, belly, 0, -0.3 + i * 0.03, 0.4 - i * 0.22, 1.5, 0.35, 0.8, 10));
  // back spikes
  for (let i = 0; i < 5; i++) g.add(cone(0.07 - i * 0.008, 0.18, smooth(dark), 0, 0.36 - i * 0.03, 0.4 - i * 0.24, 4));
  // neck and head
  const head = named('head');
  head.position.set(0, 0.32, 0.62);
  g.add(ell(0.2, main, 0, 0.2, 0.52, 1, 1.2, 1, 12));
  head.add(ell(0.27, main, 0, 0.12, 0.08, 1, 0.85, 1.05, 14));
  head.add(rbox(0.3, 0.16, 0.32, smooth(main), 0, 0.02, 0.28, { r: 0.07 }));
  const jaw = named('jaw');
  jaw.position.set(0, 0.02, 0.18);
  jaw.add(rbox(0.26, 0.07, 0.3, smooth(belly), 0, -0.07, 0.1, { r: 0.03 }));
  for (const s of [-1, 1]) jaw.add(cone(0.02, 0.06, '#ffffff', s * 0.09, -0.01, 0.22, 4));
  head.add(jaw);
  for (const s of [-1, 1]) {
    head.add(ell(0.055, '#fff6c0', s * 0.13, 0.17, 0.25, 1, 0.8, 0.6, 10), ell(0.028, '#1a1410', s * 0.135, 0.17, 0.285, 0.7, 1.3, 0.5, 8));
    head.add(rbox(0.1, 0.03, 0.05, dark, s * 0.13, 0.23, 0.25, { r: 0.01 }).rotateZ(s * 0.35));
    const hrn = cone(0.05, 0.26, smooth(horn), 0, 0, 0, 8);
    hrn.position.set(s * 0.13, 0.26, -0.02);
    hrn.rotation.set(-0.9, 0, -s * 0.35);
    head.add(hrn);
    head.add(ell(0.02, '#3a1a10', s * 0.06, 0.08, 0.44, 1, 1, 1, 6));
  }
  g.add(head);
  // legs
  for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.35], [0.3, -0.35]]) {
    g.add(ell(0.13, main, x, -0.32, z, 1, 1.2, 1, 10));
    for (const dx of [-0.04, 0, 0.04]) g.add(cone(0.02, 0.06, '#f2e6c8', x + dx, -0.5, z + 0.1, 4).rotateX(Math.PI / 2));
  }
  // tail
  const tail = named('tail');
  tail.position.set(0, 0, -0.62);
  tail.add(ell(0.2, main, 0, 0, -0.15, 0.9, 0.8, 1.4, 12), ell(0.13, main, 0, -0.02, -0.45, 0.9, 0.8, 1.4, 10), ell(0.08, main, 0, -0.04, -0.68, 0.9, 0.8, 1.3, 8));
  const spade = cone(0.13, 0.22, smooth(dark), 0, 0, 0, 4);
  spade.position.set(0, -0.04, -0.82);
  spade.rotation.x = -Math.PI / 2;
  spade.scale.set(1, 1, 0.3);
  tail.add(spade);
  g.add(tail);
  // wings: bony arm plus membrane
  for (const side of [-1, 1]) {
    const wing = named(side < 0 ? 'wingL' : 'wingR');
    wing.position.set(side * 0.3, 0.28, 0.05);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.2);
    shape.lineTo(1.25, 0.32);
    shape.lineTo(1.05, -0.05);
    shape.lineTo(0.8, 0.02);
    shape.lineTo(0.6, -0.3);
    shape.lineTo(0.38, -0.12);
    shape.lineTo(0.12, -0.45);
    shape.lineTo(0, -0.2);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    if (side < 0) geo.scale(-1, 1, 1);
    const memb = new THREE.Mesh(geo, mat(dark, { side: THREE.DoubleSide }));
    memb.castShadow = true;
    wing.add(memb);
    const bone = rbox(1.2, 0.05, 0.05, smooth(main), 0, 0, 0, { r: 0.02 });
    bone.position.set(side * 0.62, 0, 0.26);
    bone.rotation.y = side * -0.1;
    wing.add(bone);
    wing.add(cone(0.03, 0.12, smooth(horn), side * 1.25, 0, 0.32, 4).rotateZ(-side * Math.PI / 2));
    g.add(wing);
  }
  g.scale.setScalar(1.05);
  return g;
}

// ---------- villagers / builders ----------
export function personModel({ skin, shirt, pants, hair, hairStyle = 0, beard = null, hat = null, scale = 0.62, apron = null }) {
  const r = body({ skin, top: shirt, topDark: null, bottom: pants, boots: LEATHER_DARK, belt: LEATHER_DARK, buckle: '#c9b48a', width: 0.95 });
  const head = part(r, 'head');
  if (hair) {
    if (hairStyle === 1) {
      head.add(ell(0.205, hair, 0, 0.27, -0.02, 1.03, 0.62, 1.03));
      head.add(ell(0.07, hair, 0, 0.36, 0.02, 1.2, 0.8, 1, 8));
    } else if (hairStyle === 2) {
      head.add(ell(0.205, hair, 0, 0.25, -0.03, 1.04, 0.7, 1.04));
      head.add(ell(0.15, hair, 0, 0.12, -0.12, 1.25, 1.4, 0.7, 10));
    } else {
      head.add(ell(0.205, hair, 0, 0.27, -0.025, 1.03, 0.55, 1.03));
    }
  }
  if (beard) {
    head.add(ell(0.13, beard, 0, 0.07, 0.11, 1.2, 0.8, 0.7, 10));
    mustache(head, beard, false);
  }
  if (hat) {
    head.add(cyl(0.25, 0.25, 0.03, smooth(hat), 0, 0.32, 0, 16));
    head.add(cyl(0.16, 0.19, 0.14, smooth(hat), 0, 0.33, 0, 14));
    head.add(torus(0.18, 0.015, '#3a2a1a', 0, 0.36, 0, 14));
  }
  if (apron) part(r, 'body').add(rbox(0.3, 0.34, 0.02, apron, 0, -0.14, 0.135, { r: 0.01 }));
  r.scale.setScalar(scale);
  return finish(r);
}

// ---------- merging, caching, rig lookup ----------
// Merge each rig segment's direct child meshes by material. Keeps limbs animatable
// while cutting a troop from ~60 meshes to roughly one per material per segment.
function mergeDirect(groupObj) {
  const buckets = new Map();
  const remove = [];
  for (const c of groupObj.children) {
    if (!c.isMesh || c.children.length || c.name || c.material.transparent) continue;
    c.updateMatrix();
    const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(c.matrix);
    const list = buckets.get(c.material) || [];
    list.push(g);
    buckets.set(c.material, list);
    remove.push(c);
  }
  for (const c of remove) groupObj.remove(c);
  for (const [m, list] of buckets) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    const mm = new THREE.Mesh(merged, m);
    mm.castShadow = true;
    mm.receiveShadow = false;
    groupObj.add(mm);
  }
}

function finish(root) {
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh) groups.push(o);
  });
  for (const g of groups) mergeDirect(g);
  return root;
}

export function attachRig(obj) {
  const get = (n) => obj.getObjectByName(n) || null;
  const rig = {
    body: get('body'),
    head: get('head'),
    legL: get('legL'),
    legR: get('legR'),
    armL: get('armL'),
    armR: get('armR'),
    wingL: get('wingL'),
    wingR: get('wingR'),
    tail: get('tail'),
    jaw: get('jaw'),
    spark: get('spark'),
    fire: get('fire'),
  };
  // the baseline pose, so animations can add to it
  rig.baseY = rig.body ? rig.body.position.y : 0;
  rig.rest = {};
  for (const [k, v] of Object.entries(rig)) if (v && v.isObject3D) rig.rest[k] = v.rotation.clone();
  obj.userData.rig = rig;
  return obj;
}

const BUILDERS = { barbarian, archer, giant, goblin, wallbreaker, wizard, balloon, dragon };
const templates = new Map();

export function detailedTroop(type, level = 1) {
  const t = tierOf(level);
  const key = `${type}:${t}`;
  let tpl = templates.get(key);
  if (!tpl) {
    const make = BUILDERS[type] || barbarian;
    tpl = finish(make(level));
    templates.set(key, tpl);
  }
  return attachRig(tpl.clone(true));
}

// ---------- animation ----------
// mode: 'walk' | 'attack' | 'work' | 'idle'. t: running time in seconds.
// o.speed scales the walk cycle, o.pulse (0..1) is the attack swing.
export function animateRig(rig, mode, t, o = {}) {
  if (!rig) return;
  const R = rig.rest;
  const carry = !!rig.spark; // wall breakers hold their bomb overhead
  const setX = (p, v) => p && (p.rotation.x = R[keyOf(rig, p)].x + v);
  if (rig.body) rig.body.position.y = rig.baseY;
  if (rig.legL) {
    if (mode === 'walk') {
      const s = Math.sin(t * 12 * (o.speed || 1));
      setX(rig.legL, s * 0.75);
      setX(rig.legR, -s * 0.75);
      if (!carry) {
        setX(rig.armL, -s * 0.55);
        setX(rig.armR, s * 0.55);
      }
      rig.body.position.y = rig.baseY + Math.abs(s) * 0.035;
      if (rig.body) rig.body.rotation.x = 0.06;
    } else if (mode === 'attack') {
      const p = o.pulse || 0;
      setX(rig.legL, 0.15);
      setX(rig.legR, -0.25);
      if (!carry) {
        setX(rig.armR, -0.5 - p * 1.9);
        setX(rig.armL, -0.35);
      }
      if (rig.body) rig.body.rotation.x = 0.05 + p * 0.18;
    } else if (mode === 'work') {
      setX(rig.legL, 0);
      setX(rig.legR, 0);
      setX(rig.armR, -1.2 - Math.sin(t * 8) * 0.9);
      setX(rig.armL, -0.45);
      if (rig.body) rig.body.rotation.x = 0.08 + Math.max(0, Math.sin(t * 8)) * 0.06;
    } else {
      setX(rig.legL, 0);
      setX(rig.legR, 0);
      if (!carry) {
        setX(rig.armL, Math.sin(t * 1.6) * 0.05);
        setX(rig.armR, -Math.sin(t * 1.6) * 0.05);
      }
      rig.body.position.y = rig.baseY + Math.sin(t * 2.2) * 0.008;
      if (rig.body) rig.body.rotation.x = 0;
    }
  }
  if (rig.head && rig.legL) rig.head.rotation.y = Math.sin(t * 0.7) * 0.15;
  if (rig.wingL) {
    const f = Math.sin(t * 6);
    rig.wingL.rotation.z = R.wingL.z + f * 0.55;
    rig.wingR.rotation.z = R.wingR.z - f * 0.55;
  }
  if (rig.tail) {
    if (rig.legL) rig.tail.rotation.x = R.tail.x + Math.sin(t * 5) * 0.15;
    else rig.tail.rotation.y = R.tail.y + Math.sin(t * 2.5) * 0.35;
  }
  if (rig.jaw) rig.jaw.rotation.x = R.jaw.x + (mode === 'attack' ? (o.pulse || 0) * 0.5 : Math.max(0, Math.sin(t * 1.3)) * 0.08);
  if (rig.spark) rig.spark.scale.setScalar(0.8 + Math.random() * 0.6);
  if (rig.fire) rig.fire.scale.setScalar(1 + Math.sin(t * 14) * 0.12 + (o.pulse || 0) * 0.4);
}

function keyOf(rig, p) {
  if (!p._rigKey) for (const [k, v] of Object.entries(rig)) if (v === p) p._rigKey = k;
  return p._rigKey;
}
