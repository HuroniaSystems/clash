// Grass field, border, and the forest surrounding the village.

import * as THREE from 'three';
import { GRID, BUILD_MARGIN } from '../data/buildings.js';
import { makeRng } from '../util/rng.js';

function grassTexture() {
  const tiles = GRID;
  const px = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = tiles * px;
  const ctx = cv.getContext('2d');
  const rng = makeRng(7);
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const inside = x >= BUILD_MARGIN && y >= BUILD_MARGIN && x < tiles - BUILD_MARGIN && y < tiles - BUILD_MARGIN;
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = inside ? (even ? '#86c447' : '#7fbd42') : even ? '#77b23d' : '#71ac39';
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
  // soft patches and blades
  for (let i = 0; i < 2600; i++) {
    const x = rng() * cv.width, y = rng() * cv.height;
    ctx.fillStyle = rng() < 0.5 ? 'rgba(160,215,90,0.35)' : 'rgba(70,130,40,0.25)';
    ctx.fillRect(x, y, 2 + rng() * 3, 2 + rng() * 3);
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * cv.width, y = rng() * cv.height, r = 20 + rng() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(150,205,80,0.25)');
    grad.addColorStop(1, 'rgba(150,205,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Terrain {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // outer meadow
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: '#5f9a3a' }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.05;
    outer.receiveShadow = true;
    this.group.add(outer);

    // dirt rim around the playable field
    const rim = new THREE.Mesh(new THREE.BoxGeometry(GRID + 1.2, 0.3, GRID + 1.2), new THREE.MeshLambertMaterial({ color: '#9b7a4a' }));
    rim.position.y = -0.17;
    rim.receiveShadow = true;
    this.group.add(rim);

    const field = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), new THREE.MeshLambertMaterial({ map: grassTexture() }));
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0;
    field.receiveShadow = true;
    this.group.add(field);
    this.field = field;

    this.addForest();
    this.addGridLines();
  }

  addForest() {
    const rng = makeRng(11);
    const trunks = [];
    const crowns = [];
    const rocks = [];
    const half = GRID / 2;
    for (let i = 0; i < 520; i++) {
      const x = rng.range(-half - 26, half + 26);
      const z = rng.range(-half - 26, half + 26);
      const dEdge = Math.max(Math.abs(x), Math.abs(z)) - half;
      if (dEdge < 1.2) continue;
      if (rng() < 0.12) rocks.push([x, z, 0.4 + rng() * 0.6]);
      else trunks.push([x, z, 0.8 + rng() * 0.7]);
    }
    const dummy = new THREE.Object3D();
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 1, 6), new THREE.MeshLambertMaterial({ color: '#6e4320', flatShading: true }), trunks.length);
    const crownMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), trunks.length * 2);
    const greens = ['#2f6e34', '#3a8040', '#2b6630', '#447f3a', '#386f2e'].map((c) => new THREE.Color(c));
    trunks.forEach(([x, z, s], i) => {
      dummy.position.set(x, 0.4 * s, z);
      dummy.scale.set(s, 0.8 * s, s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      const col = greens[i % greens.length];
      dummy.position.set(x, 1.2 * s, z);
      dummy.scale.set(1.0 * s, 1.4 * s, 1.0 * s);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i * 2, dummy.matrix);
      crownMesh.setColorAt(i * 2, col);
      dummy.position.set(x, 1.85 * s, z);
      dummy.scale.set(0.7 * s, 1.1 * s, 0.7 * s);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
      crownMesh.setColorAt(i * 2 + 1, col.clone().offsetHSL(0, 0, 0.05));
    });
    trunkMesh.castShadow = crownMesh.castShadow = true;
    this.group.add(trunkMesh, crownMesh);

    const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#9a958c', flatShading: true }), rocks.length);
    rocks.forEach(([x, z, s], i) => {
      dummy.position.set(x, s * 0.4, z);
      dummy.scale.set(s, s * 0.7, s);
      dummy.rotation.set(0, i, 0);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
    });
    rockMesh.castShadow = true;
    this.group.add(rockMesh);
  }

  addGridLines() {
    const pts = [];
    const h = GRID / 2;
    for (let i = BUILD_MARGIN; i <= GRID - BUILD_MARGIN; i++) {
      const v = i - h;
      pts.push(v, 0.02, -h + BUILD_MARGIN, v, 0.02, h - BUILD_MARGIN);
      pts.push(-h + BUILD_MARGIN, 0.02, v, h - BUILD_MARGIN, 0.02, v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18 }));
    this.grid.visible = false;
    this.group.add(this.grid);
  }

  showGrid(v) {
    this.grid.visible = v;
  }
}
