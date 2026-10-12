export const CONFIG = {
  correctHoldMs: 70, // how long the right pitch must be heard to count
  wrongHoldMs: 170, // wrong pitches must be steadier before we call them wrong
  maxCentsOff: 40, // ignore sounds that sit between two keys
  missesForLetterHint: 3,
  missesForKeyboardHint: 5,
  idleMsForLetterHint: 15000,
  idleMsForKeyboardHint: 25000,
  releaseSilenceMs: 120,
  onsetRatio: 1.5,
  defaultBeatMs: 800, // assumed quarter-note length until her own pace is known
};

// Pure game logic: feed it microphone frames with update(); it reports through onEvent.
// Events: 'correct' {note, index, octaveOff}, 'wrong' {heard, note}, 'hint' {level},
// 'rhythm' {kind: 'short'|'slow', note} (note value not honoured), 'done' {stars, misses}
export class Game {
  constructor(notes, { lenientOctave = true, onEvent = () => {}, config = {} } = {}) {
    this.notes = notes;
    this.cfg = { ...CONFIG, ...config };
    this.lenientOctave = lenientOctave;
    this.onEvent = onEvent;
    this.index = 0;
    this.misses = 0; // misses on the current note
    this.totalMisses = 0;
    this.hintLevel = 0;
    this.noteStart = null;
    this.muteUntil = 0;
    this.finished = false;
    this._resetTracker();
    this.armed = true;
    this.latched = null; // pitch already judged wrong, waiting for a new attempt
    this.lastCorrectMidi = null;
    this.silentSince = null;
    this.minRms = Infinity;
    this.prev = null; // last correct note and when it was played
    this.beatSamples = []; // observed quarter-note durations (ms)
    this.hold = null; // sustain tracking of the note just played
  }

  get target() {
    return this.notes[this.index] ?? null;
  }

  // disarm: the sound we play is the target pitch, so its tail must not count as the child's attempt.
  mute(ms, now, disarm = false) {
    this.muteUntil = now + ms;
    this._resetTracker();
    if (disarm && this.target) {
      this.armed = false;
      this.lastCorrectMidi = this.target.midi;
      this.minRms = Infinity;
      this.silentSince = null;
    }
  }

  _resetTracker() {
    this.candidate = null;
    this.candidateSince = 0;
  }

  update(now, { midiFloat, rms = 0 }) {
    if (this.finished) return;
    if (this.noteStart === null) this.noteStart = now;
    if (now < this.muteUntil) return;

    this._trackHold(now, rms);
    this._timeHints(now);

    const heard = this._quantise(midiFloat);
    this._trackRelease(now, heard, rms);

    if (heard === null) {
      this._resetTracker();
      return;
    }
    if (heard !== this.candidate) {
      this.candidate = heard;
      this.candidateSince = now;
      if (this.latched !== null && heard !== this.latched) this.latched = null;
      if (!this.armed && heard !== this.lastCorrectMidi) this.armed = true;
      return;
    }
    if (!this.armed) return;

    const held = now - this.candidateSince;
    const t = this.target;
    const exact = heard === t.midi;
    const octaveOff = !exact && this.lenientOctave && (heard - t.midi) % 12 === 0;
    if ((exact || octaveOff) && held >= this.cfg.correctHoldMs) {
      this._advance(now, heard, octaveOff);
    } else if (!exact && !octaveOff && held >= this.cfg.wrongHoldMs && this.latched !== heard) {
      this.latched = heard;
      this.misses++;
      this.totalMisses++;
      this.onEvent('wrong', { heard, note: t });
      this._missHints();
    }
  }

  _quantise(midiFloat) {
    if (midiFloat == null) return null;
    const r = Math.round(midiFloat);
    return Math.abs(midiFloat - r) * 100 <= this.cfg.maxCentsOff ? r : null;
  }

