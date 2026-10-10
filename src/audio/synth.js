import { midiToFreq } from '../notes.js';

// Soft feedback sounds. Kept quiet and short because the microphone can hear them;
// the game ignores the mic while a sound is playing (see Game.muteUntil).
export class Synth {
  constructor() {
    this.ctx = null;
  }

  _ctx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(midi, start, dur, gain = 0.08, type = 'triangle') {
    const ctx = this._ctx();
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Returns how long (ms) the sound lasts so callers can mute the mic.
  click(accent = false, when = 0) {
    const ctx = this._ctx();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1800 : 1200;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(accent ? 0.12 : 0.07, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.06);
  }

  correct() {
    [88, 91].forEach((m, i) => this.tone(m, i * 0.06, 0.16, 0.06));
    return 220;
  }

  oops() {
    this.tone(55, 0, 0.18, 0.05, 'sine');
    return 260;
  }

  cheer() {
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => this.tone(m, i * 0.1, 0.35));
    return 1000;
  }

  // Piano-like voice: inharmonic partials with faster-decaying highs, slightly detuned
  // string pairs, a hammer thump and a brightness that follows pitch.
  // Returns how long (ms) the mic should be ignored.
  play(midi, velocity = 0.8) {
    const ctx = this._ctx();
    const t0 = ctx.currentTime + 0.01;
    const f0 = midiToFreq(midi);
    const tau1 = Math.max(0.35, Math.min(1.0, 1.0 - (midi - 48) * 0.018));
    const B = 0.0004 * Math.pow(2, (60 - midi) / 24);
    const total = tau1 * 3.5;

    const master = ctx.createGain();
    master.gain.value = 0.35 * velocity;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = Math.min(9000, f0 * 6 + 1200 + velocity * 2000);
    tone.Q.value = 0.4;
    master.connect(tone).connect(ctx.destination);

    for (let n = 1; n <= 10; n++) {
      const f = n * f0 * Math.sqrt(1 + B * n * n);
      if (f > 9000) break;
      const amp = (1 / Math.pow(n, 1.15)) * (n === 2 ? 1.1 : 1);
      const tau = tau1 / (1 + 0.55 * (n - 1));
      const strings = n <= 4 ? [-1.2, 1.2] : [0];
      for (const cents of strings) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.detune.value = cents;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime((amp / strings.length) * 0.8, t0 + 0.004);
        g.gain.setTargetAtTime(0, t0 + 0.004, tau);
        osc.connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + total);
      }
    }

    // hammer thump
    const len = Math.floor(ctx.sampleRate * 0.05);
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(3000, f0 * 3);
    const ng = ctx.createGain();
    ng.gain.value = 0.25 * velocity;
    src.connect(bp).connect(ng).connect(master);
    src.start(t0);

    return Math.round(total * 1000) + 100;
  }
}
