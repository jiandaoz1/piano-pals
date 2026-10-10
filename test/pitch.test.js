import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, rms } from '../src/audio/pitch.js';
import { midiToFreq, freqToMidiFloat } from '../src/notes.js';

const SR = 44100;

function synth(freq, { harmonics = [1, 0.5, 0.3, 0.2], noise = 0, n = 4096 } = {}) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR)));
    buf[i] = 0.2 * v + noise * (Math.random() - 0.5);
  }
  return buf;
}

test('detects every piano note C3..C6 within 10 cents', () => {
  for (let midi = 48; midi <= 84; midi++) {
    const f = midiToFreq(midi);
    const r = detectPitch(synth(f), SR);
    assert.ok(r, `no pitch for midi ${midi}`);
    const cents = Math.abs(freqToMidiFloat(r.freq) - midi) * 100;
    assert.ok(cents < 10, `midi ${midi} off by ${cents.toFixed(1)} cents`);
  }
});

test('finds the fundamental when it is weaker than the harmonics', () => {
  const r = detectPitch(synth(midiToFreq(48), { harmonics: [0.3, 1, 0.8, 0.5] }), SR);
  assert.ok(Math.abs(freqToMidiFloat(r.freq) - 48) < 0.1);
});

test('still works with background noise', () => {
  const r = detectPitch(synth(midiToFreq(60), { noise: 0.05 }), SR);
  assert.ok(Math.abs(freqToMidiFloat(r.freq) - 60) < 0.2);
});

test('returns null for pure noise and silence', () => {
  const noise = new Float32Array(4096).map(() => Math.random() - 0.5);
  const r = detectPitch(noise, SR);
  assert.ok(r === null || r.clarity < 0.8);
  assert.equal(detectPitch(new Float32Array(4096), SR), null);
  assert.equal(rms(new Float32Array(4096)), 0);
});
