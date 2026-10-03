// Tiny DOM helpers and shared UI widgets.

import { fmtNum } from '../util/format.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function icon(kind, cls = '') {
  return h('span', { class: `icon icon-${kind} ${cls}` });
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
  return h('div', { class: `stars ${cls}` }, Array.from({ length: total }, (_, i) => h('span', { class: `star ${i < n ? 'on' : ''}` })));
}

export function timeAgo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