  // Lets the same key be played twice in a row: a pause or a fresh attack re-arms judging.
  _trackRelease(now, heard, rms) {
    if (rms < this.minRms) this.minRms = rms;
    const onset = rms > Math.max(this.minRms * this.cfg.onsetRatio, 0.006);
    if (heard === null) {
      this.silentSince ??= now;
      if (now - this.silentSince >= this.cfg.releaseSilenceMs) this._rearm();
    } else {
      this.silentSince = null;
    }
    if (onset && this.minRms !== Infinity) {
      this.minRms = rms;
      this._rearm();
      this.candidateSince = now; // measure the hold from the new attack
    }
  }

  _rearm() {
    this.armed = true;
    this.latched = null;
  }

  _advance(now, heard, octaveOff) {
    const note = this.target;
    const index = this.index;
    const clean = this.misses === 0 && this.hintLevel === 0;
    this.index++;
    this.misses = 0;
    this.hintLevel = 0;
    this.noteStart = now;
    this.armed = false;
    this.latched = null;
    this.lastCorrectMidi = heard;
    this.minRms = Infinity;
    this.silentSince = null;
    this._resetTracker();
    this.onEvent('correct', { note, index, octaveOff });
    this._judgeRhythm(note, now, clean);
    if (this.index >= this.notes.length) {
      this.finished = true;
      const m = this.totalMisses;
      this.onEvent('done', { stars: m <= 2 ? 3 : m <= 6 ? 2 : 1, misses: m });
    }
  }

  // Time between two note starts tells how long the first one lasted. Only judged when the
  // second note was found without misses (otherwise the gap is just searching time).
  _judgeRhythm(note, now, clean) {
    this._endHold(now);
    const prev = this.prev;
    this.prev = { note, t: now };
    this.hold = { note, t0: now, samples: [], judged: false };
    if (!prev || !clean) return;
    const ioi = now - prev.t;
    const beat = this._beat();
    if (prev.note.beats === 1 && ioi >= 250 && ioi <= 3000) {
      this.beatSamples.push(ioi);
      if (this.beatSamples.length > 6) this.beatSamples.shift();
    }
    if (beat !== null && prev.note.beats < 1 && ioi > 1.3 * beat) this.onEvent('rhythm', { kind: 'slow', note: prev.note });
  }

  // A key being let go shows up as a sudden drop in loudness (the damper stops the string).
  _trackHold(now, rms) {
    const h = this.hold;
    if (!h || h.judged) return;
    h.samples.push([now, rms]);
    while (h.samples.length && now - h.samples[0][0] > 400) h.samples.shift();
    if (now - h.t0 < 300) return;
    let ref = 0;
    for (const [t, r] of h.samples) if (now - t >= 80 && now - t <= 260) ref = Math.max(ref, r);
    if (ref > 0 && rms < 0.3 * ref) this._endHold(now - 60);
  }

  _endHold(endT) {
    const h = this.hold;
    if (!h || h.judged) return;
    h.judged = true;
    if (h.note.beats < 2) return;
    const expected = h.note.beats * (this._beat() ?? this.cfg.defaultBeatMs);
    const held = endT - h.t0;
    if (held < 0.5 * expected) this.onEvent('rhythm', { kind: 'short', note: h.note, heldMs: held, expectedMs: expected });
  }

  get beatMs() {
    return this._beat() ?? this.cfg.defaultBeatMs;
  }

  _beat() {
    if (this.fixedBeatMs) return this.fixedBeatMs; // metronome tempo
    if (this.beatSamples.length < 2) return null;
    const sorted = [...this.beatSamples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  _setHint(level) {
    if (level > this.hintLevel) {
      this.hintLevel = level;
      this.onEvent('hint', { level });
    }
  }

  _missHints() {
    if (this.misses >= this.cfg.missesForKeyboardHint) this._setHint(2);
    else if (this.misses >= this.cfg.missesForLetterHint) this._setHint(1);
  }

  _timeHints(now) {
    const idle = now - this.noteStart;
    if (idle >= this.cfg.idleMsForKeyboardHint) this._setHint(2);
    else if (idle >= this.cfg.idleMsForLetterHint) this._setHint(1);
  }
}
