// Lightweight particle effects: explosions, dust, sparks, smoke.

import * as THREE from 'three';

const sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export class Effects {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.parts = [];
  }

  spawn({ pos, color, size = 0.3, grow = 2, life = 0.5, vel = null, gravity = 0, geo = sphereGeo, opacity = 0.9, emissive = null }) {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false, emissive: emissive || '#000000', flatShading: true }),
    );
    m.position.copy(pos);
    m.scale.setScalar(size);
    this.group.add(m);
    this.parts.push({ m, life, age: 0, size, grow, vel: vel || new THREE.Vector3(), gravity, opacity });
  }

  explosion(pos, radius = 1, kind = 'fire') {
    const fire = kind !== 'dust';
    this.spawn({ pos, color: fire ? '#ffb030' : '#cbb89a', emissive: fire ? '#ff6a00' : null, size: radius * 0.4, grow: radius * 2.4, life: 0.35 });
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
      this.spawn({ pos: pos.clone(), color: fire ? '#555' : '#b9a684', size: 0.18 + Math.random() * 0.15, grow: 0.6, life: 0.7, vel: v, gravity: -2, opacity: 0.7 });
    }
  }

  hit(pos, color = '#ffffff') {
    this.spawn({ pos, color, size: 0.12, grow: 0.5, life: 0.18, opacity: 0.9, emissive: '#444' });
  }

  dust(pos, size = 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 1.6 * size, 0.6 + Math.random(), Math.sin(a) * 1.6 * size);
      this.spawn({ pos: pos.clone().add(new THREE.Vector3(0, 0.3, 0)), color: '#c9b48e', size: 0.35 * size, grow: 1.5 * size, life: 0.9, vel: v, opacity: 0.75 });
    }
  }

  debris(pos, size = 1) {
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5);
      this.spawn({ pos: pos.clone(), color: i % 2 ? '#7a6a58' : '#a07040', geo: boxGeo, size: 0.12 * size + 0.05, grow: 0, life: 0.9, vel: v, gravity: -14, opacity: 1 });
    }
    this.dust(pos, size * 0.8);
  }

  sparkle(pos, color = '#ffe066') {
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5);
      this.spawn({ pos: pos.clone(), color, emissive: '#806010', size: 0.1, grow: 0, life: 0.8, vel: v, gravity: -3, opacity: 1 });
    }
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        this.group.remove(p.m);
        p.m.material.dispose();
        this.parts.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.m.position.addScaledVector(p.vel, dt);
      if (p.m.position.y < 0.05 && p.gravity) {
        p.m.position.y = 0.05;
        p.vel.multiplyScalar(0.5);
        p.vel.y = Math.abs(p.vel.y) * 0.3;
      }
      p.m.scale.setScalar(p.size + p.grow * k);
      p.m.material.opacity = p.opacity * (1 - k);
    }
  }

  clear() {
    for (const p of this.parts) {
      this.group.remove(p.m);
      p.m.material.dispose();
    }
    this.parts = [];
  }

  dispose() {
    this.clear();
    this.group.parent?.remove(this.group);
  }
}
