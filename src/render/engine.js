// Renderer, isometric camera, lights and pointer input.

import * as THREE from 'three';
import { GRID } from '../data/buildings.js';

const YAW = Math.PI / 4;
// a lower camera shows more of the building fronts
const PITCH = THREE.MathUtils.degToRad(37);
const CAM_DIST = 90;
const TAP_SLOP = 7;

export class Engine {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#5f9a3a');

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 400);
    this.target = new THREE.Vector3(0, 0, 0);
    this.viewHeight = 34;
    this.zoom = 1.6;
    this.minZoom = 0.55;
    this.maxZoom = 3;

    this.setupLights();

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.handler = null;
    this.pointers = new Map();
    this.press = null;
    this.pinch = null;

    this.resize();
    if (this.width < this.height) this.setZoom(1.1);
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight('#dff1ff', '#5b7a33', 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4dc', 2.1);
    sun.position.set(-18, 40, 14);
    sun.castShadow = true;
    const big = Math.min(window.screen?.width || 1920, window.screen?.height || 1080) > 700;
    sun.shadow.mapSize.set(big ? 4096 : 2048, big ? 4096 : 2048);
    const s = 34;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 120 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    // keep the village roughly framed on narrow (portrait) screens
    this.viewHeight = w < h ? 34 * (h / w) * 0.62 : 34;
    this.updateCamera();
  }

  updateCamera() {
    const aspect = this.width / this.height;
    const hh = this.viewHeight / this.zoom / 2;
    const cam = this.camera;
    cam.left = -hh * aspect;
    cam.right = hh * aspect;
    cam.top = hh;
    cam.bottom = -hh;
    const lim = GRID * 0.62;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);
    const dir = new THREE.Vector3(Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(YAW));
    cam.position.copy(this.target).addScaledVector(dir, CAM_DIST);
    cam.lookAt(this.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  setZoom(z, anchorScreen = null) {
    const before = anchorScreen ? this.screenToGround(anchorScreen.x, anchorScreen.y) : null;
    this.zoom = THREE.MathUtils.clamp(z, this.minZoom, this.maxZoom);
    this.updateCamera();
    if (before) {
      const after = this.screenToGround(anchorScreen.x, anchorScreen.y);
      if (after) {
        this.target.add(before.sub(after));
        this.updateCamera();
      }
    }
  }

  ndc(sx, sy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
  }

  screenToGround(sx, sy) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, p) ? p : null;
  }

  pick(sx, sy, objects) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.length ? hits[0] : null;
  }

  worldToScreen(v, out = new THREE.Vector3()) {
    out.copy(v).project(this.camera);
    return { x: ((out.x + 1) / 2) * this.width, y: ((1 - out.y) / 2) * this.height, visible: out.z < 1 && out.z > -1 };
  }

  setHandler(h) {
    this.handler = h;
  }

  info(e) {
    const ground = this.screenToGround(e.clientX, e.clientY);
    return {
      sx: e.clientX,
      sy: e.clientY,
      ground,
      // fractional tile coordinates
      tx: ground ? ground.x + GRID / 2 : NaN,
      ty: ground ? ground.z + GRID / 2 : NaN,
      event: e,
    };
  }

  bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
        if (this.press?.captured) this.handler?.dragEnd?.(this.info(e));
        this.press = null;
        return;
      }
      if (this.pointers.size > 2) return;
      const info = this.info(e);
      const captured = this.handler?.pointerDown?.(info) === 'capture';
      this.press = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        anchor: info.ground,
        dragging: false,
        captured,
        time: performance.now(),
      };
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p) {
        p.x = e.clientX;
        p.y = e.clientY;
      }
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setZoom((this.pinch.zoom * d) / this.pinch.dist, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        return;
      }
      const pr = this.press;
      if (!pr || pr.id !== e.pointerId) {
        if (!this.pointers.size) this.handler?.hover?.(this.info(e));
        return;
      }
      pr.x = e.clientX;
      pr.y = e.clientY;
      if (!pr.dragging && Math.hypot(e.clientX - pr.startX, e.clientY - pr.startY) > TAP_SLOP) pr.dragging = true;
      if (!pr.dragging) return;
      if (pr.captured) {
        this.handler?.drag?.(this.info(e));
      } else if (pr.anchor) {
        const g = this.screenToGround(e.clientX, e.clientY);
        if (g) {
          this.target.add(pr.anchor.clone().sub(g));
          this.updateCamera();
        }
      }
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const pr = this.press;
      if (!pr || pr.id !== e.pointerId) return;
      this.press = null;
      const info = this.info(e);
      if (pr.captured && pr.dragging) this.handler?.dragEnd?.(info);
      else if (!pr.dragging && e.type === 'pointerup') this.handler?.tap?.(info);
      this.handler?.pointerUp?.(info);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015), { x: e.clientX, y: e.clientY });
      },
      { passive: false },
    );
  }

  // Whether the main pointer is currently held still (used for hold-to-deploy).
  heldPress() {
    const pr = this.press;
    if (!pr || pr.dragging || pr.captured) return null;
    return pr;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export function tileToWorld(x, y) {
  return new THREE.Vector3(x - GRID / 2, 0, y - GRID / 2);
}
