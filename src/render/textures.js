// Procedural, tileable canvas textures. They are mostly light so a material's
// color tints them (one stone texture serves grey, sandstone and dark stone).

import * as THREE from 'three';
import { makeRng } from '../util/rng.js';

const SIZE = 256;
const cache = new Map();

// world units covered by one texture repeat
export const TEX_SCALE = {
  stone: 1.6,
  brick: 1.2,
  plank: 1.4,
  shingle: 1.2,
  thatch: 1.0,
  cobble: 1.6,
  metal: 1.0,
  dirt: 2.0,
  plaster: 2.0,
  crystal: 1.0,
};

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

function shade(v) {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c},${c},${c})`;
}

function speckle(ctx, rng, n, lo, hi, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${lo},${lo},${lo},${rng.range(0.05, 0.18)})`;
    if (rng() < 0.5) ctx.fillStyle = `rgba(${hi},${hi},${hi},${rng.range(0.05, 0.15)})`;
    ctx.fillRect(rng() * SIZE, rng() * SIZE, size * rng.range(0.5, 1.5), size * rng.range(0.5, 1.5));
  }
}

// draw a rect, wrapping horizontally and vertically so the texture tiles
function wrapRect(ctx, x, y, w, h, draw) {
  for (const ox of [-SIZE, 0, SIZE]) {
    for (const oy of [-SIZE, 0, SIZE]) {
      if (x + ox + w < 0 || x + ox > SIZE || y + oy + h < 0 || y + oy > SIZE) continue;
      draw(x + ox, y + oy, w, h);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PAINTERS = {
  stone(ctx, rng) {
    ctx.fillStyle = shade(150);
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rows = [56, 64, 72, 64];
    let y = 0;
    for (const rh of rows) {
      let x = rng.range(0, 40);
      while (x < SIZE + 40) {
        const w = rng.range(46, 92);
        const v = rng.range(205, 248);
        wrapRect(ctx, x + 3, y + 3, w - 6, rh - 6, (xx, yy, ww, hh) => {
          roundRect(ctx, xx, yy, ww, hh, 9);
          ctx.fillStyle = shade(v);
          ctx.fill();
          // bevel: light top-left, dark bottom-right
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(xx + 6, yy + 2, ww - 12, 4);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(xx + 6, yy + hh - 6, ww - 12, 5);
        });
        x += w;
      }
      y += rh;
    }
    speckle(ctx, rng, 900, 90, 255, 3);
  },
  brick(ctx, rng) {
    ctx.fillStyle = shade(170);
    ctx.fillRect(0, 0, SIZE, SIZE);
    const bh = 32, bw = 64;
    for (let r = 0; r < SIZE / bh; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let c = -1; c < SIZE / bw + 1; c++) {
        const v = rng.range(200, 245);
        wrapRect(ctx, c * bw + off + 2, r * bh + 2, bw - 4, bh - 4, (x, y, w, h) => {
          roundRect(ctx, x, y, w, h, 4);
          ctx.fillStyle = shade(v);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(x + 3, y + 1, w - 6, 3);
        });
      }
    }
    speckle(ctx, rng, 600, 100, 255, 2);
  },
  plank(ctx, rng) {
    const ph = 32;
    for (let r = 0; r < SIZE / ph; r++) {
      const v = rng.range(200, 240);
      ctx.fillStyle = shade(v);
      ctx.fillRect(0, r * ph, SIZE, ph);
      // grain
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = `rgba(80,50,20,${rng.range(0.06, 0.16)})`;
        ctx.lineWidth = rng.range(1, 2.2);
        ctx.beginPath();
        const yy = r * ph + rng.range(4, ph - 4);
        ctx.moveTo(0, yy);
        for (let x = 0; x <= SIZE; x += 32) ctx.lineTo(x, yy + Math.sin(x * 0.05 + i) * 1.5);
        ctx.stroke();
      }
      // gap + highlight
      ctx.fillStyle = 'rgba(40,20,5,0.45)';
      ctx.fillRect(0, r * ph, SIZE, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, r * ph + 3, SIZE, 2);
      // butt joints and nails
      const jx = rng.range(0, SIZE);
      ctx.fillStyle = 'rgba(40,20,5,0.4)';
      ctx.fillRect(jx, r * ph, 3, ph);
      ctx.fillStyle = 'rgba(30,30,30,0.6)';
      ctx.fillRect(jx + 7, r * ph + 8, 3, 3);
      ctx.fillRect(jx + 7, r * ph + ph - 11, 3, 3);
    }
  },
  shingle(ctx, rng) {
    ctx.fillStyle = shade(150);
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rh = 32, tw = 32;
    for (let r = SIZE / rh; r >= -1; r--) {
      const off = r % 2 ? tw / 2 : 0;
      for (let c = -1; c <= SIZE / tw; c++) {
        const v = rng.range(205, 250);
        const x = c * tw + off;
        const y = r * rh;
        wrapRect(ctx, x, y, tw, rh + 10, (xx, yy, ww) => {
          const g = ctx.createLinearGradient(0, yy, 0, yy + rh + 10);
          g.addColorStop(0, shade(v * 0.82));
          g.addColorStop(0.75, shade(v));
          g.addColorStop(1, shade(v * 0.7));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(xx + 1, yy);
          ctx.lineTo(xx + ww - 1, yy);
          ctx.lineTo(xx + ww - 1, yy + rh - 2);
          ctx.quadraticCurveTo(xx + ww / 2, yy + rh + 12, xx + 1, yy + rh - 2);
          ctx.closePath();
          ctx.fill();
        });
      }
    }
    speckle(ctx, rng, 300, 90, 255, 2);
  },
  thatch(ctx, rng) {
    ctx.fillStyle = shade(190);
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 1600; i++) {
      const x = rng() * SIZE, y = rng() * SIZE;
      const v = rng.range(150, 255);
      ctx.strokeStyle = shade(v);
      ctx.lineWidth = rng.range(1, 2.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-3, 3), y + rng.range(14, 30));
      ctx.stroke();
    }
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = 'rgba(60,40,10,0.18)';
      ctx.fillRect(0, r * 64 + 58, SIZE, 6);
    }
  },
  cobble(ctx, rng) {
    ctx.fillStyle = shade(140);
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 70; i++) {
      const x = rng() * SIZE, y = rng() * SIZE;
      const r = rng.range(14, 26);
      const v = rng.range(195, 245);
      wrapRect(ctx, x - r, y - r, r * 2, r * 2, (xx, yy, ww) => {
        const cx = xx + ww / 2, cy = yy + ww / 2;
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
        g.addColorStop(0, shade(v + 10));
        g.addColorStop(1, shade(v * 0.8));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.85, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },
  metal(ctx, rng) {
    ctx.fillStyle = shade(225);
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rng.range(0.03, 0.1)})`;
      ctx.fillRect(0, rng() * SIZE, SIZE, 1);
    }
    for (let y = 16; y < SIZE; y += 64) {
      for (let x = 16; x < SIZE; x += 64) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  dirt(ctx, rng) {
    ctx.fillStyle = shade(225);
    ctx.fillRect(0, 0, SIZE, SIZE);
    speckle(ctx, rng, 1800, 120, 255, 3);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(90,70,40,${rng.range(0.08, 0.2)})`;
      ctx.beginPath();
      ctx.arc(rng() * SIZE, rng() * SIZE, rng.range(2, 6), 0, Math.PI * 2);
      ctx.fill();
    }
  },
  plaster(ctx, rng) {
    ctx.fillStyle = shade(238);
    ctx.fillRect(0, 0, SIZE, SIZE);
    speckle(ctx, rng, 900, 170, 255, 4);
    for (let i = 0; i < 10; i++) {
      const x = rng() * SIZE, y = rng() * SIZE;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
      g.addColorStop(0, 'rgba(160,140,110,0.12)');
      g.addColorStop(1, 'rgba(160,140,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, y - 40, 80, 80);
    }
  },
  crystal(ctx, rng) {
    ctx.fillStyle = shade(215);
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rng.range(0.1, 0.35)})`;
      ctx.beginPath();
      const x = rng() * SIZE, y = rng() * SIZE, s = rng.range(10, 40);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.5, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.5, y);
      ctx.fill();
    }
  },
};

export function texture(name) {
  let t = cache.get(name);
  if (t) return t;
  const c = canvas();
  const ctx = c.getContext('2d');
  PAINTERS[name](ctx, makeRng(name.length * 7919 + name.charCodeAt(0)));
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(name, t);
  return t;
}

let blob = null;
// Soft radial shadow used as a contact shadow under buildings.
export function blobTexture() {
  if (blob) return blob;
  const c = canvas();
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.18, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  blob = new THREE.CanvasTexture(c);
  return blob;
}
