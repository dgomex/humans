// Seed stories for trying Phase 5 on the LOCAL stack (run after seed-feed.mjs, which creates the
// accounts). Adds active stories with text and interactive stickers, a Close Friends story,
// views / likes / replies on dev.viewer's story, and an archived story in a highlight.
// Usage: node scripts/seed-stories.mjs   (run again after `npx supabase db reset` + seed-feed)
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { PALETTES, account, opts, png, url } from './lib/seed.mjs';

const status = JSON.parse(
  execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
);
// Service role only to age one story past 24 h (archive + highlight demo).
const admin = createClient(url, status.SERVICE_ROLE_KEY, opts);

const W = 1080;
const H = 1920;
const el = (sticker, x, y, extra = {}) => ({
  id: randomUUID(),
  type: 'sticker',
  sticker,
  x,
  y,
  scale: 1,
  rotation: 0,
  ...extra,
});
const text = (value, y, extra = {}) => ({
  id: randomUUID(),
  type: 'text',
  text: value,
  font: 'classic',
  color: '#FFFFFF',
  background: 'none',
  align: 'center',
  size: 80,
  x: W / 2,
  y,
  scale: 1,
  rotation: 0,
  ...extra,
});

let palette = 0;
/**
 * One story. `kind` photo (generated gradient) or text; `stickers` rows are
 * { el, row: { type, data, correct_option?, chain_id? } } so content and DB stay in sync.
 */
async function story(
  user,
  {
    kind = 'photo',
    audience = 'everyone',
    elements = [],
    stickers = [],
    mentions = [],
    background,
  } = {},
) {
  const id = randomUUID();
  const files = [];
  let mediaPath = null;
  if (kind === 'photo') {
    mediaPath = `${user.id}/${id}/media.png`;
    const [a, b] = PALETTES[palette++ % PALETTES.length];
    const up = await user.client.storage
      .from('stories')
      .upload(mediaPath, png(540, 960, a, b), { contentType: 'image/png' });
    if (up.error) throw up.error;
    files.push(mediaPath);
  }
  const content = {
    v: 1,
    background: background ?? ['#2B2B2B', '#121212'],
    media: kind === 'photo' ? { x: 0, y: 0, scale: 1, rotation: 0 } : undefined,
    elements: [...elements, ...stickers.map((s) => s.el)],
  };
  const ins = await user.client.from('stories').insert({
    id,
    kind,
    media_path: mediaPath,
    thumb_path: mediaPath,
    files,
    width: kind === 'photo' ? 540 : null,
    height: kind === 'photo' ? 960 : null,
    audience,
    content,
  });
  if (ins.error) throw ins.error;
  for (const s of stickers) {
    const r = await user.client
      .from('story_stickers')
      .insert({ story_id: id, id: s.el.sticker.stickerId, ...s.row });
    if (r.error) throw r.error;
  }
  for (const m of mentions) {
    const r = await user.client.from('story_mentions').insert({ story_id: id, user_id: m });
    if (r.error) throw r.error;
  }
  const pub = await user.client.rpc('publish_story', { p_story: id });
  if (pub.error) throw pub.error;
  return id;
}

function poll(question, options) {
  const stickerId = randomUUID();
  return {
    el: el({ kind: 'poll', stickerId, question, options }, W / 2, H * 0.62),
    row: { type: 'poll', data: { question, options } },
  };
}
function quiz(question, options, correct) {
  const stickerId = randomUUID();
  return {
    el: el({ kind: 'quiz', stickerId, question, options }, W / 2, H * 0.6),
    row: { type: 'quiz', data: { question, options }, correct_option: correct },
  };
}
function question(prompt) {
  const stickerId = randomUUID();
  return {
    el: el({ kind: 'question', stickerId, prompt }, W / 2, H * 0.55),
    row: { type: 'question', data: { prompt } },
  };
}
function slider(q, emoji) {
  const stickerId = randomUUID();
  return {
    el: el({ kind: 'slider', stickerId, question: q, emoji }, W / 2, H * 0.42),
    row: { type: 'slider', data: { question: q, emoji } },
  };
}
function countdown(title, hours) {
  const stickerId = randomUUID();
  const endsAt = new Date(Date.now() + hours * 3600_000).toISOString();
  return {
    el: el({ kind: 'countdown', stickerId, title, endsAt }, W / 2, H * 0.62),
    row: { type: 'countdown', data: { title, ends_at: endsAt } },
  };
}
function addYours(prompt) {
  const stickerId = randomUUID();
  return {
    el: el({ kind: 'add_yours', stickerId, prompt }, W / 2, H * 0.66),
    row: { type: 'add_yours', data: { prompt }, chain_id: stickerId },
  };
}

