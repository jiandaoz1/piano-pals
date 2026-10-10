import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.js';
import { parseMelody } from '../src/notes.js';
import { SONGS, LEVELS, barIssues } from '../src/songs/songs.js';

// Plays a pitch for ms at 16ms frames, returns the new clock.
function play(game, t, midi, ms, rms = 0.1) {
  for (let i = 0; i < ms / 16; i++, t += 16) game.update(t, { midiFloat: midi, rms });
  return t;
}
function rest(game, t, ms) {
  for (let i = 0; i < ms / 16; i++, t += 16) game.update(t, { midiFloat: null, rms: 0.001 });
  return t;
}
function make(melody, opts = {}) {
  const events = [];
  const game = new Game(parseMelody(melody), { ...opts, onEvent: (type, d) => events.push([type, d]) });
  return { game, events, types: () => events.map((e) => e[0]) };
}

test('correct note advances and finishes with stars', () => {
  const { game, types } = make('C4 D4');
  let t = play(game, 0, 60, 300);
  assert.equal(game.index, 1);
  t = play(game, t, 62, 300);
  assert.deepEqual(types(), ['correct', 'correct', 'done']);
});

test('wrong note is counted once per attempt and hints escalate', () => {
  const { game, types, events } = make('C4 D4');
  let t = 0;
  for (let i = 0; i < 5; i++) {
    t = play(game, t, 65, 400);
    t = rest(game, t, 200);
  }
  assert.equal(game.misses, 5);
  assert.equal(game.index, 0);
  const hints = events.filter((e) => e[0] === 'hint').map((e) => e[1].level);
  assert.deepEqual(hints, [1, 2]);
  assert.equal(types().filter((x) => x === 'wrong').length, 5);
});

test('a sustained wrong note counts only once', () => {
  const { game } = make('C4');
  play(game, 0, 65, 2000);
  assert.equal(game.misses, 1);
});

test('hints appear after waiting too long', () => {
  const { game, events } = make('C4');
  let t = rest(game, 0, 16000);
  assert.deepEqual(events.map((e) => e[1].level), [1]);
  rest(game, t, 10000);
  assert.deepEqual(events.map((e) => e[1].level), [1, 2]);
});

test('same note twice in a row needs a new attempt', () => {
  const { game } = make('C4 C4');
  let t = play(game, 0, 60, 300);
  assert.equal(game.index, 1);
  t = play(game, t, 60, 1000, 0.05); // still ringing
  assert.equal(game.index, 1);
  t = rest(game, t, 200);
  play(game, t, 60, 300);
  assert.equal(game.index, 2);
});

test('same note again counts on a fresh attack without silence', () => {
  const { game } = make('C4 C4');
  let t = play(game, 0, 60, 300, 0.1);
  t = play(game, t, 60, 500, 0.02);
  assert.equal(game.index, 1);
  play(game, t, 60, 300, 0.12);
  assert.equal(game.index, 2);
});

test('detuned piano within 40 cents still counts, between-keys ignored', () => {
  const a = make('C4');
  play(a.game, 0, 60.3, 300);
  assert.equal(a.game.index, 1);
  const b = make('C4');
  play(b.game, 0, 60.5, 300);
  assert.equal(b.game.index, 0);
});

test('octave leniency', () => {
  const lenient = make('C4');
  play(lenient.game, 0, 72, 300);
  assert.equal(lenient.game.index, 1);
  const strict = make('C4', { lenientOctave: false });
  play(strict.game, 0, 72, 400);
  assert.equal(strict.game.index, 0);
  assert.equal(strict.game.misses, 1);
});

test('input is ignored while muted', () => {
  const { game } = make('C4');
  game.mute(500, 0);
  play(game, 0, 60, 400);
  assert.equal(game.index, 0);
});

