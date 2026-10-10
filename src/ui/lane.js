import { NOTE_COLORS, KEYS, KEY_SIG_ORDER } from '../notes.js';

const TREBLE_LINES = [30, 32, 34, 36, 38];
const BASS_LINES = [18, 20, 22, 24, 26];

export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// Horizontal room a note takes, in units: longer notes get more space.
const ROOM = { 0.5: 0.75, 1: 1, 1.5: 1.3, 2: 1.5, 3: 1.9, 4: 2.2 };
const ACC = { '#': '♯', b: '♭', n: '♮' };
// Steps (C4 = 28) where key-signature accidentals sit on the treble staff; bass is 14 lower.
const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34];
const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];

// Scrolling lane: notes travel right -> left; the current note waits in the glowing hit zone.
// Notes are drawn like printed music: black heads, stems, hollow half/whole notes.
export class Lane {
  constructor(canvas) {
    this.canvas = canvas;
    this.notes = [];
    this.index = 0;
    this.scrollX = 0;
    this.pops = [];
    this.shakeUntil = 0;
  }

  setSong(song) {
    const notes = song.notes;
    this.notes = notes;
    this.time = song.time;
    this.barBeats = song.barBeats;
    const sig = Object.entries(KEYS[song.key] ?? {});
    this.sigKind = sig.length && sig[0][1] > 0 ? 'sharps' : 'flats';
    this.sigCount = sig.length;
    this.barBefore = new Set();
    let beat = 0;
    notes.forEach((n, i) => {
      if (i > 0 && Math.abs(beat % this.barBeats) < 1e-9) this.barBefore.add(i);
      beat += n.beats;
    });
    this.index = 0;
    this.scrollX = 0;
    this.pops = [];
    this.pos = [];
    let u = 0;
    for (const n of notes) {
      this.pos.push(u);
      u += ROOM[n.beats] ?? 1;
    }
    const steps = notes.map((n) => n.step);
    this.minStep = Math.min(16, ...steps) - 1;
    this.maxStep = Math.max(40, ...steps) + 1;
  }

  setIndex(i) {
    this.index = i;
  }

  pop(index, now) {
    this.pops.push({ index, t0: now });
  }

  shake(now) {
    this.shakeUntil = now + 400;
  }

