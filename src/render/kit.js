// Modeling kit: cached materials and geometry, primitive helpers, and `bake`,
// which merges static parts, projects texture UVs and adds baked ambient occlusion.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { texture, TEX_SCALE } from './textures.js';

// ---------- materials ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    const { tex, smooth, ...rest } = opts;
    m = new THREE.MeshLambertMaterial({ color, flatShading: !smooth, ...rest });
    if (tex) {
      m.map = texture(tex);
      m.userData.uvScale = 1 / (TEX_SCALE[tex] || 1);
    }
    matCache.set(key, m);
  }
  return m;
}

const aoMatCache = new Map();
function aoMaterial(m) {
  let v = aoMatCache.get(m);
  if (!v) {
    v = m.clone();
    v.vertexColors = true;
    v.userData = { ...m.userData };
    aoMatCache.set(m, v);
  }
  return v;
}

// ---------- geometry ----------
const geoCache = new Map();
function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Sharp box with its bottom at y.
export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = mesh(cachedGeo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), color, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}

// Chamfered box with its bottom at y. opts.r sets the bevel radius.
export function rbox(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const { r = Math.min(w, h, d) * 0.14, ...rest } = opts;
  const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.001);
  const m = mesh(cachedGeo(`rb${w},${h},${d},${rr}`, () => new RoundedBoxGeometry(w, h, d, 1, rr)), color, rest);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 10, opts) {
  const m = mesh(cachedGeo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), color, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}

// Horizontal cylinder along X (logs, axles, barrels lying down).
export function cylX(r, len, color, x = 0, y = 0, z = 0, seg = 10, opts) {
  const m = cyl(r, r, len, color, 0, 0, 0, seg, opts);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

// Horizontal cylinder along Z.
export function cylZ(r, len, color, x = 0, y = 0, z = 0, seg = 10, opts) {
  const m = cyl(r, r, len, color, 0, 0, 0, seg, opts);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
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

export function dome(r, color, x = 0, y = 0, z = 0, seg = 12, opts) {
  const m = mesh(cachedGeo(`d${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2)), color, opts);
  m.position.set(x, y, z);
  return m;
}

export function rock(r, color, x = 0, y = 0, z = 0, detail = 0, opts) {
  const m = mesh(cachedGeo(`r${r},${detail}`, () => new THREE.DodecahedronGeometry(r, detail)), color, opts);
  m.position.set(x, y, z);
  return m;
}

export function gem(r, color, x = 0, y = 0, z = 0, opts) {
  const m = mesh(cachedGeo(`o${r}`, () => new THREE.OctahedronGeometry(r, 0)), color, opts);
  m.position.set(x, y, z);
  return m;
}

// Flat ring lying on the ground plane (bands, rims).
export function torus(r, tube, color, x = 0, y = 0, z = 0, seg = 16, opts) {
  const m = mesh(cachedGeo(`t${r},${tube},${seg}`, () => new THREE.TorusGeometry(r, tube, 5, seg)), color, opts);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

// Gable (triangular prism) roof running along X, base width d, bottom at y.
export function gable(w, h, d, color, x = 0, y = 0, z = 0, opts) {
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
  const m = mesh(g, color, opts);
  m.position.set(x, y, z);
  return m;
}

// Four-sided hip roof over a w x d rectangle, bottom at y.
export function hipRoof(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = mesh(cachedGeo('hip4', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4)), color, opts);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children.flat()) if (c) g.add(c);
  return g;
}

export function at(obj, x = 0, y = 0, z = 0, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

// Marks a sub-tree as animated: it keeps its own meshes instead of being merged.
export function dyn(g, name) {
  g.userData.dyn = true;
  if (name) g.name = name;
  return g;
}

// Repeat `make()` on the four sides of a footprint; each copy faces outward (+z is "front").
export function onSides(make, dist, sides = [0, 1, 2, 3]) {
  const g = new THREE.Group();
  for (const s of sides) {
    const o = make(s);
    const a = (s * Math.PI) / 2;
    o.position.x += Math.sin(a) * dist;
    o.position.z += Math.cos(a) * dist;
    o.rotation.y += a;
    g.add(o);
  }
  return g;
}

// ---------- baking ----------
function projectUVs(geo, matrix, scale) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, i + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, i + 2).applyMatrix4(matrix);
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    [a, b, c].forEach((p, k) => {
      let u, v;
      if (ay >= ax && ay >= az) {
        u = p.x;
        v = p.z;
      } else if (ax >= az) {
        u = p.z;
        v = p.y;
      } else {
        u = p.x;
        v = p.y;
      }
      uv[(i + k) * 2] = u * scale;
      uv[(i + k) * 2 + 1] = v * scale;
    });
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Darken low and downward-facing vertices: cheap baked ambient occlusion.
function addAO(geo) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let ao = 1 - 0.38 * Math.exp(-Math.max(0, y) / 0.32);
    if (nrm && nrm.getY(i) < -0.5) ao *= 0.72;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function prepGeometry(o) {
  const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Merge static meshes by material to keep draw calls low. Sub-trees marked with dyn() stay separate.
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (o === root || !o.isMesh) return;
    let p = o;
    let isDyn = false;
    while (p && p !== root) {
      if (p.userData.dyn) isDyn = true;
      p = p.parent;
    }
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (isDyn || o.material.transparent || o.userData.keep) {
      // keep the mesh, but give textured ones projected UVs
      if (o.material.map) {
        const g = prepGeometry(o);
        projectUVs(g, rel, o.material.userData.uvScale || 1);
        o.geometry = g;
      }
      return;
    }
    const g = prepGeometry(o);
    g.applyMatrix4(rel);
    projectUVs(g, new THREE.Matrix4(), o.material.userData.uvScale || 1);
    addAO(g);
    const m = aoMaterial(o.material);
    const list = buckets.get(m) || [];
    list.push(g);
    buckets.set(m, list);
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
  const empties = [];
  root.traverse((o) => {
    if (o !== root && o.type === 'Group' && o.children.length === 0 && !o.userData.dyn) empties.push(o);
  });
  for (const e of empties) e.parent?.remove(e);
  return root;
}