test('song library: 30+ songs, four levels, notes fit each level', () => {
  assert.ok(SONGS.length >= 70);
  const titles = new Set(SONGS.map((s) => s.title));
  assert.equal(titles.size, SONGS.length);
  for (const l of LEVELS) assert.ok(SONGS.filter((s) => s.level === l.id).length >= 14, `level ${l.id}`);
  for (const s of SONGS) {
    assert.ok(s.notes.length >= 24, s.title);
    for (const n of s.notes) {
      assert.ok(n.midi >= 43 && n.midi <= 84, `${s.title} ${n.name} out of range`);
      if (s.level === 1) assert.ok(n.midi >= 60 && n.midi <= 64 && 'CDE'.includes(n.letter), `${s.title} ${n.name}`);
      if (s.level === 2) assert.ok(n.midi >= 60 && n.midi <= 67, `${s.title} ${n.name}`);
      if (s.level === 3) assert.ok(n.midi >= 60 && n.midi <= 72, `${s.title} ${n.name}`);
    }
  }
});

test('the sound we play for "Hear it" is not mistaken for the child', () => {
  const { game } = make('C4 D4');
  game.mute(1000, 0, true);
  let t = play(game, 0, 60, 1000); // muted tail
  t = play(game, t, 60, 600, 0.03); // decaying tail after the mute ends
  assert.equal(game.index, 0);
  t = rest(game, t, 200);
  play(game, t, 60, 300);
  assert.equal(game.index, 1);
});

// Plays a note whose loudness decays naturally (key held) for ms.
function sustain(game, t, midi, ms, startRms = 0.1, tau = 2500) {
  for (let i = 0; i < ms / 16; i++, t += 16) game.update(t, { midiFloat: midi, rms: startRms * Math.exp(-(i * 16) / tau) });
  return t;
}

test('letting go of a half note too soon gives a rhythm hint, holding it does not', () => {
  const run = (holdMs, damp) => {
    const { game, events } = make('C4:1 D4:1 E4:1 F4:2 G4 A4');
    let t = 0;
    for (const m of [60, 62, 64]) {
      t = sustain(game, t, m, 400);
      t = rest(game, t, 300); // ~700 ms per quarter note
    }
    t = sustain(game, t, 65, holdMs);
    if (damp) t = rest(game, t, 300);
    sustain(game, t, 67, 300);
    return events.filter((e) => e[0] === 'rhythm');
  };
  const early = run(400, true);
  assert.equal(early.length, 1);
  assert.equal(early[0][1].kind, 'short');
  assert.equal(run(1500, false).length, 0);
});

test('note values parse', async () => {
  const { parseNote } = await import('../src/notes.js');
  assert.equal(parseNote('C4').beats, 1);
  assert.equal(parseNote('C4:2').beats, 2);
  assert.equal(parseNote('C4:.5').beats, 0.5);
  assert.throws(() => parseNote('C4:7'));
});

test('every song has proper bars and a whole number of bars per round', () => {
  for (const s of SONGS) {
    assert.deepEqual(barIssues(s.notes, s.barBeats), [], `${s.title} has a note across a barline`);
    const total = s.notes.reduce((sum, n) => sum + n.beats, 0);
    assert.equal(total % s.barBeats, 0, s.title);
  }
});

test('key signatures change plain letters; explicit accidentals override', async () => {
  const { parseNote } = await import('../src/notes.js');
  assert.equal(parseNote('F4', 'G').midi, 66);
  assert.equal(parseNote('Fn4', 'G').midi, 65);
  assert.equal(parseNote('B4', 'Bb').midi, 70);
  assert.equal(parseNote('C#4').midi, 61);
  assert.equal(parseNote('Bb4').label, 'B♭');
});

test('a whole note held with natural decay is not called short', () => {
  const { game, events } = make('C4:4 D4:4');
  game.fixedBeatMs = 800;
  let t = sustain(game, 0, 60, 3400, 0.05, 1200);
  t = rest(game, t, 300);
  sustain(game, t, 62, 300);
  assert.equal(events.filter((e) => e[0] === 'rhythm').length, 0);
});

test('levels 5 and 6 use key signatures and other meters', () => {
  assert.ok(SONGS.filter((s) => s.level >= 5).some((s) => s.key !== 'C'));
  assert.ok(SONGS.some((s) => s.time[0] === 3) && SONGS.some((s) => s.time[0] === 2));
});
