// Tiny DOM helpers and shared UI widgets.

import { fmtNum } from '../util/format.js';

// Event handlers live on el._on so morph() can swap them without re-binding listeners.
function setHandler(el, type, fn) {
  if (!el._on) el._on = {};
  if (!(type in el._on)) el.addEventListener(type, (e) => el._on[type]?.(e));
  el._on[type] = fn;
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v.replace(/\s+/g, ' ').trim();
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') setHandler(el, k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------- in-place DOM patching ----------
// Updates `from` to look like `to` while keeping existing nodes, so re-renders
// don't restart CSS animations, reload images or lose hover/scroll state.
// Identity used to pair old and new nodes: tag + data-key, or tag + first class name.
function ident(n) {
  if (n.nodeType !== 1) return `#${n.nodeType}`;
  const key = n.getAttribute('data-key');
  if (key != null) return `${n.nodeName}:k:${key}`;
  const cls = n.getAttribute('class');
  return `${n.nodeName}:${cls ? cls.split(' ')[0] : ''}`;
}

export function morph(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return from;
  }
  // attributes
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  if (to._on) for (const [type, fn] of Object.entries(to._on)) setHandler(from, type, fn);
  if (from._on) for (const type of Object.keys(from._on)) if (!to._on || !(type in to._on)) from._on[type] = null;
  if (from.nodeName === 'INPUT' && from !== document.activeElement) {
    if (from.value !== to.value) from.value = to.value;
    if (from.checked !== to.checked) from.checked = to.checked;
  }
  patchChildren(from, [...to.childNodes]);
  return from;
}

function patchChildren(parent, next) {
  const cur = [...parent.childNodes];
  let j = 0;
  for (const n of next) {
    const id = ident(n);
    let k = -1;
    for (let q = j; q < cur.length && q < j + 8; q++) {
      if (ident(cur[q]) === id) {
        k = q;
        break;
      }
    }
    if (k === -1) {
      // brand new node
      parent.insertBefore(n, cur[j] || null);
      continue;
    }
    for (let q = j; q < k; q++) cur[q].remove();
    morph(cur[k], n);
    j = k + 1;
  }
  for (let q = j; q < cur.length; q++) cur[q].remove();
}

// Patch a container's children to match a list of freshly built nodes.
export function patch(container, nodes) {
  patchChildren(container, nodes.filter(Boolean).map((n) => (n instanceof Node ? n : document.createTextNode(String(n)))));
}

