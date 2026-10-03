// Procedural medieval music: a calm lute-and-flute village theme and a drum-driven battle theme.

import { pluck, flute, brass, tom, snare, shaker, kick, mtof } from './synth.js';

// Chords as MIDI note lists, melody as [midi | null, lengthInSteps] pairs. One step = a 16th note.
const VILLAGE = {
  bpm: 92,
  chords: [
    [50, 57, 62, 65], // Dm
    [48, 55, 60, 64], // C
    [46, 53, 58, 62], // Bb
    [48, 55, 60, 64], // C
    [50, 57, 62, 65], // Dm
    [53, 57, 60, 65], // F
    [48, 55, 60, 64], // C
    [45, 52, 57, 61], // A
  ],
  melody: [
    [74, 4], [77, 2], [76, 2], [74, 4], [72, 4],
    [72, 4], [74, 2], [72, 2], [70, 4], [69, 4],
    [70, 4], [72, 2], [74, 2], [72, 4], [70, 2], [69, 2],
    [67, 4], [69, 4], [72, 8],
    [74, 4], [77, 2], [79, 2], [81, 4], [79, 2], [77, 2],
    [77, 4], [76, 2], [74, 2], [72, 8],
    [72, 4], [74, 2], [76, 2], [77, 4], [76, 2], [74, 2],
    [73, 4], [76, 4], [74, 8],
  ],
};

const BATTLE = {
  bpm: 132,
  chords: [
    [50, 57, 62], // Dm
    [50, 57, 62],
    [46, 53, 58], // Bb
    [48, 55, 60], // C
    [50, 57, 62],
    [50, 57, 62],
    [43, 50, 55], // G
    [45, 52, 57], // A
  ],
  riff: [62, null, 62, 65, 62, null, 60, 62, 62, null, 62, 65, 67, 65, 64, 60],
};

export class Music {
  constructor(engine) {
    this.engine = engine;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.melIdx = 0;
    this.melLeft = 0;
    this.timer = null;
  }

  play(track) {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    this.melIdx = 0;
    this.melLeft = 0;
    const ctx = this.engine.ctx;
    if (!ctx) return;
    this.nextTime = ctx.currentTime + 0.15;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 60);
  }

  stop() {
    this.track = null;
  }

  schedule() {
    const ctx = this.engine.ctx;
    if (!ctx || !this.track || ctx.state !== 'running') return;
    const song = this.track === 'battle' ? BATTLE : VILLAGE;
    const stepDur = 60 / song.bpm / 4;
    // if we fell behind (tab hidden), jump forward instead of bursting notes
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      if (this.track === 'battle') this.battleStep(ctx, this.nextTime, stepDur);
      else this.villageStep(ctx, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  villageStep(ctx, t, sd) {
    const out = this.engine.musicBus;
    const s = this.step % 128;
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const chord = VILLAGE.chords[bar % VILLAGE.chords.length];
    // lute: rolling arpeggio pattern
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    if (inBar % 2 === 0) {
      const n = chord[pattern[(inBar / 2) % pattern.length]] + 12;
      pluck(ctx, out, t, { freq: mtof(n), gain: 0.11, dur: 1.2, bright: 0.45, tone: 2600 });
    }
    // bass on the downbeat and the "and" of 3
    if (inBar === 0 || inBar === 10) pluck(ctx, out, t, { freq: mtof(chord[0] - 12), gain: 0.2, dur: 1.8, bright: 0.3, tone: 900 });
    // soft hand drum + shaker
    if (inBar === 0 || inBar === 8) tom(ctx, out, t, { freq: 95, gain: 0.08, dur: 0.25 });
    if (inBar === 6 || inBar === 14) tom(ctx, out, t, { freq: 140, gain: 0.04, dur: 0.15 });
    if (inBar % 4 === 2) shaker(ctx, out, t, { gain: 0.018 });
    // flute melody, plays on alternate passes for breathing room
    const pass = Math.floor(this.step / 128) % 2;
    if (this.melLeft <= 0) {
      const [note, len] = VILLAGE.melody[this.melIdx % VILLAGE.melody.length];
      this.melIdx++;
      this.melLeft = len;
      if (pass === 0 && note) flute(ctx, out, t, { freq: mtof(note), dur: len * sd * 0.95, gain: 0.05 });
      else if (pass === 1 && note && len >= 4) pluck(ctx, out, t, { freq: mtof(note), gain: 0.07, dur: 1.4, bright: 0.6, tone: 3500 });
    }
    this.melLeft--;
  }

  battleStep(ctx, t, sd) {
    const out = this.engine.musicBus;
    const s = this.step % 128;
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const chord = BATTLE.chords[bar % BATTLE.chords.length];
    // war drums
    if (inBar === 0 || inBar === 3 || inBar === 8 || inBar === 11) tom(ctx, out, t, { freq: 70, gain: 0.22, dur: 0.35 });
    if (inBar === 6 || inBar === 14) tom(ctx, out, t, { freq: 105, gain: 0.14, dur: 0.25 });
    if (inBar === 4 || inBar === 12) snare(ctx, out, t, { gain: 0.07 });
    if (inBar % 2 === 1) shaker(ctx, out, t, { gain: 0.02 });
    if (inBar === 0 && bar % 4 === 0) kick(ctx, out, t, { gain: 0.25, from: 90, to: 35, dur: 0.6 });
    // string ostinato
    const r = BATTLE.riff[inBar];
    if (r != null) {
      const shift = chord[0] - 50;
      pluck(ctx, out, t, { freq: mtof(r + shift - 12), gain: 0.09, dur: 0.5, bright: 0.7, tone: 2400 });
    }
    // brass stabs on chord changes
    if (inBar === 0) for (const n of chord) brass(ctx, out, t, { freq: mtof(n), dur: sd * 6, gain: 0.025, bright: 1600 });
    if (inBar === 10 && bar % 2 === 1) for (const n of chord) brass(ctx, out, t, { freq: mtof(n + 12), dur: sd * 4, gain: 0.018, bright: 2000 });
  }
}
