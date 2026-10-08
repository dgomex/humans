// Page 039 — seed the placeholder royalty-free music catalog on the LOCAL stack.
// Synthesizes short instrumental loops (no downloads), uploads them to the public `audio`
// bucket and upserts `audio_tracks`. Safe to re-run. Run again after `npx supabase db reset`.
// To use real CC0 tracks instead: put files in the bucket and rows in `audio_tracks`
// with source = 'cc0' and the license / attribution in `license`.
// Usage: node scripts/seed-audio.mjs
import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
const url = status.API_URL;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing to run against a non-local URL');
const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RATE = 22050;
const SECONDS = 24;

// Semitone offsets from A4 (440 Hz).
const freq = (semi) => 440 * 2 ** (semi / 12);
// Chords as semitone offsets of their root from A4; triad shape major/minor.
const triad = (root, minor) => [root, root + (minor ? 3 : 4), root + 7];

const TRACKS = [
  {
    title: 'Golden Hour',
    artist: 'Humans Studio',
    bpm: 96,
    root: 3,
    prog: [
      [0, 0],
      [7, 0],
      [9, 1],
      [5, 0],
    ],
    color: '#F39C12',
  },
  {
    title: 'Night Drive',
    artist: 'Humans Studio',
    bpm: 110,
    root: -2,
    prog: [
      [0, 1],
      [8, 0],
      [3, 0],
      [10, 0],
    ],
    color: '#2C3E50',
  },
  {
    title: 'Beach Day',
    artist: 'Loop Collective',
    bpm: 120,
    root: 0,
    prog: [
      [0, 0],
      [5, 0],
      [7, 0],
      [5, 0],
    ],
    color: '#1ABC9C',
  },
  {
    title: 'Slow Morning',
    artist: 'Loop Collective',
    bpm: 72,
    root: 5,
    prog: [
      [0, 0],
      [9, 1],
      [5, 0],
      [7, 0],
    ],
    color: '#E8A0BF',
  },
  {
    title: 'City Lights',
    artist: 'Placeholder Band',
    bpm: 104,
    root: -5,
    prog: [
      [0, 1],
      [5, 1],
      [10, 0],
      [3, 0],
    ],
    color: '#8E44AD',
  },
  {
    title: 'Road Trip',
    artist: 'Placeholder Band',
    bpm: 128,
    root: 2,
    prog: [
      [0, 0],
      [7, 0],
      [5, 0],
      [0, 0],
    ],
    color: '#E74C3C',
  },
  {
    title: 'Rainy Window',
    artist: 'Humans Studio',
    bpm: 80,
    root: -3,
    prog: [
      [0, 1],
      [3, 0],
      [8, 0],
      [7, 0],
    ],
    color: '#34495E',
  },
  {
    title: 'Celebrate',
    artist: 'Loop Collective',
    bpm: 116,
    root: 7,
    prog: [
      [0, 0],
      [9, 1],
      [2, 1],
      [7, 0],
    ],
    color: '#F1C40F',
  },
];

function synth({ bpm, root, prog }) {
  const n = RATE * SECONDS;
  const out = new Float32Array(n);
  const beat = 60 / bpm;
  const bar = beat * 4;
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const barIdx = Math.floor(t / bar);
    const [offset, minor] = prog[barIdx % prog.length];
    const chord = triad(root + offset - 12, minor);
    const inBar = t - barIdx * bar;
    const inBeat = t % beat;
    let s = 0;

    // Pad: soft sine triad with a fade-in per bar.
    const padEnv = Math.min(1, inBar / 0.4) * 0.12;
    for (const semi of chord) s += Math.sin(2 * Math.PI * freq(semi) * t) * padEnv;

    // Arpeggio: triangle eighth notes walking up the chord.
    const eighth = beat / 2;
    const step = Math.floor(t / eighth);
    const note = chord[step % 3] + 12 * (Math.floor(step / 3) % 2);
    const phase = (freq(note) * t) % 1;
    const tri = 4 * Math.abs(phase - 0.5) - 1;
    s += tri * Math.exp(-(t % eighth) * 9) * 0.16;

    // Bass on the root, every beat.
    s += Math.sin(2 * Math.PI * freq(chord[0] - 12) * t) * Math.exp(-inBeat * 3) * 0.22;

    // Kick on every beat, hat on the off-beats.
    const kickF = 50 + 90 * Math.exp(-inBeat * 30);
    s += Math.sin(2 * Math.PI * kickF * inBeat) * Math.exp(-inBeat * 12) * 0.35;
    const off = (t + beat / 2) % beat;
    s += noise() * Math.exp(-off * 60) * 0.05;

    out[i] = s;
  }
  // Fade the loop edges and normalize.
  const fade = RATE * 0.05;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const edge = Math.min(1, i / fade, (n - 1 - i) / fade);
    out[i] *= edge;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  for (let i = 0; i < n; i++) out[i] = (out[i] / peak) * 0.85;
  return out;
}

function wav(samples) {
  const data = samples.length * 2;
  const buf = Buffer.alloc(44 + data);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  return buf;
}

for (const track of TRACKS) {
  const slug = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const path = `placeholder/${slug}.wav`;
  const up = await admin.storage
    .from('audio')
    .upload(path, wav(synth(track)), { contentType: 'audio/wav', upsert: true });
  if (up.error) throw up.error;
  const row = await admin.from('audio_tracks').upsert(
    {
      title: track.title,
      artist: track.artist,
      duration_ms: SECONDS * 1000,
      audio_path: path,
      cover_color: track.color,
      source: 'placeholder',
      license: 'CC0 (generated by scripts/seed-audio.mjs)',
    },
    { onConflict: 'audio_path' },
  );
  if (row.error) throw row.error;
  console.log(`seeded  ${track.title}  →  audio/${path}`);
}
console.log(`\n${TRACKS.length} tracks ready`);
