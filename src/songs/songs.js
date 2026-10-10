import { NOTE_VALUES, parseMelody } from '../notes.js';

export const LEVELS = [
  { id: 1, name: 'Tiny Steps', emoji: '🐣', blurb: 'Just C, D and E', color: '#ffd93d' },
  { id: 2, name: 'Five Fingers', emoji: '🖐️', blurb: 'C D E F G', color: '#4cd964' },
  { id: 3, name: 'Rainbow Notes', emoji: '🌈', blurb: 'C up to high C', color: '#35c4f0' },
  { id: 4, name: 'Big Adventure', emoji: '🚀', blurb: 'Both hands, low and high', color: '#c26cff' },
  { id: 5, name: 'Key Explorers', emoji: '🧭', blurb: 'G and F keys, 3/4 and 2/4, eighth notes', color: '#ff8fb1' },
  { id: 6, name: 'Concert Stars', emoji: '🌟', blurb: 'D and B♭ keys, sharps, flats and leaps', color: '#7fe0c4' },
];

// Public-domain folk tunes plus original exercises, written in the key of C.
const RAW = [
  // Level 1: C D E
  [1, 'Hot Cross Buns', 'E4 D4 C4:2 E4 D4 C4:2 C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 E4 D4 C4:2'],
  [1, 'Step Up, Step Down', 'C4 D4 E4 E4 D4 C4 C4 D4 E4 D4 C4'],
  [1, 'Three Friends', 'C4 C4 D4 D4 E4 E4 D4 D4 C4 C4'],
  [1, 'Mary Had a Little Lamb (Part 1)', 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 E4 E4:2'],
  [1, 'Echo Hop', 'C4 E4 C4 E4 D4 D4 C4 E4 C4 E4 D4 C4'],
  [1, 'Walking Home', 'E4 D4 C4 D4 E4 D4 C4 C4 E4 E4 D4 D4 C4'],
  [1, 'Sleepy Caterpillar', 'C4 C4 D4 E4 E4 D4 C4 D4 E4 C4'],
  // Level 2: C D E F G
  [2, 'Mary Had a Little Lamb', 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'],
  [2, 'Ode to Joy', 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2'],
  [2, 'Jingle Bells', 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4 D4 E4:4 F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4:2 G4:2'],
  [2, 'Au Clair de la Lune', 'C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4 C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4'],
  [2, 'Lightly Row', 'G4 E4 E4:2 F4 D4 D4:2 C4 D4 E4 F4 G4 G4 G4:2 G4 E4 E4:2 F4 D4 D4:2 C4 E4 G4 G4 C4:4'],
  [2, 'Five Finger Run', 'C4 D4 E4 F4 G4 F4 E4 D4 C4'],
  [2, 'Jumping Frog', 'C4 G4 C4 G4 E4 E4 D4 F4 E4 D4 C4'],
  [2, 'Bumblebee Buzz', 'E4 D4 E4 D4 E4 F4 G4 F4 E4 D4 C4 D4 E4 C4'],
  // Level 3: C up to A, and high C
  [3, 'Twinkle, Twinkle, Little Star', 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'],
  [3, 'London Bridge', 'G4 A4 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4 A4 G4 F4 E4 F4 G4:2 D4 G4 E4 C4'],
  [3, 'Row, Row, Row Your Boat', 'C4 C4 C4 D4 E4:2 E4 D4 E4 F4 G4:2 C5 C5 C5 G4 G4 G4 E4 E4 E4 C4 C4 C4 G4 F4 E4 D4 C4:4'],
  [3, 'Frère Jacques', 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 G4 F4 E4 C4 G4 A4 G4 F4 E4 C4 C4 G4 C4'],
  [3, 'Old MacDonald', 'C4 C4 C4 G4 A4 A4 G4:2 E4 E4 D4 D4 C4:4'],
  [3, 'Camptown Races', 'G4 G4 E4 G4 A4 G4 E4 C4 C4 D4 E4 E4 D4 C4 D4 C4'],
  [3, 'Oh! Susanna', 'C4 D4 E4 G4 G4 A4 G4 E4 C4 D4 E4 E4 D4 C4 D4'],
  [3, 'Rainbow Climb', 'C4 D4 E4 F4 G4 A4 G4 F4 E4 D4 C4'],
  [3, 'Dancing Fingers', 'C4 E4 G4 A4 G4 E4 C4 D4 F4 A4 G4 E4 C4'],
  // Level 4: bigger range, left hand and two-octave jumps
  [4, 'Amazing Grace', 'G3 C4 E4 D4 C4 E4 D4 E4 G4 E4 G4 E4 C4 D4 C4 A3 G3 G3 C4 E4 D4 C4 E4 D4 E4 G4 C5'],
  [4, 'When the Saints Go Marching In', 'C4 E4 F4 G4 C4 E4 F4 G4 C4 E4 F4 G4 E4 C4 E4 D4 E4 E4 D4 C4 E4 C4 D4 C4'],
  [4, 'Happy Birthday', 'G4 G4 A4 G4 C5 B4 G4 G4 A4 G4 D5 C5 G4 G4 G5 E5 C5 B4 A4 F5 F5 E5 C5 D5 C5'],
  [4, 'Joy to the World', 'C5 B4 A4 G4 F4 E4 D4 C4 G4 A4 A4 B4 B4 C5 C5 C5 B4 A4 G4 G4 F4 E4 C5 C5 B4 A4 G4 G4 F4 E4'],
  [4, 'Yankee Doodle', 'C4 C4 D4 E4 C4 E4 D4 G3 C4 C4 D4 E4 C4 B3 G3'],
  [4, 'Left Hand Walk', 'C3 D3 E3 F3 G3 F3 E3 D3 C3'],
  [4, 'Bass Boom', 'C3 G3 C3 G3 E3 G3 C3'],
  [4, 'Down the Mountain', 'C5 B4 A4 G4 F4 E4 D4 C4'],
  [4, 'Two Hands Hello', 'C3 C4 G3 G4 C3 C4 E3 E4 C3'],
  [4, 'Low Mary', 'E3 D3 C3 D3 E3 E3 E3 D3 D3 D3 E3 G3 G3'],
  // More practice, Level 1
  [1, 'Little Steps', 'C4 D4 C4 D4 E4 D4 E4 D4 C4'],
  [1, 'Duck Walk', 'E4 E4 D4 D4 C4 C4 D4 E4 E4 E4 D4'],
  [1, 'Up the Hill', 'C4 C4 D4 D4 E4 E4 E4 D4 C4'],
  [1, 'Ladybug Hop', 'C4 E4 D4 E4 C4 E4 D4 C4'],
  [1, 'Rocking Boat', 'E4 D4 E4 D4 E4 D4 C4 D4 C4'],
  [1, 'Snail Song', 'C4 D4 E4 D4 C4 D4 E4 D4 C4 C4'],
  [1, 'Bunny Skip', 'E4 C4 E4 C4 D4 E4 D4 C4'],
  [1, 'Wiggle Worm', 'C4 D4 C4 D4 C4 D4 E4 E4 D4 D4 C4 C4'],
  [1, 'Good Morning', 'E4 D4 C4 E4 D4 C4 E4 E4 D4 D4 C4 C4'],
  [1, 'Fish Pond', 'D4 C4 D4 E4 E4 E4 D4 E4 D4 C4'],
  // More practice, Level 2
  [2, 'Itsy Bitsy Spider', 'G4 C4 C4 C4 D4 E4:2 E4 E4 D4 C4 D4 E4 C4:2'],
  [2, 'Do-Re-Mi (Part 1)', 'C4 D4 E4 C4 E4 C4 E4 D4 E4 F4 F4 E4 D4 F4 E4 F4 G4 E4 G4 E4 G4'],
  [2, 'Skipping Stones', 'C4 E4 G4 E4 C4 E4 G4 E4 C4'],
  [2, 'Marching Ants', 'C4 C4 E4 E4 G4 G4 E4 C4 D4 D4 F4 F4 E4 D4 C4'],
  [2, 'Raindrops', 'G4 F4 E4 D4 C4 G4 F4 E4 D4 C4'],
  [2, 'Butterfly', 'E4 G4 E4 G4 F4 D4 F4 D4 E4 C4'],
  [2, 'Pogo Stick', 'C4 G4 C4 G4 D4 G4 D4 G4 E4 G4 C4'],
  [2, 'Elephant Walk', 'C4 C4 G4 G4 F4 F4 E4 E4 D4 D4 C4'],
  [2, 'Kite Flying', 'C4 D4 E4 F4 G4 E4 C4 G4 E4 C4'],
  [2, 'Tippy Toes', 'E4 F4 E4 D4 E4 F4 G4 F4 E4 D4 C4'],
  // More practice, Level 3
  [3, 'Do-Re-Mi (Full Verse)', 'C4 D4 E4 C4 E4 C4 E4 D4 E4 F4 F4 E4 D4 F4 E4 F4 G4 E4 G4 E4 G4 F4 G4 A4 A4 G4 F4 A4'],
  [3, 'Brahms Lullaby', 'E4 E4 G4 E4 E4 G4 E4 G4 C5 B4 A4 A4 G4 D4 E4 F4 D4 D4 E4 F4 D4 F4 B4 A4 G4 C5'],
  [3, 'This Old Man', 'G4 E4 G4:2 G4 E4 G4:2 A4 G4 F4 E4 D4 C4:2'],
  [3, 'Mountain Top', 'C4 E4 G4 A4 C5 A4 G4 E4 C4'],
  [3, 'Tiptoe Up', 'C4 D4 E4 F4 G4 A4 B4 C5'],
  [3, 'Roller Coaster', 'C5 A4 G4 E4 C4 E4 G4 A4 C5'],
  [3, 'Skyscraper', 'C4 E4 G4 C5 B4 G4 E4 C4'],
  [3, 'Cloud Hopping', 'G4 A4 C5 A4 G4 E4 G4 A4 G4 E4 D4 C4'],
  [3, 'Sunny Day', 'E4 G4 A4 G4 E4 C4 D4 E4 G4 E4 D4 C4'],
  [3, 'Zigzag', 'C4 A4 D4 G4 E4 F4 E4 D4 C4'],
  // More practice, Level 4
  [4, 'Silent Night', 'G4:1.5 A4:.5 G4 E4:3 G4:1.5 A4:.5 G4 E4:3 D5:2 D5 B4:3 C5:2 C5 G4:3 A4:2 A4 C5:1.5 B4:.5 A4 G4:1.5 A4:.5 G4 E4:3 A4:2 A4 C5:1.5 B4:.5 A4 G4:1.5 A4:.5 G4 E4:3', { time: [3, 4] }],
  [4, 'We Wish You a Merry Christmas', 'G4 C5 C5 D5 C5 B4 A4 A4 A4 D5 D5 E5 D5 C5 B4 G4 G4 E5 E5 F5 E5 D5 C5 A4 G4 G4 A4 D5 B4 C5'],
  [4, 'Twinkle in the Bass', 'C3 C3 G3 G3 A3 A3 G3 F3 F3 E3 E3 D3 D3 C3'],
  [4, 'Ode to Joy (Left Hand)', 'E3 E3 F3 G3 G3 F3 E3 D3 C3 C3 D3 E3 E3 D3 D3'],
  [4, 'Hot Cross Buns (Low)', 'E3 D3 C3:2 E3 D3 C3:2 C3:.5 C3:.5 C3:.5 C3:.5 D3:.5 D3:.5 D3:.5 D3:.5 E3 D3 C3:2'],
  [4, 'Octave Leaps', 'C3 C4 D3 D4 E3 E4 D3 D4 C3'],
  [4, 'High Flyer', 'C5 E5 G5 E5 C5 G4 C5 E5 G5 C6'],
  [4, 'Ode to Joy (High)', 'E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 E5 D5 D5'],
  [4, 'Rocking Bass', 'C3 G3 E3 G3 C3 G3 E3 G3'],
  [4, 'Chord Hop', 'C3 E3 G3 C4 G3 E3 C3'],
  // Level 5: key signatures (G, F), 3/4 and 2/4, eighth notes, bass clef.
  // Original pieces and public-domain tunes in a method-book style progression.
  [1, 'Step Walk', 'C4 D4 E4 D4 C4 D4 E4:2 E4 D4 C4 D4 E4 D4 C4:2'],
  [2, 'Leapfrog Steps', 'C4 E4 G4 E4 C4 E4 G4:2 D4 F4 G4 F4 D4 F4 G4:2'],
  [3, 'Half Note Hop', 'C4:2 E4:2 G4:2 E4:2 D4 D4 F4:2 E4 E4 G4:2 C4:4'],
  [4, 'Bass Drum March', 'C3 C3 G3 G3 F3 F3 C3:2 E3 E3 G3 G3 D3 D3 C3:2'],
  [5, 'Dotted Dance', 'G4:1.5 A4:.5 B4 G4 B4:1.5 C5:.5 D5:2 C5 B4:1.5 A4:.5 G4 A4:2 B4 G4:3', { key: 'G', time: [3, 4] }],
  [6, 'Sharp Step Waltz', 'D4 F4 A4 D5:3 C5 A4 F4 A4:3 B4 G4 E4 G4:3 A4 F4 D4 D4:3', { key: 'D', time: [3, 4] }],
  [5, 'Ode to Joy in G', 'B4 B4 C5 D5 D5 C5 B4 A4 G4 G4 A4 B4 B4:1.5 A4:.5 A4:2 B4 B4 C5 D5 D5 C5 B4 A4 G4 G4 A4 B4 A4:1.5 G4:.5 G4:2', { key: 'G' }],
  [5, 'Jingle Bells in G', 'B4 B4 B4:2 B4 B4 B4:2 B4 D5 G4:1.5 A4:.5 B4:4 C5 C5 C5:1.5 C5:.5 C5 B4 B4 B4:.5 B4:.5 B4 A4 A4 B4 A4:2 D5:2', { key: 'G' }],
  [5, 'Twinkle in G', 'G4 G4 D5 D5 E5 E5 D5:2 C5 C5 B4 B4 A4 A4 G4:2 D5 D5 C5 C5 B4 B4 A4:2 D5 D5 C5 C5 B4 B4 A4:2 G4 G4 D5 D5 E5 E5 D5:2 C5 C5 B4 B4 A4 A4 G4:2', { key: 'G' }],
  [5, 'Mary Had a Little Lamb in G', 'B4 A4 G4 A4 B4 B4 B4:2 A4 A4 A4:2 B4 D5 D5:2 B4 A4 G4 A4 B4 B4 B4 B4 A4 A4 B4 A4 G4:4', { key: 'G' }],
  [5, 'Ode to Joy in F', 'A4 A4 B4 C5 C5 B4 A4 G4 F4 F4 G4 A4 A4:1.5 G4:.5 G4:2 A4 A4 B4 C5 C5 B4 A4 G4 F4 F4 G4 A4 G4:1.5 F4:.5 F4:2', { key: 'F' }],
  [5, 'Hot Cross Buns in F', 'A4 G4 F4:2 A4 G4 F4:2 F4:.5 F4:.5 F4:.5 F4:.5 G4:.5 G4:.5 G4:.5 G4:.5 A4 G4 F4:2', { key: 'F' }],
  [5, 'Waltz Walk', 'G4 A4 B4 D5:3 B4 A4 G4 A4:3 G4 A4 B4 D5 C5 B4 A4 B4 A4 G4:3', { key: 'G', time: [3, 4] }],
  [5, 'Sunset Waltz', 'F4 G4 A4 B4 A4 G4 A4 B4 C5 A4:3 F4 A4 C5 B4 A4 G4 F4 G4 A4 F4:3', { key: 'F', time: [3, 4] }],
  [5, 'Left Hand Waltz', 'C3 E3 G3 C4:3 G3 F3 E3 D3:3 C3 E3 G3 C4:3 G3 D3 F3 C3:3', { time: [3, 4] }],
  [5, 'Eighth Note Rain', 'C4:.5 D4:.5 E4:.5 F4:.5 G4:2 G4:.5 F4:.5 E4:.5 D4:.5 C4:2 E4:.5 F4:.5 G4:.5 A4:.5 G4:2 A4:.5 G4:.5 F4:.5 E4:.5 D4:2'],
  [5, 'Running Water', 'F4:.5 G4:.5 A4:.5 B4:.5 C5:2 C5:.5 B4:.5 A4:.5 G4:.5 F4:2 G4:.5 A4:.5 B4:.5 C5:.5 D5:2 C5:.5 B4:.5 A4:.5 G4:.5 F4:2', { key: 'F' }],
  [5, 'Sailing Along', 'C4 E4 G4 E4 F4 D4 C4:2 E4 G4 C5 G4 A4 F4 G4:2 C5 G4 E4 G4 F4 D4 C4:2', { time: [2, 4] }],
  [5, 'Marching Band', 'G4 G4 B4 B4 D5 B4 G4:2 A4 A4 C5 C5 B4 A4 G4:2', { key: 'G', time: [2, 4] }],
  [5, 'Bass Clef in G', 'G2 A2 B2 C3 D3:2 B2:2 G3 F3 E3 D3 G2:4', { key: 'G' }],
  [5, 'F-Sharp Fun', 'G4 A4 B4 C5 D5 C5 B4 A4 G4 F4 E4 D4 G4:4', { key: 'G' }],
  [5, 'B-Flat Breeze', 'F4 G4 A4 B4 C5 B4 A4 G4 F4 A4 C5 A4 F4:4', { key: 'F' }],
  // Level 6: more keys (D, B-flat), chromatic notes, big leaps, mixed values
  [6, 'Ode to Joy in D', 'F4 F4 G4 A4 A4 G4 F4 E4 D4 D4 E4 F4 F4:1.5 E4:.5 E4:2 F4 F4 G4 A4 A4 G4 F4 E4 D4 D4 E4 F4 E4:1.5 D4:.5 D4:2', { key: 'D' }],
  [6, 'Twinkle in D', 'D4 D4 A4 A4 B4 B4 A4:2 G4 G4 F4 F4 E4 E4 D4:2 A4 A4 G4 G4 F4 F4 E4:2 A4 A4 G4 G4 F4 F4 E4:2 D4 D4 A4 A4 B4 B4 A4:2 G4 G4 F4 F4 E4 E4 D4:2', { key: 'D' }],
  [6, 'Mary Had a Little Lamb in D', 'F4 E4 D4 E4 F4 F4 F4:2 E4 E4 E4:2 F4 A4 A4:2 F4 E4 D4 E4 F4 F4 F4 F4 E4 E4 F4 E4 D4:4', { key: 'D' }],
  [6, 'Ode to Joy in B-flat', 'D5 D5 E5 F5 F5 E5 D5 C5 B4 B4 C5 D5 D5:1.5 C5:.5 C5:2 D5 D5 E5 F5 F5 E5 D5 C5 B4 B4 C5 D5 C5:1.5 B4:.5 B4:2', { key: 'Bb' }],
  [6, 'Jingle Bells in B-flat', 'D5 D5 D5:2 D5 D5 D5:2 D5 F5 B4:1.5 C5:.5 D5:4 E5 E5 E5:1.5 E5:.5 E5 D5 D5 D5:.5 D5:.5 D5 C5 C5 D5 C5:2 F5:2', { key: 'Bb' }],
  [6, 'Hot Cross Buns in B-flat', 'D5 C5 B4:2 D5 C5 B4:2 B4:.5 B4:.5 B4:.5 B4:.5 C5:.5 C5:.5 C5:.5 C5:.5 D5 C5 B4:2', { key: 'Bb' }],
  [6, 'Waltz in D', 'D4 F4 A4 D5:3 C5 B4 A4 F4:3 D4 E4 F4 G4 A4 B4 C5 B4 A4 D5:3', { key: 'D', time: [3, 4] }],
  [6, 'B-Flat Waltz', 'B3 D4 F4 B4:3 A4 G4 F4 E4:3 D4 F4 B4 A4 F4 D4 E4 D4 C4 B3:3', { key: 'Bb', time: [3, 4] }],
  [6, 'Moonlight Walk', 'D4:.5 E4:.5 F4:.5 G4:.5 A4:2 A4:.5 G4:.5 F4:.5 E4:.5 D4:2 E4:.5 F4:.5 G4:.5 A4:.5 B4:2 B4:.5 A4:.5 G4:.5 F4:.5 E4:2 D4:4', { key: 'Bb' }],
  [6, 'Chromatic Climb', 'C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5:4'],
  [6, 'Chromatic Slide Down', 'C5 B4 Bb4 A4 Ab4 G4 Gb4 F4 E4 Eb4 D4 Db4 C4:4'],
  [6, 'Sharp Surprise', 'C4 E4 G4 F#4 G4 E4 C4:2 D4 F#4 A4 F#4 D4:4'],
  [6, 'Leaping Lions', 'C4 G4 E4 C5 G4 E4 C4 G3 A3 F4 C4 A4 G3:2 C4:2'],
  [6, 'High and Low Flyers', 'C3 G3 C4 E4 G4 C5 G4 E4 C4 G3 C3:2'],
];

export const MIN_NOTES = 24;

const EPS = 1e-9;

// Indices of notes that straddle a barline (should be none in well-formed music).
export function barIssues(notes, barBeats) {
  const bad = [];
  let t = 0;
  notes.forEach((n, i) => {
    const into = t % barBeats;
    if (into > EPS && into + n.beats > barBeats + EPS) bad.push(i);
    t += n.beats;
  });
  return bad;
}

// Fills the last bar by holding the final note, then plays short songs round again
// until they are long enough for real practice.
function build(melody, key, [num, den]) {
  const barBeats = (num * 4) / den;
  const once = parseMelody(melody, key);
  const total = once.reduce((sum, n) => sum + n.beats, 0);
  const rem = total % barBeats;
  if (rem > EPS) {
    const last = once[once.length - 1];
    const beats = last.beats + (barBeats - rem);
    if (!NOTE_VALUES.includes(beats)) throw new Error(`Cannot fill last bar of: ${melody}`);
    once[once.length - 1] = { ...last, beats };
  }
  const reps = Math.max(1, Math.ceil(MIN_NOTES / once.length));
  return Array.from({ length: reps }, () => once).flat();
}

export const SONGS = RAW.map(([level, title, melody, opts = {}], i) => {
  const key = opts.key ?? 'C';
  const time = opts.time ?? [4, 4];
  return {
    id: `s${String(i + 1).padStart(2, '0')}`,
    level,
    title,
    key,
    time,
    barBeats: (time[0] * 4) / time[1],
    notes: build(melody, key, time),
  };
}).sort((a, b) => a.level - b.level); // stable: keeps ids and order within a level

export function songsForLevel(level) {
  return SONGS.filter((s) => s.level === level);
}
