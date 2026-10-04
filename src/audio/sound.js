// Audio engine: buses, settings, throttling, ambience and music.

import { SFX } from './sfx.js';
import { Music } from './music.js';
import { makeReverb } from './synth.js';

const SETTINGS_KEY = 'clash-of-villages-audio-v1';

// Minimum seconds between two plays of the same effect (keeps busy battles from clipping).
const THROTTLE = {
  sword: 0.07, punch: 0.07, arrow: 0.06, arrowHit: 0.06, cannon: 0.08, smallHit: 0.05, die: 0.06, deploy: 0.05,
  coinTick: 0.05, elixirTick: 0.05, explosion: 0.08, zap: 0.08, fireball: 0.08, rocket: 0.1, mortar: 0.15, wallBreak: 0.1, click: 0.03, coin: 0.12, elixir: 0.12,
};

const REVERB_SEND = { complete: 0.35, levelup: 0.4, victory: 0.4, defeat: 0.4, horn: 0.5, star: 0.3, chime: 0.35, gem: 0.3, alarm: 0.4, bird: 0.6, destroy: 0.25, explosion: 0.2 };

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.last = new Map();
    this.voices = 0;
    this.settings = { music: 0.55, sfx: 0.85, muted: false };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch {
      /* ignore */
    }
    this.music = new Music(this);
    this.wantTrack = null;
    this.ambienceTimer = 0;
    this.listeners = new Set();
  }

  // Must be called from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.connect(comp).connect(ctx.destination);
      this.reverb = makeReverb(ctx, 2.2, 3.2);
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0.5;
      this.reverb.connect(this.reverbGain).connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      const musicVerb = ctx.createGain();
      musicVerb.gain.value = 0.35;
      this.musicBus.connect(musicVerb).connect(this.reverb);
      this.applyVolumes();
      if (this.wantTrack) this.music.play(this.wantTrack);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.settings.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music * 0.7, t, 0.3);
  }

  set(key, value) {
    this.settings[key] = value;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    this.applyVolumes();
    for (const l of this.listeners) l(this.settings);
  }

  toggleMute() {
    this.set('muted', !this.settings.muted);
    return this.settings.muted;
  }

  /**
   * @param {string} name   key in SFX
   * @param {object} [o]    { pan: -1..1, delay: seconds, volume, ...recipe options }
   */
  play(name, o = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.settings.muted || this.settings.sfx <= 0) return;
    const fn = SFX[name];
    if (!fn) return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name] ?? 0.02;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    if (this.voices > 28) return;
    this.last.set(name, now);
    const t = now + (o.delay || 0) + 0.005;
    let out = this.sfxBus;
    const g = ctx.createGain();
    g.gain.value = o.volume ?? 1;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p).connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    const send = REVERB_SEND[name];
    if (send) {
      const sg = ctx.createGain();
      sg.gain.value = send;
      g.connect(sg).connect(this.reverb);
    }
    out = g;
    this.voices++;
    setTimeout(() => {
      this.voices--;
      g.disconnect();
    }, 2500 + (o.delay || 0) * 1000);
    fn(ctx, out, t, o);
  }

  playMusic(track) {
    this.wantTrack = track;
    if (this.ctx) this.music.play(track);
  }

  // Duck the music briefly (e.g. under a victory fanfare).
  duck(seconds = 2.5, level = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.musicBus.gain;
    const full = this.settings.music * 0.7;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(full * level, t, 0.1);
    g.setTargetAtTime(full, t + seconds, 0.6);
  }

  // Called every frame with the current scene for ambient sounds.
  update(dt, scene) {
    if (!this.ctx) return;
    if (scene === 'village') {
      this.ambienceTimer -= dt;
      if (this.ambienceTimer <= 0) {
        this.ambienceTimer = 4 + Math.random() * 7;
        this.play('bird', { pan: Math.random() * 1.6 - 0.8, volume: 0.8 });
      }
    }
  }
}

export const sound = new SoundEngine();
