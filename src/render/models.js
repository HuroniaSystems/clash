// Characters, obstacles, projectiles and rubble. Buildings live in buildings.js.

import * as THREE from 'three';
import { mat, mesh, box, cyl, cone, sphere, rock, bake } from './kit.js';

export { mat, box } from './kit.js';
export { buildingModel, cachedWall as wallModel, cachedSite as constructionSite } from './buildings.js';

const C = {
  woodDark: '#7a4a24',
  woodLight: '#d39a5a',
  iron: '#6d717c',
  ironDark: '#3c3f47',
  gold: '#ffcf3f',
};

const geoCache = new Map();
function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
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
