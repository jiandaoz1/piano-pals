import { Game } from '../game/engine.js';
import { MicListener } from '../audio/mic.js';
import { Synth } from '../audio/synth.js';
import { LEVELS, SONGS, songsForLevel } from '../songs/songs.js';
import { midiToName, noteValueName, pitchClassLabel } from '../notes.js';
import { Lane } from './lane.js';
import { drawKeyboard } from './keyboard.js';
import { load, save } from '../storage.js';

const $ = (id) => document.getElementById(id);
const store = load();
const mic = new MicListener();
const synth = new Synth();
const lane = new Lane($('lane'));

mic.tuningCents = store.tuningCents;

let game = null;
let song = null;
let level = 1;
let lastFrame = { midiFloat: null, rms: 0 };
let simMidi = null; // computer-keyboard fallback for testing without a piano
let heardMidi = null;

const CHEERS = ['Yay! 🌟', 'You got it! 🎉', 'Great playing! 🎵', 'Wow! ⭐', 'Perfect! 💖', 'Super! 🚀'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function say(text, anim) {
  $('bubble').textContent = text;
  if (anim) {
    const m = $('mascot');
    m.classList.remove('cheer', 'shake');
    void m.offsetWidth;
    m.classList.add(anim);
  }
}

mic.onFrame((f) => (lastFrame = f));

// ---------- welcome ----------
$('start').addEventListener('click', async () => {
  $('mic-error').hidden = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use a microphone here. Open the page at http://localhost.');
    await mic.start();
    synth._ctx();
    renderMenu();
    show('menu');
  } catch (e) {
    $('mic-error').hidden = false;
    $('mic-error').textContent = `I can't hear yet. Please allow the microphone and tap again. (${e.message})`;
  }
});

// ---------- menu ----------
function stars(id) {
  const n = store.stars[id] || 0;
  return n ? '⭐'.repeat(n) : '';
}

function renderMenu() {
  const levels = $('levels');
  levels.innerHTML = '';
  for (const l of LEVELS) {
    const div = document.createElement('div');
    div.className = 'level' + (l.id === level ? ' selected' : '');
    div.style.background = l.color;
    div.innerHTML = `<span class="emoji">${l.emoji}</span>Level ${l.id}: ${l.name}<small>${l.blurb}</small>`;
    div.addEventListener('click', () => {
      level = l.id;
      renderMenu();
    });
    levels.appendChild(div);
  }
  const songs = $('songs');
  songs.innerHTML = '';
  for (const s of songsForLevel(level)) {
    const div = document.createElement('div');
    div.className = 'song';
    div.innerHTML = `<span>🎵 ${s.title}<small class="meta"> ${s.key.replace('b', '♭')} major · ${s.time[0]}/${s.time[1]}</small></span><span class="st">${stars(s.id)}</span>`;
    div.addEventListener('click', () => startSong(s));
    songs.appendChild(div);
  }
}

// ---------- game ----------
function startSong(s) {
  if (metro.on) stopMetro();
  song = s;
  level = s.level;
  $('song-title').textContent = s.title;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('done').hidden = true;
  $('keys').classList.remove('show');
  lane.setSong(s);
  game = new Game(s.notes, { onEvent: onGameEvent });
  applyBeat();
  $('progress-fill').style.width = '0%';
  $('toggle-letters').classList.toggle('on', store.showLetters);
  say('Play the glowing note!');
  show('game');
}

function celebrate(stars) {
  const text = stars === 3 ? 'Fantastic! Great job!' : stars === 2 ? 'Great job!' : 'Good try! Keep practicing!';
  if (!('speechSynthesis' in window)) return;
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 1.3;
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }, 700);
}

let metro = { on: false, bpm: 70, timer: null, n: 0 };

function applyBeat() {
  $('bpm').textContent = metro.bpm;
  if (game) game.fixedBeatMs = metro.on ? 60000 / metro.bpm : null;
}

function stopMetro() {
  clearInterval(metro.timer);
  metro.timer = null;
  metro.on = false;
  $('metro').classList.remove('on');
  applyBeat();
}

function startMetro() {
  metro.on = true;
  metro.n = 0;
  $('metro').classList.add('on');
  const tick = () => {
    // Silence the listener while the click sounds so it is not mistaken for a note.
    if (game) game.mute(90, performance.now());
    synth.click(metro.n % song.time[0] === 0);
    metro.n++;
  };
  tick();
  metro.timer = setInterval(tick, 60000 / metro.bpm);
  applyBeat();
}

function retuneMetro(delta) {
  metro.bpm = Math.max(40, Math.min(120, metro.bpm + delta));
  const wasOn = metro.on;
  if (wasOn) stopMetro();
  applyBeat();
  if (wasOn) startMetro();
}

$('metro').addEventListener('click', () => (metro.on ? stopMetro() : startMetro()));
$('metro-down').addEventListener('click', () => retuneMetro(-5));
$('metro-up').addEventListener('click', () => retuneMetro(5));

function muteFor(ms, disarm = false) {
  game.mute(ms, performance.now(), disarm);
}