  render(now, { showLetters, hintLevel, count = 0 }) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, w, h);
    if (!this.notes.length) return;

    const chipRow = showLetters ? 34 : 0;
    const span = (this.maxStep - this.minStep) / 2;
    const gap = Math.min(30, (h - 16 - chipRow) / span);
    const top = (h - chipRow - span * gap) / 2;
    const yOf = (step) => top + (this.maxStep - step) * (gap / 2);
    const g = { gap, rx: gap * 0.62, ry: gap * 0.5, yOf };
    const unit = Math.max(gap * 3.6, 70);
    const clefW = gap * 3.4;
    const sigEnd = 10 + clefW + this.sigCount * gap * 0.95 + gap * 3.0;
    const hitX = Math.max(sigEnd + unit / 2 + 6, Math.min(w * 0.3, 240));

    const targetX = this.pos[Math.min(this.index, this.notes.length - 1)] * unit;
    this.scrollX += (targetX - this.scrollX) * 0.15;
    const xOf = (i) => hitX + this.pos[i] * unit - this.scrollX;

    ctx.fillStyle = 'rgba(255, 217, 61, 0.28)';
    ctx.fillRect(hitX - unit / 2, 0, unit, h);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#222';
    for (const group of [TREBLE_LINES, BASS_LINES]) for (const st of group) this._line(ctx, yOf(st), 8, w - 8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(9, yOf(38));
    ctx.lineTo(9, yOf(18));
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(sigEnd, 0, w, h);
    ctx.clip();
    this._bars(ctx, xOf, yOf, unit);
    for (let i = this.index; i < this.notes.length; i++) {
      const n = this.notes[i];
      const x = xOf(i);
      if (x > w + 40) break;
      if (x < -40) continue;
      const isCur = i === this.index;
      let y = yOf(n.step);
      if (isCur) y -= Math.abs(Math.sin(now / 260)) * 4;
      const shaking = isCur && now < this.shakeUntil;
      ctx.save();
      if (shaking) ctx.translate(Math.sin(now / 25) * 6, 0);
      ctx.globalAlpha = isCur ? 1 : Math.max(0.45, 1 - (i - this.index) * 0.05);
      this._ledgers(ctx, n.step, x, g);
      if (n.accidental) {
        ctx.fillStyle = '#111';
        ctx.font = `${gap * 2.6}px serif`;
        ctx.textAlign = 'right';
        ctx.fillText(ACC[n.accidental], x - g.rx * 1.4, y);
        ctx.textAlign = 'left';
      }
      this._note(ctx, n, x, y, g, isCur, now);
      ctx.restore();
      if (showLetters) this._chip(ctx, n, x, h - 18, isCur);
      if (isCur && hintLevel >= 1) this._hintLabel(ctx, n, x, y, gap);
    }

    ctx.restore();
    this._renderPops(ctx, now, xOf, yOf, gap);
    this._signature(ctx, g, sigEnd);
    if (count) this._count(ctx, count, hitX, gap);
  }

  _bars(ctx, xOf, yOf, unit) {
    ctx.strokeStyle = '#222';
    const bar = (x, thick) => {
      ctx.lineWidth = thick ? 4 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x, yOf(38));
      ctx.lineTo(x, yOf(18));
      ctx.stroke();
    };
    for (const i of this.barBefore) bar((xOf(i) + xOf(i - 1)) / 2 + (ROOM[this.notes[i - 1].beats] ?? 1) * unit * 0.02, false);
    const last = this.notes.length - 1;
    const end = xOf(last) + (ROOM[this.notes[last].beats] ?? 1) * unit * 0.5;
    bar(end - 6, false);
    bar(end, true);
  }

  _signature(ctx, { gap, yOf }, sigEnd) {
    ctx.fillStyle = '#222';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `${gap * 4.2}px serif`;
    ctx.fillText('𝄞', 14, yOf(33));
    ctx.fillText('𝄢', 14, yOf(23));
    const x0 = 10 + gap * 3.4;
    const steps = this.sigKind === 'sharps' ? SHARP_STEPS : FLAT_STEPS;
    const glyph = this.sigKind === 'sharps' ? '♯' : '♭';
    ctx.font = `${gap * 2.6}px serif`;
    for (let k = 0; k < this.sigCount; k++) {
      for (const off of [0, -14]) ctx.fillText(glyph, x0 + k * gap * 0.95, yOf(steps[k] + off));
    }
    const tx = x0 + this.sigCount * gap * 0.95 + gap * 1.8;
    ctx.font = `bold ${gap * 2.3}px serif`;
    ctx.textAlign = 'center';
    for (const [top, bottom] of [[36, 32], [24, 20]]) {
      ctx.fillText(String(this.time[0]), tx, yOf(top));
      ctx.fillText(String(this.time[1]), tx, yOf(bottom));
    }
    ctx.textAlign = 'left';
  }

  _count(ctx, count, hitX, gap) {
    ctx.font = `bold ${gap * 1.6}px 'Chalkboard SE', 'Comic Sans MS', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7b3fe4';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    const text = 'Hold… ' + Array.from({ length: count }, (_, i) => i + 1).join(' ');
    ctx.strokeText(text, hitX, gap * 1.4);
    ctx.fillText(text, hitX, gap * 1.4);
    ctx.textAlign = 'left';
  }

  _line(ctx, y, x1, x2) {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  _ledgers(ctx, step, x, { rx, yOf }) {
    const steps = [];
    if (step === 28) steps.push(28);
    for (let s = 40; s <= step; s += 2) steps.push(s);
    for (let s = 16; s >= step; s -= 2) steps.push(s);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    for (const s of steps) this._line(ctx, yOf(s), x - rx * 1.7, x + rx * 1.7);
  }

  _note(ctx, n, x, y, { gap, rx, ry }, isCur, now) {
    if (isCur) {
      ctx.beginPath();
      ctx.arc(x, y, gap * 1.15 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 190, 40, 0.55)';
      ctx.fill();
    }
    const hollow = n.beats >= 2;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = hollow ? '#fff' : '#111';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = hollow ? 2.5 : 1.5;
    ctx.stroke();

    if (n.beats < 4) {
      const mid = n.step >= 28 ? 34 : 22;
      const up = n.step < mid;
      const sx = up ? x + rx - 1 : x - rx + 1;
      const ey = up ? y - gap * 3.4 : y + gap * 3.4;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, ey);
      ctx.lineWidth = 2;
      ctx.stroke();
      if (n.beats < 1) {
        const dir = up ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(sx, ey);
        ctx.quadraticCurveTo(sx + gap * 1.2, ey + dir * gap * 1.2, sx + gap * 0.7, ey + dir * gap * 2.4);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    if (n.beats === 3 || n.beats === 1.5) {
      ctx.beginPath();
      ctx.arc(x + rx + 7, n.step % 2 === 0 ? y - gap / 2 : y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
    }
  }

  _chip(ctx, n, x, y, isCur) {
    ctx.beginPath();
    ctx.arc(x, y, isCur ? 14 : 12, 0, Math.PI * 2);
    ctx.fillStyle = NOTE_COLORS[n.letter];
    ctx.fill();
    ctx.fillStyle = '#3b2a6b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, x, y + 1);
    ctx.textAlign = 'left';
  }

  _hintLabel(ctx, n, x, y, gap) {
    ctx.font = `bold ${gap * 2.6}px 'Chalkboard SE', 'Comic Sans MS', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = NOTE_COLORS[n.letter];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    const ly = Math.max(gap * 2, y - gap * 5.5);
    ctx.strokeText(n.label, x, ly);
    ctx.fillText(n.label, x, ly);
    ctx.textAlign = 'left';
  }

  _renderPops(ctx, now, xOf, yOf, gap) {
    this.pops = this.pops.filter((p) => now - p.t0 < 700);
    for (const p of this.pops) {
      const n = this.notes[p.index];
      const t = (now - p.t0) / 700;
      const x = xOf(p.index);
      const y = yOf(n.step);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const d = t * gap * 3;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = k % 2 ? '#ffd93d' : NOTE_COLORS[n.letter];
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - t * 20, gap * 0.25 * (1 - t) + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}
