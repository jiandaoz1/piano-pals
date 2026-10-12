import { detectPitch, rms, toMidi } from './pitch.js';

const GATE_RMS = 0.003;
const MIN_CLARITY = 0.65;

// Listens to the microphone continuously and reports { midiFloat, rms } every frame.
export class MicListener {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.buf = null;
    this.raf = 0;
    this.listeners = new Set();
    this.tuningCents = 0;
    this.gate = GATE_RMS;
  }

  async start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.analyser.getFloatTimeDomainData(this.buf);
      const level = rms(this.buf);
      let midiFloat = null;
      if (level > this.gate) {
        const p = detectPitch(this.buf, this.ctx.sampleRate);
        if (p && p.clarity >= MIN_CLARITY) midiFloat = toMidi(p.freq, this.tuningCents);
      }
      for (const fn of this.listeners) fn({ midiFloat, rms: level });
    };
    tick();
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // Releases the microphone completely.
  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = this.stream = this.analyser = null;
  }
}