function onGameEvent(type, d) {
  const now = performance.now();
  if (type === 'correct') {
    lane.pop(d.index, now);
    lane.setIndex(game.index);
    $('progress-fill').style.width = `${(game.index / song.notes.length) * 100}%`;
    $('keys').classList.remove('show');
    let msg = d.octaveOff ? 'Right note! Try the glowing key 🎹' : pick(CHEERS);
    const next = game.target;
    if (next && next.beats >= 2) msg += ` Next is a ${noteValueName(next.beats)} note: hold it for ${next.beats} counts!`;
    say(msg, 'cheer');
    muteFor(game.finished ? 0 : synth.correct());
  } else if (type === 'wrong') {
    lane.shake(now);
    const dir = d.heard > d.note.midi ? 'Too high, go lower ⬇️' : 'Too low, go higher ⬆️';
    say(`I heard ${pitchClassLabel(d.heard)}. ${dir}`, 'shake');
    muteFor(synth.oops());
  } else if (type === 'rhythm') {
    const v = noteValueName(d.note.beats);
    say(d.kind === 'short' ? `That was a ${v} note. Hold it for ${d.note.beats} counts! ⏳` : `That was a quick ${v} note. Play the next one sooner! 🐇`, 'shake');
  } else if (type === 'hint') {
    if (d.level === 1) say(`Hint: this note is ${game.target.label}!`);
    else {
      say(`Look at the keyboard! It is ${game.target.label} 👇`);
      $('keys').classList.add('show');
    }
  } else if (type === 'done') {
    const best = Math.max(store.stars[song.id] || 0, d.stars);
    store.stars[song.id] = best;
    save(store);
    muteFor(synth.cheer());
    celebrate(d.stars);
    $('stars').textContent = '⭐'.repeat(d.stars) + '☆'.repeat(3 - d.stars);
    const idx = SONGS.indexOf(song);
    $('next').hidden = idx === SONGS.length - 1;
    setTimeout(() => ($('done').hidden = false), 600);
  }
}

$('hear').addEventListener('click', () => {
  if (!game || game.finished) return;
  muteFor(synth.play(game.target.midi), true);
  say(`Listen! 🔊`);
});
$('toggle-letters').addEventListener('click', () => {
  store.showLetters = !store.showLetters;
  save(store);
  $('toggle-letters').classList.toggle('on', store.showLetters);
});
$('again').addEventListener('click', () => startSong(song));
$('next').addEventListener('click', () => startSong(SONGS[SONGS.indexOf(song) + 1]));
$('to-menu').addEventListener('click', () => backToMenu());
document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', backToMenu));

function backToMenu() {
  if (metro.on) stopMetro();
  game = null;
  $('done').hidden = true;
  renderMenu();
  show('menu');
}

// ---------- mic check ----------
$('open-calib').addEventListener('click', () => {
  updateTuneInfo();
  show('calib');
});

function updateTuneInfo() {
  const c = Math.round(store.tuningCents);
  $('tune-info').textContent = c ? `Piano adjustment: ${c > 0 ? '+' : ''}${c} cents` : 'Piano adjustment: none';
}

$('tune-btn').addEventListener('click', () => {
  const m = lastFrame.midiFloat;
  if (m == null) return;
  const off = (m - Math.round(m)) * 100;
  store.tuningCents = Math.max(-50, Math.min(50, store.tuningCents + off));
  mic.tuningCents = store.tuningCents;
  save(store);
  updateTuneInfo();
});
$('tune-reset').addEventListener('click', () => {
  store.tuningCents = mic.tuningCents = 0;
  save(store);
  updateTuneInfo();
});

// ---------- computer keyboard fallback: A S D F G H J K = C4 .. C5 ----------
const KEYMAP = { a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72 };
window.addEventListener('keydown', (e) => {
  if (e.key in KEYMAP && !e.repeat) simMidi = KEYMAP[e.key];
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.key] === simMidi) simMidi = null;
});

// ---------- main loop ----------
function loop(now) {
  requestAnimationFrame(loop);
  const frame = simMidi != null ? { midiFloat: simMidi, rms: 0.1 } : lastFrame;
  heardMidi = frame.midiFloat == null ? null : Math.round(frame.midiFloat);

  if ($('calib').classList.contains('active')) {
    $('meter-fill').style.width = `${Math.min(100, frame.rms * 600)}%`;
    $('heard').textContent = heardMidi == null ? '…' : midiToName(heardMidi).replace(/\d/, '');
  }
  if ($('game').classList.contains('active') && game) {
    game.update(now, frame);
    const h = game.hold;
    const count = h && !h.judged && h.note.beats >= 2 ? Math.min(h.note.beats, Math.floor((now - h.t0) / game.beatMs) + 1) : 0;
    lane.render(now, { showLetters: store.showLetters, hintLevel: game.hintLevel, count });
    if (game.hintLevel >= 2 && game.target) {
      const mids = song.notes.map((n) => n.midi);
      drawKeyboard($('keys'), { target: game.target, heard: heardMidi, minMidi: Math.min(...mids), maxMidi: Math.max(...mids) }, now);
    }
  }
}
requestAnimationFrame(loop);

// release the mic when the tab is closed
window.addEventListener('pagehide', () => mic.stop());

window.__piano = { get game() { return game; }, lane };
