export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const NOTE_COLORS = {
  C: '#ff5c5c',
  D: '#ff9f43',
  E: '#ffd93d',
  F: '#4cd964',
  G: '#35c4f0',
  A: '#6c7bff',
  B: '#c26cff',
};

export const NOTE_VALUES = [0.5, 1, 1.5, 2, 3, 4]; // eighth, quarter, dotted quarter, half, dotted half, whole

// Accidentals applied by each key signature (major keys).
export const KEYS = {
  C: {},
  G: { F: 1 },
  D: { F: 1, C: 1 },
  F: { B: -1 },
  Bb: { B: -1, E: -1 },
};
export const KEY_SIG_ORDER = {
  sharps: ['F', 'C', 'G', 'D', 'A', 'E', 'B'],
  flats: ['B', 'E', 'A', 'D', 'G', 'C', 'F'],
};

const ACC_GLYPH = { '-1': '♭', 0: '', 1: '♯' };

// "C4" -> { letter: 'C', octave: 4, midi: 60, step: 28, beats: 1 }; "C4:2" is a half note.
// A plain letter follows the key signature; "F#4", "Bb3" and "Bn4" (natural) are explicit.
export function parseNote(token, key = 'C') {
  const m = /^([A-G])([#bn]?)(\d)(?::(\d*\.?\d+))?$/.exec(token);
  if (!m) throw new Error(`Bad note: ${token}`);
  const beats = m[4] === undefined ? 1 : Number(m[4]);
  if (!NOTE_VALUES.includes(beats)) throw new Error(`Bad note value: ${token}`);
  const letter = m[1];
  const explicit = m[2];
  const alter = explicit === '#' ? 1 : explicit === 'b' ? -1 : explicit === 'n' ? 0 : (KEYS[key]?.[letter] ?? 0);
  const octave = Number(m[3]);
  return {
    name: `${letter}${octave}`,
    beats,
    letter,
    alter,
    label: letter + ACC_GLYPH[alter],
    accidental: explicit, // drawn in front of the note only when written explicitly
    octave,
    midi: 12 * (octave + 1) + SEMITONE[letter] + alter,
    // diatonic step counted from C0, used for staff placement
    step: octave * 7 + LETTERS.indexOf(letter),
  };
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidiFloat(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToName(midi) {
  return PC_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function isBlackKey(midi) {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

// "C4 D4 E4" -> parsed note objects
export function parseMelody(text, key = 'C') {
  return text.trim().split(/\s+/).map((t) => parseNote(t, key));
}

export function noteValueName(beats) {
  return { 0.5: 'eighth', 1: 'quarter', 1.5: 'dotted quarter', 2: 'half', 3: 'dotted half', 4: 'whole' }[beats];
}

// Letter name with sharp/flat sign, no octave: 66 -> "F♯"
export function pitchClassLabel(midi) {
  return midiToName(midi).replace(/\d+$/, '').replace('#', '♯');
}
