// Grid A* with per-tile extra cost (used for walls) and hard blocks (buildings).

const SQRT2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

class MinHeap {
  constructor() {
    this.nodes = [];
    this.keys = [];
  }
  get size() {
    return this.nodes.length;
  }
  clear() {
    this.nodes.length = 0;
    this.keys.length = 0;
  }
  push(node, key) {
    const n = this.nodes, k = this.keys;
    let i = n.length;
    n.push(node);
    k.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      n[i] = n[p];
      k[i] = k[p];
      i = p;
    }
    n[i] = node;
    k[i] = key;
  }
  pop() {
    const n = this.nodes, k = this.keys;
    const top = n[0];
    const lastN = n.pop();
    const lastK = k.pop();
    if (n.length > 0) {
      let i = 0;
      const len = n.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= len) break;
        const r = l + 1;
        const c = r < len && k[r] < k[l] ? r : l;
        if (k[c] >= lastK) break;
        n[i] = n[c];
        k[i] = k[c];
        i = c;
      }
      n[i] = lastN;
      k[i] = lastK;
    }
    return top;
  }
}

export class PathGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.blocked = new Uint8Array(n);
    this.extra = new Float32Array(n);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 0;
    this.heap = new MinHeap();
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isFree(x, y) {
    return this.inBounds(x, y) && !this.blocked[y * this.w + x];
  }

  // Returns a list of [x, y] tiles (start excluded, goal included), [] if the start is a goal, or null.
  findPath(sx, sy, isGoal, heuristic, maxIter = 8000) {
    const { w, h } = this;
    sx = Math.min(w - 1, Math.max(0, sx));
    sy = Math.min(h - 1, Math.max(0, sy));
    if (isGoal(sx, sy)) return [];
    const gen = ++this.gen;
    const heap = this.heap;
    heap.clear();
    const start = sy * w + sx;
    this.g[start] = 0;
    this.came[start] = -1;
    this.seen[start] = gen;
    heap.push(start, heuristic(sx, sy));
    let iter = 0;
    while (heap.size && iter++ < maxIter) {
      const cur = heap.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      const cx = cur % w;
      const cy = (cur - cx) / w;
      if (cur !== start && isGoal(cx, cy)) return this._build(cur);
      const gc = this.g[cur];
      for (let d = 0; d < 8; d++) {
        const [dx, dy, base] = DIRS[d];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (this.blocked[ni] || this.closed[ni] === gen) continue;
        if (dx && dy) {
          // no corner cutting
          if (this.blocked[cy * w + nx] || this.blocked[ny * w + cx]) continue;
          if (this.extra[cy * w + nx] > 0 || this.extra[ny * w + cx] > 0) continue;
        }
        const ng = gc + base + this.extra[ni];
        if (this.seen[ni] !== gen || ng < this.g[ni]) {
          this.seen[ni] = gen;
          this.g[ni] = ng;
          this.came[ni] = cur;
          heap.push(ni, ng + heuristic(nx, ny));
        }
      }
    }
    return null;
  }

  _build(end) {
    const out = [];
    let c = end;
    while (this.came[c] !== -1) {
      out.push([c % this.w, Math.floor(c / this.w)]);
      c = this.came[c];
    }
    out.reverse();
    return out;
  }
}
