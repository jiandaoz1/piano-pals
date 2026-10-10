import { NOTE_COLORS, isBlackKey, midiToName } from '../notes.js';
import { fitCanvas } from './lane.js';

// On-screen keyboard that points at the target key (hint level 2).
export function drawKeyboard(canvas, { target, heard, minMidi, maxMidi }, now) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!target) return;

  let lo = minMidi;
  while (isBlackKey(lo) || lo % 12 !== 0) lo--;
  let hi = maxMidi;
  while (isBlackKey(hi) || (hi + 1) % 12 !== 0) hi++;

  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) whites.push(m);
  const kw = w / whites.length;
  const xOf = new Map(whites.map((m, i) => [m, i * kw]));

  const fillFor = (m, base) => {
    if (m === target.midi) return `hsl(${50 + Math.sin(now / 150) * 8} 100% ${60 + Math.sin(now / 150) * 8}%)`;
    if (heard === m) return '#bfe9ff';
    return base;
  };

  for (const m of whites) {
    const x = xOf.get(m);
    ctx.fillStyle = fillFor(m, '#fff');
    ctx.strokeStyle = '#3b2a6b';
    ctx.lineWidth = 2;
    ctx.fillRect(x, 0, kw, h);
    ctx.strokeRect(x, 0, kw, h);
    const letter = midiToName(m)[0];
    ctx.fillStyle = NOTE_COLORS[letter];
    ctx.beginPath();
    ctx.arc(x + kw / 2, h - 22, Math.min(14, kw / 2 - 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2a6b';
    ctx.font = `bold ${Math.min(16, kw / 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x + kw / 2, h - 21);
    if (m === 60) ctx.fillText('⭐', x + kw / 2, h - 52);
  }
  for (let m = lo; m <= hi; m++) {
    if (!isBlackKey(m)) continue;
    const x = xOf.get(m - 1) + kw * 0.65;
    ctx.fillStyle = fillFor(m, '#3b2a6b');
    ctx.fillRect(x, 0, kw * 0.7, h * 0.6);
  }

  // bouncing arrow over the target key
  const tx = xOf.get(target.midi);
  if (tx !== undefined) {
    ctx.fillStyle = '#ff5c5c';
    ctx.font = '28px sans-serif';
    ctx.fillText('👇', tx + kw / 2, h * 0.72 + Math.sin(now / 120) * 6);
  }
  ctx.textAlign = 'left';
}
