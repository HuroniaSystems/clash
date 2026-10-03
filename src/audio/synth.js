// Low-level Web Audio instruments. Every function schedules nodes on `ctx`,
// starting at time `t`, and connects them to `out`.

const noiseCache = new WeakMap();
const pluckCache = new WeakMap();

export function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Attack/decay gain envelope. Returns the gain node.
export function env(ctx, out, t, { attack = 0.005, hold = 0, decay = 0.2, peak = 1, sustain = 0, release = 0.05 } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  if (hold) g.gain.setValueAtTime(peak, t + attack + hold);
  const endDecay = t + attack + hold + decay;
  if (sustain > 0) {
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), endDecay);
    g.gain.exponentialRampToValueAtTime(0.0001, endDecay + release);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, endDecay);
  }
  g.connect(out);
  return g;
}

export function tone(ctx, out, t, {
  type = 'sine', freq = 440, freqEnd = null, glide = null, dur = 0.2, gain = 0.3, attack = 0.005, detune = 0, sustain = 0, release = 0.05, hold = 0,
} = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + (glide ?? dur));
  o.detune.value = detune;
  const g = env(ctx, out, t, { attack, decay: dur, peak: gain, sustain, release, hold });
  o.connect(g);
  o.start(t);
  o.stop(t + attack + hold + dur + release + 0.05);
  return o;
}

export function noise(ctx, out, t, {
  type = 'bandpass', freq = 1000, freqEnd = null, q = 1, dur = 0.2, gain = 0.3, attack = 0.002, hold = 0, glide = null,
} = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + (glide ?? dur));
  f.Q.value = q;
  const g = env(ctx, out, t, { attack, decay: dur, peak: gain, hold });
  src.connect(f).connect(g);
  const offset = Math.random() * 1.5;
  src.start(t, offset);
  src.stop(t + attack + hold + dur + 0.05);
  return src;
}

// Karplus-Strong plucked string (lute / harp).
export function pluckBuffer(ctx, freq, dur = 1.6, bright = 0.5) {
  let byCtx = pluckCache.get(ctx);
  if (!byCtx) pluckCache.set(ctx, (byCtx = new Map()));
  const key = `${Math.round(freq * 10)}:${bright}:${dur}`;
  let buf = byCtx.get(key);
  if (buf) return buf;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * dur);
  buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  // the two-point average adds half a sample of delay
  const N = Math.max(2, Math.round(sr / freq - 0.5));
  const ring = new Float32Array(N);
  // excitation: lowpassed noise burst
  let last = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    last = last + bright * (r - last);
    ring[i] = last;
  }
  const damp = 0.998 - (1 - bright) * 0.004;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[idx];
    const nxt = idx + 1 === N ? 0 : idx + 1;
    d[i] = a;
    ring[idx] = (a + ring[nxt]) * 0.5 * damp;
    idx = nxt;
  }
  // normalise
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < n; i++) d[i] /= peak;
  byCtx.set(key, buf);
  return buf;
}

export function pluck(ctx, out, t, { freq = 220, gain = 0.3, dur = 1.4, bright = 0.5, tone: lp = 3200 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, freq, dur, bright);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// Inharmonic bell / coin / chime.
export function bell(ctx, out, t, { freq = 1200, gain = 0.2, dur = 0.6, partials = [1, 2.76, 5.4, 8.93], decayMul = 1 } = {}) {
  partials.forEach((p, i) => {
    if (freq * p > 16000) return;
    tone(ctx, out, t, { type: 'sine', freq: freq * p, dur: (dur / (1 + i * 0.6)) * decayMul, gain: gain / (1 + i * 0.9), attack: 0.002 });
  });
}

// Soft flute with vibrato.
export function flute(ctx, out, t, { freq = 660, dur = 0.5, gain = 0.12 } = {}) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(freq * 2, t);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(0.25, dur * 0.6));
  lfo.connect(lg).connect(o.frequency);
  lg.connect(o2.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.05);
  g.gain.setValueAtTime(gain * 0.85, t + Math.max(0.06, dur - 0.08));
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g).connect(out);
  // breath
  noise(ctx, out, t, { type: 'bandpass', freq: freq * 2, q: 2, dur: 0.08, gain: gain * 0.25 });
  for (const n of [o, o2, lfo]) {
    n.start(t);
    n.stop(t + dur + 0.1);
  }
}

// Bright brass stab (two detuned saws through a swept lowpass).
export function brass(ctx, out, t, { freq = 220, dur = 0.4, gain = 0.12, bright = 2200 } = {}) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(bright, t + 0.06);
  f.frequency.exponentialRampToValueAtTime(bright * 0.45, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.03);
  g.gain.setValueAtTime(gain * 0.8, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08);
  f.connect(g).connect(out);
  for (const d of [-7, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = d;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.15);
  }
}

export function kick(ctx, out, t, { gain = 0.6, from = 150, to = 45, dur = 0.35 } = {}) {
  tone(ctx, out, t, { type: 'sine', freq: from, freqEnd: to, glide: dur * 0.5, dur, gain });
}

export function tom(ctx, out, t, { freq = 110, gain = 0.4, dur = 0.3 } = {}) {
  tone(ctx, out, t, { type: 'sine', freq: freq * 1.6, freqEnd: freq, glide: 0.08, dur, gain });
  noise(ctx, out, t, { type: 'lowpass', freq: 900, dur: 0.06, gain: gain * 0.3 });
}

export function snare(ctx, out, t, { gain = 0.25, dur = 0.16 } = {}) {
  noise(ctx, out, t, { type: 'highpass', freq: 1400, dur, gain });
  tone(ctx, out, t, { type: 'triangle', freq: 210, freqEnd: 150, dur: 0.08, gain: gain * 0.6 });
}

export function shaker(ctx, out, t, { gain = 0.06, dur = 0.05 } = {}) {
  noise(ctx, out, t, { type: 'highpass', freq: 6500, dur, gain, attack: 0.008 });
}

export function makeReverb(ctx, seconds = 1.8, decay = 3) {
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  conv.buffer = b;
  return conv;
}
