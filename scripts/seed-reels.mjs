// Seed demo reels for trying Phase 6 on the LOCAL stack (run after seed-audio + seed-feed).
// Reels are made of generated photo clips (no video encoder on the dev machine), with music,
// timed text, a speed change, a side-by-side remix, a sequence remix and a linked reel.
// Usage: node scripts/seed-reels.mjs   (run again after `npx supabase db reset`)
import { randomUUID } from 'node:crypto';

import { PALETTES, account, png } from './lib/seed.mjs';

let paletteIndex = 3;

const text = (body, start, end, y = 900) => ({
  id: randomUUID(),
  type: 'text',
  text: body,
  font: 'strong',
  color: '#FFFFFF',
  background: 'none',
  align: 'center',
  size: 96,
  x: 540,
  y,
  scale: 1,
  rotation: 0,
  start_ms: start,
  end_ms: end,
});

/** A reel of `clips` generated photos (3 s each unless `lengths` says otherwise). */
async function reel(
  user,
  caption,
  { clips = 3, lengths = [], speeds = [], extra = {}, overlays = [], remix } = {},
) {
  const id = randomUUID();
  const media = [];
  for (let i = 0; i < clips; i++) {
    const mid = randomUUID();
    const path = `${user.id}/${id}/${mid}.png`;
    const [a, b] = PALETTES[paletteIndex++ % PALETTES.length];
    const up = await user.client.storage
      .from('posts')
      .upload(path, png(540, 960, a, b), { contentType: 'image/png' });
    if (up.error) throw up.error;
    media.push({ mid, path });
  }
  const doc = {
    v: 1,
    clips: media.map((m, i) => ({
      media_id: m.mid,
      in_ms: 0,
      out_ms: lengths[i] ?? 3000,
      speed: speeds[i] ?? 1,
    })),
    volumes: { camera: 1, music: 0.8, voiceover: 1, original: 1 },
    voiceovers: [],
    overlays,
    ...(remix ? { remix } : {}),
  };
  const ins = await user.client.from('posts').insert({
    id,
    kind: 'reel',
    aspect_ratio: 0.5625,
    caption,
    reel: doc,
    cover_offset: 0.5,
    ...extra,
  });
  if (ins.error) throw ins.error;
  for (const [i, m] of media.entries()) {
    const r = await user.client.from('post_media').insert({
      id: m.mid,
      post_id: id,
      position: i,
      type: 'image',
      path: m.path,
      width: 1080,
      height: 1920,
    });
    if (r.error) throw r.error;
  }
  const pub = await user.client.rpc('publish_post', { p_post: id });
  if (pub.error) throw pub.error;
  return id;
}

const viewer = await account('dev.viewer', 'Dev Viewer');
const ana = await account('ana.lima', 'Ana Lima');
const ben = await account('ben.okafor', 'Ben Okafor');
const dina = await account('dina.travels', 'Dina Travels');

const { data: tracks } = await viewer.client
  .from('audio_tracks')
  .select('id, duration_ms')
  .neq('source', 'original')
  .order('title')
  .limit(3);
if (!tracks?.length) console.warn('No music catalog — run node scripts/seed-audio.mjs first.');
const track = (i) => (tracks?.[i] ? { audio_track_id: tracks[i].id, audio_start_ms: 0 } : {});

const r1 = await reel(ana, 'Sunset in 3 colours 🌅 #sunset #reels', {
  extra: track(0),
  overlays: [text('wait for it…', 0, 3000), text('🌅', 3000, 9000, 700)],
});
const r2 = await reel(dina, 'Lisbon in 6 seconds ⚡️ @ana.lima #travel', {
  clips: 4,
  lengths: [3000, 3000, 2000, 2000],
  speeds: [2, 2, 1, 1],
  extra: track(1),
  overlays: [text('Lisbon', 0, 6000, 500)],
});
const r3 = await reel(ben, 'Part 1: the plan 📝', { clips: 2, extra: track(2) });
await reel(ben, 'Part 2: it worked', {
  clips: 2,
  extra: { ...track(2), linked_reel_id: r3 },
});
await reel(ben, 'Reacting to this sunset 😮', {
  clips: 2,
  extra: { remix_of: r1, remix_layout: 'side_by_side' },
});
await reel(viewer, 'Adding my part 👇', {
  clips: 1,
  extra: { remix_of: r2, remix_layout: 'sequence' },
  remix: { in_ms: 0, out_ms: 4000 },
  overlays: [text('my turn', 0, 3000)],
});

const like = (u, p) => u.client.from('likes').upsert({ post_id: p }, { ignoreDuplicates: true });
await like(viewer, r2);
await like(ben, r1);
await like(dina, r1);
await ben.client.from('comments').insert({ post_id: r1, body: 'The colours 🔥' });
for (const u of [viewer, ben, dina]) await u.client.rpc('record_reel_play', { p_post: r1 });
await viewer.client.rpc('record_reel_play', { p_post: r2 });

console.log('Seeded 6 reels (2 remixes, 1 linked). Log in as dev.viewer and open the Reels tab.');