// ---------- SVG icon sprite ----------
const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
<defs>
  <radialGradient id="g-gold" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff6b8"/><stop offset=".45" stop-color="#ffd23c"/><stop offset="1" stop-color="#c98a0c"/></radialGradient>
  <linearGradient id="g-gold-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#a86a06"/></linearGradient>
  <linearGradient id="g-elixir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb8ff"/><stop offset=".5" stop-color="#e04ee0"/><stop offset="1" stop-color="#7a1a96"/></linearGradient>
  <linearGradient id="g-gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ffd8"/><stop offset=".5" stop-color="#3fd27a"/><stop offset="1" stop-color="#127a3e"/></linearGradient>
  <linearGradient id="g-trophy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#ffc83a"/><stop offset="1" stop-color="#c47e0a"/></linearGradient>
  <linearGradient id="g-star" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".55" stop-color="#ffcf2e"/><stop offset="1" stop-color="#e08a0c"/></linearGradient>
  <linearGradient id="g-star-off" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#77706a"/><stop offset="1" stop-color="#3d3833"/></linearGradient>
  <linearGradient id="g-xp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe0ff"/><stop offset=".55" stop-color="#3a9cf0"/><stop offset="1" stop-color="#1c5fb8"/></linearGradient>
  <symbol id="ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="url(#g-gold-rim)" stroke="#5a3a04" stroke-width="1.2"/><circle cx="12" cy="12" r="7.6" fill="url(#g-gold)" stroke="#b47a08" stroke-width=".8"/><path d="M9.2 9.6c.6-1.4 3.8-1.6 4.8-.3M14.4 14.4c-.6 1.4-3.8 1.6-4.8.3" stroke="#a86a06" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="9" cy="7.6" rx="2.6" ry="1.3" fill="#fff" opacity=".7" transform="rotate(-25 9 7.6)"/></symbol>
  <symbol id="ic-elixir" viewBox="0 0 24 24"><path d="M12 1.6C12 1.6 4.4 10.4 4.4 15.2a7.6 7.6 0 0 0 15.2 0C19.6 10.4 12 1.6 12 1.6z" fill="url(#g-elixir)" stroke="#4a0a5a" stroke-width="1.2"/><path d="M8.6 13.6c-.3 1.9.6 3.6 2 4.4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".75"/><circle cx="14.6" cy="11.2" r="1.1" fill="#fff" opacity=".6"/></symbol>
  <symbol id="ic-gems" viewBox="0 0 24 24"><path d="M6 3h12l4.5 6L12 21.5 1.5 9z" fill="url(#g-gem)" stroke="#0b4d27" stroke-width="1.2" stroke-linejoin="round"/><path d="M1.5 9h21M8.5 9 12 21.5 15.5 9M6 3l2.5 6M18 3l-2.5 6M12 3 8.5 9M12 3l3.5 6" stroke="#0b4d27" stroke-width=".7" fill="none" opacity=".55"/><path d="M6.5 4.2h4l-2 4z" fill="#fff" opacity=".55"/></symbol>
  <symbol id="ic-trophy" viewBox="0 0 24 24"><path d="M6 2.5h12v5.5a6 6 0 0 1-12 0z" fill="url(#g-trophy)" stroke="#6a4204" stroke-width="1.2"/><path d="M6 4.5H2.8v1.8A4.2 4.2 0 0 0 6.6 10.5M18 4.5h3.2v1.8a4.2 4.2 0 0 1-3.8 4.2" fill="none" stroke="#6a4204" stroke-width="1.6"/><path d="M10.4 13.5h3.2v3.2h-3.2z" fill="#d89618" stroke="#6a4204" stroke-width="1"/><path d="M7 21.5h10l-1-4.8H8z" fill="url(#g-trophy)" stroke="#6a4204" stroke-width="1.2"/><path d="M8.5 4.2v3.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></symbol>
  <symbol id="ic-star" viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.1.9-5.2 4.9 1.4 7.1L12 17.8l-6.4 3.5L7 14.2 1.8 9.3l7.1-.9z" fill="url(#g-star)" stroke="#6a3e02" stroke-width="1.3" stroke-linejoin="round"/><path d="M9.6 8.6l2.4-4.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/></symbol>
  <symbol id="ic-star-off" viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.1.9-5.2 4.9 1.4 7.1L12 17.8l-6.4 3.5L7 14.2 1.8 9.3l7.1-.9z" fill="url(#g-star-off)" stroke="#1c1814" stroke-width="1.3" stroke-linejoin="round"/></symbol>
  <symbol id="ic-xp" viewBox="0 0 24 24"><path d="M12 1.2l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L12 17.6 5.6 21l1.2-7.2L1.6 8.7l7.2-1z" fill="url(#g-xp)" stroke="#0d3060" stroke-width="1.1" stroke-linejoin="round"/></symbol>
  <symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5.5-3.5 9.5-8 11-4.5-1.5-8-5.5-8-11V5z" fill="url(#g-xp)" stroke="#0d3060" stroke-width="1.2"/></symbol>
</defs>
</svg>`;

let spriteReady = false;
export function ensureSprite() {
  if (spriteReady) return;
  spriteReady = true;
  const holder = document.createElement('div');
  holder.innerHTML = SPRITE;
  document.body.prepend(holder.firstElementChild);
}

export function icon(kind, cls = '') {
  const span = document.createElement('span');
  span.className = `icon icon-${kind} ${cls}`.trim();
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${kind}"></use></svg>`;
  return span;
}

export function costEl(cost, state) {
  const parts = Object.entries(cost).filter(([, v]) => v > 0);
  if (!parts.length) return h('span', { class: 'cost free' }, 'Free');
  return h(
    'span',
    { class: 'cost' },
    parts.map(([k, v]) => h('span', { class: `cost-part ${state && (state.resources[k] || 0) < v ? 'short' : ''}` }, fmtNum(v), icon(k))),
  );
}

export function bar(frac, cls = '') {
  return h('div', { class: `bar ${cls}` }, h('div', { class: 'bar-fill', style: { width: `${Math.max(0, Math.min(1, frac)) * 100}%` } }));
}

export function avatar(look, size = 40) {
  return h(
    'div',
    { class: 'avatar', style: { width: `${size}px`, height: `${size}px` } },
    h('div', { class: 'av-shirt', style: { background: look.shirt } }),
    h('div', { class: 'av-face', style: { background: look.skin } }),
    h('div', { class: `av-hair av-hair-${look.hairStyle || 0}`, style: { background: look.hair } }),
  );
}

const PATHS = {
  info: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="10.6" y="10" width="2.8" height="8" rx="1"/><circle cx="12" cy="6.8" r="1.7"/>',
  upgrade: '<path d="M12 3 L21 13 H15.5 V21 H8.5 V13 H3 Z"/>',
  move: '<path d="M12 2 L15.5 6 H13.2 V10.8 H18 V8.5 L22 12 L18 15.5 V13.2 H13.2 V18 H15.5 L12 22 L8.5 18 H10.8 V13.2 H6 V15.5 L2 12 L6 8.5 V10.8 H10.8 V6 H8.5 Z"/>',
  workers: '<circle cx="12" cy="7" r="4"/><path d="M4 21 C4 15 8 13 12 13 C16 13 20 15 20 21 Z"/>',
  train: '<path d="M4 20 L6.5 17.5 L4.5 15.5 L6 14 L8 16 L17 7 V4 H20 V7 L11 16 L13 18 L11.5 19.5 L9.5 17.5 L7 20 Z"/>',
  research: '<path d="M9 2 H15 V4 H14 V9 L20 19 C20.8 20.5 20 22 18.2 22 H5.8 C4 22 3.2 20.5 4 19 L10 9 V4 H9 Z"/>',
  collect: '<circle cx="12" cy="12" r="9"/>',
  finish: '<path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z"/>',
  cancel: '<path d="M5 7.5 L7.5 5 L12 9.5 L16.5 5 L19 7.5 L14.5 12 L19 16.5 L16.5 19 L12 14.5 L7.5 19 L5 16.5 L9.5 12 Z"/>',
  check: '<path d="M3 12.5 L6 9.5 L10 13.5 L18 5.5 L21 8.5 L10 19.5 Z"/>',
  remove: '<path d="M6 4 L18 4 L17 21 H7 Z M4 4 H20 V6 H4 Z"/>',
  shop: '<path d="M3 9 L5 3 H19 L21 9 Z M4 10 H20 V21 H4 Z M9 14 V21 H15 V14 Z"/>',
  army: '<path d="M12 2 L20 5 V11 C20 16.5 16.5 20.5 12 22 C7.5 20.5 4 16.5 4 11 V5 Z"/>',
  people: '<circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="8" r="3.2"/><path d="M1.5 20 C1.5 15 4.5 13 8 13 C11.5 13 14.5 15 14.5 20 Z M10 20 C10 16 12.5 13.2 16.5 13.2 C20 13.2 22.5 15.2 22.5 20 Z"/>',
  log: '<path d="M5 2 H16 L20 6 V22 H5 Z M8 9 H17 V11 H8 Z M8 13 H17 V15 H8 Z M8 17 H14 V19 H8 Z"/>',
  gear: '<path d="M10 2 H14 L14.6 5 L17 6.2 L19.6 4.6 L22 7.4 L20.2 9.8 L20.8 12.4 L23.4 13.6 L22.6 17.4 L19.6 17.4 L18 19.6 L18.8 22.4 L15.2 23.8 L13.4 21.2 H10.6 L8.8 23.8 L5.2 22.4 L6 19.6 L4.4 17.4 L1.4 17.4 L0.6 13.6 L3.2 12.4 L3.8 9.8 L2 7.4 L4.4 4.6 L7 6.2 L9.4 5 Z M12 8.5 A3.5 3.5 0 1 0 12.01 8.5 Z"/>',
  swords: '<path d="M3 3 H7 L14 10 L12 12 L5 5 Z M21 3 H17 L10 10 L12 12 L19 5 Z M5 15 L9 19 L7 21 L5.5 19.5 L3.5 21.5 L2.5 20.5 L4.5 18.5 L3 17 Z M19 15 L15 19 L17 21 L18.5 19.5 L20.5 21.5 L21.5 20.5 L19.5 18.5 L21 17 Z M8 14 L10 16 L16 10 L14 8 Z"/>',
  hammer: '<path d="M3 6 L9 2 L13 4 L12 6 L20 14 L18 16 L10 8 L8 9 Z M14 16 L17 19 L15 21 L12 18 Z"/>',
  play: '<path d="M7 4 L20 12 L7 20 Z"/>',
  speaker: '<path d="M3 9 H7 L13 4 V20 L7 15 H3 Z"/><path d="M16 8.5 C17.5 10 17.5 14 16 15.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.8 6 C21.6 9 21.6 15 18.8 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  mute: '<path d="M3 9 H7 L13 4 V20 L7 15 H3 Z"/><path d="M16 9 L22 15 M22 9 L16 15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  skip: '<path d="M4 4 L13 12 L4 20 Z M12 4 L21 12 L12 20 Z"/>',
  locate: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2.6"/><rect x="11" y="1" width="2" height="6"/><rect x="11" y="17" width="2" height="6"/><rect x="1" y="11" width="6" height="2"/><rect x="17" y="11" width="6" height="2"/>',
};

export function svg(name, cls = '') {
  const span = document.createElement('span');
  span.className = `svg-ico ${cls}`;
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return span;
}

export function stars(n, total = 3, cls = '') {
  return h('div', { class: `stars ${cls}` }, Array.from({ length: total }, (_, i) => icon(i < n ? 'star' : 'star-off', `star ${i < n ? 'on' : ''}`)));
}

export function timeAgo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
