import { freqToMidiFloat } from '../notes.js';

export const MIN_FREQ = 100;
export const MAX_FREQ = 1300;

export function rms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

// YIN pitch detector. Returns { freq, clarity } or null when no clear pitch.
export function detectPitch(buf, sampleRate, threshold = 0.15) {
  const tauMin = Math.floor(sampleRate / MAX_FREQ);
  const tauMax = Math.floor(sampleRate / MIN_FREQ);
  const W = Math.min(Math.floor(buf.length / 2), buf.length - tauMax - 1);
  if (W < tauMax) return null;

  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // cumulative mean normalised difference
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) return null;

  // parabolic interpolation for sub-sample accuracy
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1];
    const b = cmnd[tau];
    const c = cmnd[tau + 1];
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}

// Convert a detection into a (fractional) MIDI number, corrected for piano tuning.
export function toMidi(freq, tuningCents = 0) {
  return freqToMidiFloat(freq) - tuningCents / 100;
}
