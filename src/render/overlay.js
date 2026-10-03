// HTML elements anchored to 3D positions (health bars, timers, bubbles, floating text).

import * as THREE from 'three';

export class Overlay {
  constructor(engine, root) {
    this.engine = engine;
    this.root = root;
    this.items = new Set();
    this.tmp = new THREE.Vector3();
  }

  // pos: Vector3 or () => Vector3
  add(el, pos, { offsetY = 0, interactive = false, life = 0, rise = 0 } = {}) {
    el.classList.add('ov');
    if (interactive) el.classList.add('ov-interactive');
    this.root.appendChild(el);
    const item = { el, pos, offsetY, life, age: 0, rise };
    this.items.add(item);
    this.place(item);
    return item;
  }

  remove(item) {
    if (!item || !this.items.has(item)) return;
    item.el.remove();
    this.items.delete(item);
  }

  clear() {
    for (const it of this.items) it.el.remove();
    this.items.clear();
  }

  place(it) {
    const p = typeof it.pos === 'function' ? it.pos() : it.pos;
    if (!p) {
      it.el.style.display = 'none';
      return;
    }
    const s = this.engine.worldToScreen(p, this.tmp);
    it.el.style.display = s.visible ? '' : 'none';
    const y = s.y - it.offsetY - it.rise * it.age;
    it.el.style.transform = `translate(${s.x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  update(dt) {
    for (const it of [...this.items]) {
      if (it.life) {
        it.age += dt;
        if (it.age >= it.life) {
          this.remove(it);
          continue;
        }
        it.el.style.opacity = String(Math.min(1, 2 * (1 - it.age / it.life)));
      }
      this.place(it);
    }
  }

  floatText(text, pos, cls = '') {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.textContent = text;
    return this.add(el, pos.clone ? pos.clone() : pos, { life: 1.3, rise: 40, offsetY: 20 });
  }
}

export function hpBar(cls = '') {
  const el = document.createElement('div');
  el.className = `hpbar ${cls}`;
  const fill = document.createElement('div');
  fill.className = 'hpbar-fill';
  el.appendChild(fill);
  el.setValue = (f) => {
    fill.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`;
    el.classList.toggle('low', f < 0.35);
  };
  return el;
}
