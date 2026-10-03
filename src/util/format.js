export function fmtNum(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function fmtCost(cost) {
  return Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${fmtNum(v)} ${k}`)
    .join(', ');
}
