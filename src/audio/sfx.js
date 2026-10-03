// Sound effect recipes. Each entry: (ctx, out, t, opts) => void.

import { tone, noise, bell, pluck, brass, kick, tom, snare, mtof, flute } from './synth.js';

const rnd = (a, b) => a + Math.random() * (b - a);

function pop(ctx, out, t, f = 700, gain = 0.25) {
  tone(ctx, out, t, { type: 'sine', freq: f * 0.7, freqEnd: f * 1.5, glide: 0.04, dur: 0.07, gain });
  tone(ctx, out, t, { type: 'triangle', freq: f * 2, freqEnd: f * 2.6, glide: 0.03, dur: 0.04, gain: gain * 0.25 });
}

function woodKnock(ctx, out, t, f = 380, gain = 0.3) {
  tone(ctx, out, t, { type: 'sine', freq: f, freqEnd: f * 0.85, dur: 0.09, gain });
  tone(ctx, out, t, { type: 'triangle', freq: f * 2.3, dur: 0.04, gain: gain * 0.35 });
  noise(ctx, out, t, { type: 'bandpass', freq: 1800, q: 2.5, dur: 0.03, gain: gain * 0.6 });
}

function metalClang(ctx, out, t, gain = 0.2, f = rnd(1300, 1900)) {
  bell(ctx, out, t, { freq: f, gain: gain * 0.7, dur: 0.25, partials: [1, 1.47, 2.09, 2.56, 3.9] });
  noise(ctx, out, t, { type: 'highpass', freq: 3000, dur: 0.06, gain: gain * 0.8 });
}

function boom(ctx, out, t, gain = 0.5, len = 0.6, cut = 1200) {
  kick(ctx, out, t, { gain: gain * 1.1, from: 110, to: 32, dur: len });
  noise(ctx, out, t, { type: 'lowpass', freq: cut, freqEnd: 90, dur: len * 1.3, gain: gain * 0.8, attack: 0.004 });
}

function fanfare(ctx, out, t, notes, step = 0.12, gain = 0.1, last = 0.6) {
  notes.forEach((m, i) => {
    const isLast = i === notes.length - 1;
    brass(ctx, out, t + i * step, { freq: mtof(m), dur: isLast ? last : step * 1.1, gain });
    brass(ctx, out, t + i * step, { freq: mtof(m - 12), dur: isLast ? last : step * 1.1, gain: gain * 0.5, bright: 1200 });
  });
}

