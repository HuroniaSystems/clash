// Renders small 3D portraits of buildings and troops into data URLs for the UI.

import * as THREE from 'three';
import { buildingModel, troopModel, wallModel } from './models.js';
import { BUILDINGS } from '../data/buildings.js';

let renderer = null;
const cache = new Map();

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 160);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function snapshot(obj, fit = 1) {
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b8a40', 1.6));
  const sun = new THREE.DirectionalLight('#fff4dc', 2.0);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  scene.add(obj);
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62 * fit;
  const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.1, 100);
  const dir = new THREE.Vector3(1, 0.85, 1).normalize();
  cam.position.copy(center).addScaledVector(dir, 20);
  cam.lookAt(center);
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}

export function buildingPortrait(type, level = 1) {
  const key = `b:${type}:${level}`;
  if (!cache.has(key)) {
    try {
      const obj = type === 'wall' ? wallModel(Math.max(1, level), { e: true }) : buildingModel(type, Math.max(1, level));
      cache.set(key, snapshot(obj, BUILDINGS[type].size <= 2 ? 1.1 : 1));
    } catch {
      cache.set(key, '');
    }
  }
  return cache.get(key);
}

export function troopPortrait(type) {
  const key = `t:${type}`;
  if (!cache.has(key)) {
    try {
      const obj = troopModel(type);
      obj.rotation.y = 0.2;
      cache.set(key, snapshot(obj, 0.95));
    } catch {
      cache.set(key, '');
    }
  }
  return cache.get(key);
}