const viewer = await account('dev.viewer', 'Dev Viewer');
const ana = await account('ana.lima', 'Ana Lima');
const ben = await account('ben.okafor', 'Ben Okafor');
const cam = await account('cam.private', 'Cam (private)');

// Ana: photo + text, a poll, and a Close Friends story (dev.viewer is on her list).
await story(ana, { elements: [text('Pier sunrise 🌅', H * 0.25)] });
await story(ana, {
  elements: [
    text('Help me pick!', H * 0.3, {
      font: 'strong',
      background: 'solid',
      color: '#FD8D32',
      size: 70,
    }),
  ],
  stickers: [poll('Beach or mountains?', ['Beach', 'Mountains'])],
});
await story(ana, {
  audience: 'close_friends',
  elements: [text('Just for you 💚', H * 0.35, { font: 'neon', color: '#70C050' })],
});

// Ben: text story with a question, then a photo with a countdown and a link.
await story(ben, {
  kind: 'text',
  background: ['#833AB4', '#FD1D1D'],
  elements: [text('AMA time!', H * 0.3, { font: 'modern', size: 110 })],
  stickers: [question('Ask me anything')],
});
await story(ben, {
  stickers: [countdown('Trip to Lisbon', 72)],
  elements: [
    el({ kind: 'link', url: 'https://example.com/lisbon', label: 'Itinerary' }, W / 2, H * 0.82),
  ],
});

// Cam (private, dev.viewer approved): emoji slider + mention of dev.viewer + Add yours.
await story(cam, {
  stickers: [slider('How excited are you?', '🔥'), addYours('Show your desk setup')],
  elements: [
    el({ kind: 'mention', userId: viewer.id, username: viewer.username }, W / 2, H * 0.22),
  ],
  mentions: [viewer.id],
});

// dev.viewer: own story with a quiz (Ana and Ben watch, like, reply, answer) …
const own = await story(viewer, {
  elements: [text('Quiz time 🧠', H * 0.25, { font: 'typewriter' })],
  stickers: [quiz('Capital of Portugal?', ['Porto', 'Lisbon', 'Faro'], 1)],
});
for (const u of [ana, ben]) await u.client.rpc('mark_stories_viewed', { p_ids: [own] });
await ana.client.from('story_likes').upsert({ story_id: own }, { ignoreDuplicates: true });
await ben.client.from('story_replies').insert({ story_id: own, body: 'Easy one 😎' });
await ana.client.from('story_replies').insert({ story_id: own, body: '🔥', is_reaction: true });
const quizId = (await viewer.client.from('story_stickers').select('id').eq('story_id', own))
  .data?.[0]?.id;
await ana.client
  .from('story_sticker_responses')
  .insert({ sticker_id: quizId, story_id: own, type: 'quiz', option: 1 });
await ben.client
  .from('story_sticker_responses')
  .insert({ sticker_id: quizId, story_id: own, type: 'quiz', option: 0 });

// … and an older story (aged past 24 h) kept in the archive and a "Trips" highlight.
const old = await story(viewer, {
  elements: [text('Throwback ✈️', H * 0.3, { font: 'modern', size: 100 })],
});
await admin
  .from('stories')
  .update({ published_at: new Date(Date.now() - 3 * 86_400_000).toISOString() })
  .eq('id', old);
const hl = await viewer.client.rpc('save_highlight', {
  p_highlight: null,
  p_title: 'Trips',
  p_cover_path: null,
  p_story_ids: [old],
});
if (hl.error) throw hl.error;

console.log('Seeded stories. Log in as @dev.viewer (password in .test-users.local.json).');