export const SFX = {
  // ---------- UI ----------
  click: (ctx, out, t) => pop(ctx, out, t, rnd(620, 700), 0.22),
  tab: (ctx, out, t) => pop(ctx, out, t, 900, 0.14),
  open: (ctx, out, t) => {
    noise(ctx, out, t, { type: 'bandpass', freq: 500, freqEnd: 2600, q: 1.4, dur: 0.18, gain: 0.12, attack: 0.03 });
    pop(ctx, out, t + 0.06, 560, 0.2);
  },
  close: (ctx, out, t) => {
    noise(ctx, out, t, { type: 'bandpass', freq: 2200, freqEnd: 500, q: 1.4, dur: 0.14, gain: 0.08, attack: 0.02 });
    tone(ctx, out, t, { type: 'sine', freq: 700, freqEnd: 380, glide: 0.08, dur: 0.1, gain: 0.18 });
  },
  error: (ctx, out, t) => {
    for (let i = 0; i < 2; i++) {
      tone(ctx, out, t + i * 0.11, { type: 'square', freq: 150, freqEnd: 130, dur: 0.08, gain: 0.07 });
      tone(ctx, out, t + i * 0.11, { type: 'sine', freq: 300, dur: 0.08, gain: 0.08 });
    }
  },
  select: (ctx, out, t, o = {}) => {
    const kind = o.kind || 'wood';
    if (kind === 'metal') metalClang(ctx, out, t, 0.12, 900);
    else if (kind === 'stone') woodKnock(ctx, out, t, 220, 0.3);
    else if (kind === 'magic') bell(ctx, out, t, { freq: 1500, gain: 0.08, dur: 0.5 });
    woodKnock(ctx, out, t, 330, 0.22);
    pop(ctx, out, t + 0.02, 520, 0.12);
  },
  villager: (ctx, out, t) => {
    // a cheerful little "hey!" made of two vowel-ish blips
    const v = rnd(0.9, 1.15);
    tone(ctx, out, t, { type: 'triangle', freq: 420 * v, freqEnd: 620 * v, glide: 0.07, dur: 0.09, gain: 0.14 });
    tone(ctx, out, t + 0.1, { type: 'triangle', freq: 640 * v, freqEnd: 520 * v, glide: 0.1, dur: 0.12, gain: 0.12 });
  },

  // ---------- economy ----------
  coin: (ctx, out, t, o = {}) => {
    const n = Math.min(7, 2 + Math.floor((o.amount || 50) / 120));
    for (let i = 0; i < n; i++) {
      const tt = t + i * rnd(0.035, 0.06);
      bell(ctx, out, tt, { freq: rnd(1900, 2700), gain: 0.07, dur: 0.35, partials: [1, 2.4, 3.9] });
    }
    bell(ctx, out, t + n * 0.05, { freq: 3135, gain: 0.07, dur: 0.6, partials: [1, 2.01, 3] });
  },
  elixir: (ctx, out, t, o = {}) => {
    const n = Math.min(7, 3 + Math.floor((o.amount || 50) / 150));
    for (let i = 0; i < n; i++) {
      const f = rnd(300, 700);
      tone(ctx, out, t + i * 0.06, { type: 'sine', freq: f, freqEnd: f * 2.4, glide: 0.07, dur: 0.09, gain: 0.13 });
    }
    bell(ctx, out, t + n * 0.06, { freq: 1760, gain: 0.05, dur: 0.6 });
  },
  gem: (ctx, out, t) => {
    [88, 92, 95, 100].forEach((m, i) => bell(ctx, out, t + i * 0.07, { freq: mtof(m), gain: 0.07, dur: 0.6, partials: [1, 2, 3.01] }));
  },
  place: (ctx, out, t) => {
    kick(ctx, out, t, { gain: 0.45, from: 140, to: 50, dur: 0.25 });
    noise(ctx, out, t, { type: 'lowpass', freq: 900, freqEnd: 200, dur: 0.3, gain: 0.25 });
    for (let i = 0; i < 4; i++) noise(ctx, out, t + 0.05 + i * 0.04, { type: 'bandpass', freq: rnd(1500, 3500), q: 4, dur: 0.03, gain: 0.05 });
  },
  build: (ctx, out, t) => {
    for (let i = 0; i < 3; i++) {
      woodKnock(ctx, out, t + i * 0.16, 300 + i * 20, 0.3);
      metalClang(ctx, out, t + i * 0.16, 0.05, 2200);
    }
  },
  complete: (ctx, out, t) => {
    fanfare(ctx, out, t, [72, 76, 79, 84], 0.11, 0.08, 0.7);
    bell(ctx, out, t + 0.33, { freq: mtof(96), gain: 0.06, dur: 1 });
  },
  levelup: (ctx, out, t) => {
    fanfare(ctx, out, t, [67, 72, 76, 79, 84], 0.1, 0.09, 0.9);
    [96, 100, 103].forEach((m, i) => bell(ctx, out, t + 0.5 + i * 0.08, { freq: mtof(m), gain: 0.05, dur: 0.8 }));
  },
  chime: (ctx, out, t) => {
    bell(ctx, out, t, { freq: mtof(84), gain: 0.08, dur: 0.7 });
    bell(ctx, out, t + 0.12, { freq: mtof(91), gain: 0.07, dur: 0.9 });
  },
  train: (ctx, out, t) => {
    tom(ctx, out, t, { freq: 120, gain: 0.3 });
    metalClang(ctx, out, t + 0.05, 0.08, 2600);
  },
  chop: (ctx, out, t) => {
    for (let i = 0; i < 3; i++) woodKnock(ctx, out, t + i * 0.12, 260, 0.3);
    noise(ctx, out, t + 0.36, { type: 'lowpass', freq: 1200, freqEnd: 150, dur: 0.5, gain: 0.25 });
  },
  research: (ctx, out, t) => {
    for (let i = 0; i < 5; i++) {
      const f = rnd(500, 1100);
      tone(ctx, out, t + i * 0.05, { type: 'sine', freq: f, freqEnd: f * 1.8, glide: 0.06, dur: 0.07, gain: 0.08 });
    }
    bell(ctx, out, t + 0.25, { freq: 1320, gain: 0.06, dur: 0.6 });
  },

  // ---------- battle ----------
  deploy: (ctx, out, t, o = {}) => {
    const p = { barbarian: 1, archer: 1.2, giant: 0.6, goblin: 1.5, wallbreaker: 1.3, balloon: 0.8, wizard: 1.1, dragon: 0.5 }[o.troop] || 1;
    tone(ctx, out, t, { type: 'sine', freq: 180 * p, freqEnd: 70 * p, glide: 0.08, dur: 0.12, gain: 0.28 });
    noise(ctx, out, t, { type: 'bandpass', freq: 900 * p, freqEnd: 300, q: 1, dur: 0.12, gain: 0.12 });
    pop(ctx, out, t + 0.02, 500 * p, 0.08);
  },
  sword: (ctx, out, t) => {
    noise(ctx, out, t, { type: 'bandpass', freq: 3000, freqEnd: 900, q: 1.2, dur: 0.07, gain: 0.08 });
    metalClang(ctx, out, t + 0.05, 0.08);
  },
  punch: (ctx, out, t) => {
    kick(ctx, out, t, { gain: 0.35, from: 120, to: 55, dur: 0.15 });
    noise(ctx, out, t, { type: 'lowpass', freq: 1400, dur: 0.07, gain: 0.15 });
  },
  arrow: (ctx, out, t) => {
    pluck(ctx, out, t, { freq: rnd(330, 400), gain: 0.12, dur: 0.25, bright: 0.8 });
    noise(ctx, out, t + 0.02, { type: 'bandpass', freq: 2500, freqEnd: 700, q: 2, dur: 0.18, gain: 0.07 });
  },
  arrowHit: (ctx, out, t) => {
    woodKnock(ctx, out, t, rnd(500, 640), 0.1);
  },
  cannon: (ctx, out, t) => {
    boom(ctx, out, t, 0.45, 0.45, 1800);
    noise(ctx, out, t, { type: 'highpass', freq: 2000, dur: 0.05, gain: 0.12 });
  },
  mortar: (ctx, out, t) => {
    kick(ctx, out, t, { gain: 0.45, from: 90, to: 40, dur: 0.3 });
    noise(ctx, out, t, { type: 'lowpass', freq: 600, dur: 0.25, gain: 0.25 });
    tone(ctx, out, t + 0.25, { type: 'sine', freq: 1600, freqEnd: 500, glide: 1.0, dur: 1.0, gain: 0.025 });
  },
  rocket: (ctx, out, t) => {
    noise(ctx, out, t, { type: 'bandpass', freq: 400, freqEnd: 3000, q: 0.8, dur: 0.4, gain: 0.35, attack: 0.02 });
    noise(ctx, out, t, { type: 'lowpass', freq: 500, dur: 0.15, gain: 0.25 });
    tone(ctx, out, t, { type: 'sawtooth', freq: 200, freqEnd: 900, glide: 0.3, dur: 0.3, gain: 0.05 });
  },
  zap: (ctx, out, t) => {
    tone(ctx, out, t, { type: 'sawtooth', freq: 1400, freqEnd: 300, glide: 0.18, dur: 0.2, gain: 0.05 });
    tone(ctx, out, t, { type: 'sine', freq: 900, freqEnd: 1800, glide: 0.1, dur: 0.15, gain: 0.08 });
    noise(ctx, out, t, { type: 'bandpass', freq: 3000, q: 3, dur: 0.12, gain: 0.05 });
  },
  fireball: (ctx, out, t) => {
    noise(ctx, out, t, { type: 'lowpass', freq: 500, freqEnd: 2500, dur: 0.25, gain: 0.18, attack: 0.03 });
    tone(ctx, out, t, { type: 'sine', freq: 200, freqEnd: 400, dur: 0.2, gain: 0.08 });
  },
  explosion: (ctx, out, t, o = {}) => boom(ctx, out, t, 0.4 * (o.size || 1), 0.5 + 0.3 * (o.size || 1), 1500),
  smallHit: (ctx, out, t) => {
    tone(ctx, out, t, { type: 'sine', freq: 220, freqEnd: 90, dur: 0.08, gain: 0.18 });
    noise(ctx, out, t, { type: 'lowpass', freq: 2000, dur: 0.04, gain: 0.08 });
  },
  destroy: (ctx, out, t, o = {}) => {
    const big = o.big !== false;
    boom(ctx, out, t, big ? 0.5 : 0.25, big ? 0.9 : 0.4, 900);
    for (let i = 0; i < (big ? 9 : 4); i++) {
      woodKnock(ctx, out, t + 0.1 + i * rnd(0.04, 0.09), rnd(160, 420), 0.12);
    }
    noise(ctx, out, t + 0.1, { type: 'lowpass', freq: 500, freqEnd: 120, dur: big ? 1.2 : 0.5, gain: 0.18, attack: 0.05 });
  },
  wallBreak: (ctx, out, t) => {
    for (let i = 0; i < 4; i++) woodKnock(ctx, out, t + i * 0.05, rnd(180, 300), 0.2);
    noise(ctx, out, t, { type: 'lowpass', freq: 900, freqEnd: 200, dur: 0.4, gain: 0.2 });
  },
  die: (ctx, out, t) => {
    noise(ctx, out, t, { type: 'bandpass', freq: 1200, freqEnd: 300, q: 0.8, dur: 0.25, gain: 0.12, attack: 0.01 });
    tone(ctx, out, t, { type: 'triangle', freq: 500, freqEnd: 140, glide: 0.2, dur: 0.22, gain: 0.08 });
  },
  horn: (ctx, out, t) => {
    // war horn: low brass with a pitch scoop
    const f = mtof(50);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(f * 0.94, t);
    o1.frequency.linearRampToValueAtTime(f, t + 0.15);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.linearRampToValueAtTime(1100, t + 0.25);
    lp.frequency.linearRampToValueAtTime(500, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.12);
    g.gain.setValueAtTime(0.2, t + 1.1);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
    o1.connect(lp).connect(g).connect(out);
    o1.start(t);
    o1.stop(t + 1.6);
    tom(ctx, out, t, { freq: 80, gain: 0.5, dur: 0.5 });
    tom(ctx, out, t + 0.3, { freq: 80, gain: 0.4, dur: 0.5 });
  },
  star: (ctx, out, t) => {
    [84, 88, 91, 96].forEach((m, i) => bell(ctx, out, t + i * 0.06, { freq: mtof(m), gain: 0.08, dur: 0.8, partials: [1, 2, 3.01] }));
    kick(ctx, out, t, { gain: 0.3, from: 160, to: 60, dur: 0.3 });
  },
  victory: (ctx, out, t) => {
    for (let i = 0; i < 8; i++) snare(ctx, out, t + i * 0.06, { gain: 0.06 + i * 0.012 });
    fanfare(ctx, out, t + 0.5, [67, 67, 67, 72, 76, 79, 84], 0.13, 0.1, 1.4);
    kick(ctx, out, t + 0.5 + 6 * 0.13, { gain: 0.5, from: 120, to: 40, dur: 0.8 });
  },
  defeat: (ctx, out, t) => {
    fanfare(ctx, out, t, [67, 66, 65, 62], 0.32, 0.08, 1.2);
    tom(ctx, out, t + 0.96, { freq: 60, gain: 0.4, dur: 0.8 });
  },
  alarm: (ctx, out, t) => {
    for (let i = 0; i < 3; i++) bell(ctx, out, t + i * 0.32, { freq: 880, gain: 0.12, dur: 0.6, partials: [1, 2.4, 3.6, 5.1] });
  },
  tick: (ctx, out, t) => woodKnock(ctx, out, t, 900, 0.1),
  bird: (ctx, out, t) => {
    const base = rnd(2200, 3600);
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const tt = t + i * rnd(0.07, 0.13);
      tone(ctx, out, tt, { type: 'sine', freq: base * rnd(0.9, 1.1), freqEnd: base * rnd(1.2, 1.5), glide: 0.05, dur: 0.06, gain: 0.025 });
    }
  },
  flute: (ctx, out, t, o = {}) => flute(ctx, out, t, o),
};
