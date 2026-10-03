// Characters, obstacles, projectiles and rubble. Buildings live in buildings.js.

import * as THREE from 'three';
import { mat, mesh, box, cyl, cone, sphere, rock, bake } from './kit.js';
import { detailedTroop, personModel, attachRig } from './troops.js';

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
// Detailed characters live in troops.js.
export function humanoid(opts) {
  return attachRig(personModel({ ...opts, shirt: opts.bareChest ? opts.skin : opts.shirt, scale: opts.scale ?? 0.62 }));
}

export function troopModel(type, level = 1) {
  return detailedTroop(type, level);
}

export function villagerModel(look, jobColor = null) {
  return attachRig(personModel({ skin: look.skin, shirt: look.shirt, pants: look.pants, hair: look.hair, hairStyle: look.hairStyle, hat: jobColor, scale: 0.6 }));
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
