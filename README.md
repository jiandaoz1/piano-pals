# Piano Pals 🎹

A game for a young beginner pianist. Notes scroll from right to left; the glowing note is the one to play. The browser listens through the microphone to an acoustic piano and says whether the note was right.

## Run

```
npm start        # serves http://localhost:8080 (needs python3)
npm test         # pitch detection, game logic and song-library tests (Node 20+)
```

Open http://localhost:8080 in Chrome/Safari/Edge, tap **Let's play!** and allow the microphone. (Microphones only work on `localhost` or HTTPS.)

## How it plays

- 6 levels, 104 songs (public-domain tunes plus original exercises). Levels 5-6 add key signatures (G, D, F, B♭), 3/4 and 2/4 time, eighth notes, sharps/flats and leaps. Stars are saved per song.
- Printed-style grand staff with clefs, key and time signature, and barlines.
- Hold judging: the mic detects when a key is released, so a half/whole note let go too early gets a "hold it for N counts" hint (with a counting bubble).
- At the end of a song a voice says "Great job!" (browser speech) along with the fanfare.
- Pieces are original or public domain, written in a method-book-style progression (no copyrighted book pieces).
- The mic is listened to continuously (YIN pitch detection). A note counts once the right pitch is held ~0.1 s. Wrong notes are judged only when steady, and each attempt counts once.
- Notes look like printed music: black heads with stems, hollow half/whole notes, dots and flags. Songs are repeated until they have at least 24 notes. Tunes write note values as `C4:2` (half), `:4` (whole), `:3` (dotted half), `:.5` (eighth).
- Rhythm hint: if a long note is cut short (or a quick note dragged), the bear reminds her how many counts to hold, judged from the time between note starts relative to her own pace.
- Right note: it pops and disappears. Wrong note: says which letter it heard and whether to go higher or lower.
- Hints for the current note: after 3 misses or 15 s, its letter appears; after 5 misses or 25 s, an on-screen keyboard points to the key.
- **🔤 Letters** toggles letter names under every note as a colored chip. **🔊 Hear it** plays the target note.
- **🎤 Mic check** shows what the app hears and can adjust for a piano that is slightly out of tune.
- The same note an octave away is accepted (so octave-detection slips don't frustrate), with a nudge to the glowing key.
- No piano handy? Use computer keys `A S D F G H J K` = C4 … C5.

## Layout

- `src/audio/` pitch detector, mic listener, feedback sounds
- `src/game/engine.js` judging, hints, repeat-note handling (pure logic)
- `src/songs/songs.js` song library and levels
- `src/ui/` lane, hint keyboard, app wiring
