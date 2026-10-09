// Phase 5 (Stories) schema + RLS check against the LOCAL stack, with four fresh users:
// A (public author, C is a close friend), B (private author), C (follows A and B), D (follows A).
// Usage: node scripts/test-stories-rls.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_KEY;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing to run against a non-local URL');
const MAILPIT = 'http://127.0.0.1:54324';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
// Service role only to age stories past 24 h / 48 h (no client can change published_at).
const status = JSON.parse(
  execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
);
const admin = createClient(url, status.SERVICE_ROLE_KEY, opts);

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function latestCode(email) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`,
    );
    const { messages = [] } = await res.json();
    const match = messages[0]?.Subject.match(/\b(\d{6})\b/);
    if (match) return match[1];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No code email for ${email}`);
}

async function makeUser(label) {
  const client = createClient(url, key, opts);
  const email = `p5-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p5${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase5 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

/** Photo story; `stickers` are inserted while uploading. Returns { id, path }. */
async function makeStory(
  user,
  { audience = 'everyone', stickers = [], mentions = [], publish = true, upload = true } = {},
) {
  const id = randomUUID();
  const path = `${user.id}/${id}/media.jpg`;
  const ins = await user.client.from('stories').insert({
    id,
    kind: 'photo',
    media_path: path,
    thumb_path: path,
    files: [path],
    width: 1080,
    height: 1920,
    audience,
    content: { v: 1, elements: [] },
  });
  if (ins.error) throw ins.error;
  for (const s of stickers) {
    const r = await user.client.from('story_stickers').insert({ story_id: id, ...s });
    if (r.error) throw r.error;
  }
  for (const m of mentions) {
    const r = await user.client.from('story_mentions').insert({ story_id: id, user_id: m });
    if (r.error) throw r.error;
  }
  if (upload) {
    const up = await user.client.storage
      .from('stories')
      .upload(path, JPEG, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
  }
  if (publish) {
    const pub = await user.client.rpc('publish_story', { p_story: id });
    if (pub.error) throw pub.error;
  }
  return { id, path };
}

const rows = (res) => res.data ?? [];
const reel = async (viewer, owner) =>
  rows(await viewer.client.rpc('story_reel', { p_user: owner.id }));
const sees = async (viewer, owner, storyId) =>
  (await reel(viewer, owner)).some((s) => s.id === storyId);
const tray = async (viewer) => rows(await viewer.client.rpc('stories_tray'));
const canSign = async (viewer, path) =>
  !(await viewer.client.storage.from('stories').createSignedUrl(path, 60)).error;
const ageStory = (id, hours) =>
  admin
    .from('stories')
    .update({ published_at: new Date(Date.now() - hours * 3600_000).toISOString() })
    .eq('id', id);

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');
const d = await makeUser('d');
await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);
await c.client.rpc('follow_user', { target: a.id });
await c.client.rpc('follow_user', { target: b.id });
await b.client.rpc('approve_follow_request', { requester: c.id });
await d.client.rpc('follow_user', { target: a.id });
await a.client.from('close_friends').insert({ friend_id: c.id });

// ---- Publishing ----
const draft = await makeStory(a, { publish: false, upload: false });
{
  check("C can't see A's uploading story", !(await sees(c, a, draft.id)));
  const early = await a.client.rpc('publish_story', { p_story: draft.id });
  check('publish without the file fails (media_missing)', early.error?.message === 'media_missing');
  const outside = await a.client.from('stories').insert({
    id: randomUUID(),
    kind: 'photo',
    media_path: `${b.id}/x/media.jpg`,
    files: [`${b.id}/x/media.jpg`],
  });
  check("files outside the story's folder rejected", !!outside.error);
  const forged = await d.client.from('stories').insert({
    kind: 'text',
    author_id: a.id,
  });
  check('D cannot create a story as A', !!forged.error);
  const statusForge = await a.client.from('stories').insert({ kind: 'text', status: 'published' });
  check('client cannot insert status=published', !!statusForge.error);
  const textStory = await a.client.from('stories').insert({ kind: 'text', content: { v: 1 } });
  check('text story without media allowed', !textStory.error, textStory.error?.message);
  await a.client.storage.from('stories').upload(draft.path, JPEG, { contentType: 'image/jpeg' });
  const pub = await a.client.rpc('publish_story', { p_story: draft.id });
  check('publish after upload', !pub.error, pub.error?.message);
  check('C sees the published story', await sees(c, a, draft.id));
  const upd = await a.client
    .from('stories')
    .update({ audience: 'close_friends' })
    .eq('id', draft.id);
  check('stories have no client updates', !!upd.error);
}

// ---- Visibility: close friends, private, hide story from ----
const cf = await makeStory(a, { audience: 'close_friends' });
const priv = await makeStory(b);
{
  check('C (close friend) sees CF story', await sees(c, a, cf.id));
  check('D (not CF) does not see CF story', !(await sees(d, a, cf.id)));
  check('C can sign CF story file', await canSign(c, cf.path));
  check('D cannot sign CF story file', !(await canSign(d, cf.path)));
  check("C (approved) sees B's private story", await sees(c, b, priv.id));
  check("D can't see B's private story", !(await sees(d, b, priv.id)));
  check("D can't sign B's story file", !(await canSign(d, priv.path)));

  const trayC = await tray(c);
  const aRow = trayC.find((r) => r.user_id === a.id);
  check(
    'C tray has A with unseen + close friends ring',
    aRow?.has_unseen && aRow?.has_close_friends,
  );
  check(
    'C tray has B',
    trayC.some((r) => r.user_id === b.id),
  );
  const trayD = await tray(d);
  check(
    'D tray has A without CF ring',
    trayD.find((r) => r.user_id === a.id)?.has_close_friends === false,
  );
  check('D tray has no B', !trayD.some((r) => r.user_id === b.id));
  const ownTray = await tray(a);
  check('own tray starts with you', ownTray[0]?.user_id === a.id && ownTray[0]?.is_own);

  const hide = await a.client.from('story_hidden_from').insert({ hidden_id: d.id });
  check('A hides story from D', !hide.error, hide.error?.message);
  check('hidden: D sees no A stories', (await reel(d, a)).length === 0);
  check("hidden: D can't sign A's file", !(await canSign(d, draft.path)));
  check('hidden: D tray has no A', !(await tray(d)).some((r) => r.user_id === a.id));
  const peek = rows(await d.client.from('story_hidden_from').select('*'));
  check("D can't read A's hide list", peek.length === 0);
  await a.client.from('story_hidden_from').delete().eq('hidden_id', d.id);
  check('unhidden: D sees A again', await sees(d, a, draft.id));
}

// ---- Views (page 52 / 56) ----
{
  const mv = await c.client.rpc('mark_stories_viewed', { p_ids: [draft.id, cf.id] });
  check('C marks stories viewed', !mv.error, mv.error?.message);
  await c.client.rpc('mark_stories_viewed', { p_ids: [draft.id] });
  const ring = rows(await c.client.rpc('story_rings', { p_users: [a.id] }))[0];
  check('C ring for A: all seen', ring && ring.has_unseen === false, JSON.stringify(ring));
  const cards = await reel(c, a);
  check('C card seen = true', cards.find((s) => s.id === draft.id)?.seen === true);
  check('viewer cannot read view_count', cards.find((s) => s.id === draft.id)?.view_count === null);
  const own = (await reel(a, a)).find((s) => s.id === draft.id);
  check('A sees view_count 1 (repeat view counted once)', own?.view_count === 1);
  await a.client.rpc('mark_stories_viewed', { p_ids: [draft.id] });
  check(
    'own view not counted',
    (await reel(a, a)).find((s) => s.id === draft.id)?.view_count === 1,
  );
  const dv = await d.client.rpc('mark_stories_viewed', { p_ids: [cf.id] });
  const cfOwn = (await reel(a, a)).find((s) => s.id === cf.id);
  check('D cannot mark an invisible CF story viewed', !dv.error && cfOwn?.view_count === 1);
  const viewers = rows(await a.client.rpc('story_viewers', { p_story: draft.id }));
  check('A viewers list has C', viewers.length === 1 && viewers[0].user_id === c.id);
  const dViewers = rows(await d.client.rpc('story_viewers', { p_story: draft.id }));
  check("D can't list A's viewers", dViewers.length === 0);
  const forged = await d.client.from('story_views').insert({ story_id: draft.id, viewer_id: c.id });
  check('D cannot insert a view as C', !!forged.error);
}

// ---- Likes ----
{
  const like = await c.client.from('story_likes').insert({ story_id: draft.id });
  check('C likes story', !like.error, like.error?.message);
  const own = await a.client.from('story_likes').insert({ story_id: draft.id });
  check('A cannot like own story', !!own.error);
  const dSee = rows(await d.client.from('story_likes').select('*').eq('story_id', draft.id));
  check("D can't see C's private like", dSee.length === 0);
  const v = rows(await a.client.rpc('story_viewers', { p_story: draft.id }));
  check('A viewers row shows liked', v[0]?.liked === true);
  check('A like_count = 1', (await reel(a, a)).find((s) => s.id === draft.id)?.like_count === 1);
  check('C card liked', (await reel(c, a)).find((s) => s.id === draft.id)?.liked === true);
  const dCf = await d.client.from('story_likes').insert({ story_id: cf.id });
  check('D cannot like invisible CF story', !!dCf.error);
}

// ---- Replies + settings ----
{
  const r1 = await c.client.from('story_replies').insert({ story_id: draft.id, body: 'Nice!' });
  check('C replies (everyone)', !r1.error, r1.error?.message);
  const react = await c.client
    .from('story_replies')
    .insert({ story_id: draft.id, body: '🔥', is_reaction: true });
  check('C sends a quick reaction', !react.error);
  const v = rows(await a.client.rpc('story_viewers', { p_story: draft.id }));
  check('A sees latest reply in viewers', v[0]?.reply === '🔥' && v[0]?.reply_is_reaction === true);
  const dRead = rows(await d.client.from('story_replies').select('*').eq('story_id', draft.id));
  check("D can't read C's replies", dRead.length === 0);
  const own = await a.client.from('story_replies').insert({ story_id: draft.id, body: 'me' });
  check('A cannot reply to own story', !!own.error);

  await a.client.from('story_settings').upsert({ user_id: a.id, replies: 'off' });
  const off = await d.client.from('story_replies').insert({ story_id: draft.id, body: 'hi' });
  check('replies off: D rejected', !!off.error);
  check(
    'card replies_allowed false',
    (await reel(d, a)).find((s) => s.id === draft.id)?.replies_allowed === false,
  );
  await a.client.from('story_settings').update({ replies: 'following' }).eq('user_id', a.id);
  const notFollowed = await d.client
    .from('story_replies')
    .insert({ story_id: draft.id, body: 'hi' });
  check("replies 'following': D (not followed by A) rejected", !!notFollowed.error);
  await a.client.rpc('follow_user', { target: d.id });
  const followed = await d.client.from('story_replies').insert({ story_id: draft.id, body: 'hi' });
  check(
    "replies 'following': D allowed once A follows D",
    !followed.error,
    followed.error?.message,
  );
  await a.client.from('story_settings').update({ replies: 'everyone' }).eq('user_id', a.id);
  const peek = rows(await d.client.from('story_settings').select('*').eq('user_id', a.id));
  check("D can't read A's settings", peek.length === 0);
}

// ---- Stickers: poll, quiz, question, slider, countdown ----
const future = new Date(Date.now() + 86400_000).toISOString();
const pollId = randomUUID();
const quizId = randomUUID();
const questionId = randomUUID();
const sliderId = randomUUID();
const countdownId = randomUUID();
const rootId = randomUUID();
const stick = await makeStory(a, {
  stickers: [
    { id: pollId, type: 'poll', data: { question: 'Tea?', options: ['Yes', 'No'] } },
    {
      id: quizId,
      type: 'quiz',
      data: { question: '2+2?', options: ['3', '4', '5'] },
      correct_option: 1,
    },
    { id: questionId, type: 'question', data: { prompt: 'Ask me anything' } },
    { id: sliderId, type: 'slider', data: { question: 'How hot?', emoji: '🔥' } },
    { id: countdownId, type: 'countdown', data: { title: 'Launch', ends_at: future } },
    { id: rootId, type: 'add_yours', data: { prompt: 'Your pet' }, chain_id: rootId },
  ],
  mentions: [c.id],
});
{
  const dup = await a.client
    .from('story_stickers')
    .insert({ story_id: stick.id, type: 'question', data: { prompt: 'late' } });
  check('no stickers after publishing', !!dup.error);
  const badQuiz = await a.client.from('stories').insert({ kind: 'text' }).select('id').single();
  const bq = await a.client.from('story_stickers').insert({
    story_id: badQuiz.data.id,
    type: 'quiz',
    data: { question: 'q', options: ['a', 'b'] },
    correct_option: 5,
  });
  check('quiz with invalid answer rejected', !!bq.error);
  const twoPolls = await a.client.from('story_stickers').insert([
    { story_id: badQuiz.data.id, type: 'poll', data: { options: ['a', 'b'] } },
    { story_id: badQuiz.data.id, type: 'poll', data: { options: ['c', 'd'] } },
  ]);
  check('one poll per story', !!twoPolls.error);
  const leak = await c.client.from('story_stickers').select('correct_option').eq('id', quizId);
  check('viewer cannot select quiz answer', !!leak.error);
  const leak2 = await c.client.from('story_stickers').select('*').eq('id', quizId);
  check('viewer select * on stickers fails (column grant)', !!leak2.error);

  const cardBefore = (await reel(d, a)).find((s) => s.id === stick.id);
  const quizBefore = cardBefore?.stickers.find((s) => s.id === quizId);
  check('quiz results hidden before answering', quizBefore && quizBefore.results === null);
  const vote = await c.client
    .from('story_sticker_responses')
    .insert({ sticker_id: pollId, option: 0 });
  check('C votes in poll', !vote.error, vote.error?.message);
  const again = await c.client
    .from('story_sticker_responses')
    .insert({ sticker_id: pollId, option: 1 });
  check('second vote rejected', !!again.error);
  const bad = await d.client
    .from('story_sticker_responses')
    .insert({ sticker_id: pollId, option: 7 });
  check('invalid option rejected', !!bad.error);
  const ownVote = await a.client
    .from('story_sticker_responses')
    .insert({ sticker_id: pollId, option: 0 });
  check('author cannot vote', !!ownVote.error);
  const quiz = await c.client
    .from('story_sticker_responses')
    .insert({ sticker_id: quizId, option: 2 });
  check('C answers quiz', !quiz.error);
  const slide = await c.client
    .from('story_sticker_responses')
    .insert({ sticker_id: sliderId, value: 0.8 });
  check('C slides', !slide.error);
  const q1 = await c.client
    .from('story_sticker_responses')
    .insert({ sticker_id: questionId, body: 'Fav food?' });
  const q2 = await c.client
    .from('story_sticker_responses')
    .insert({ sticker_id: questionId, body: 'Fav city?' });
  check('C answers the question twice', !q1.error && !q2.error);
  const rem = await d.client.from('story_sticker_responses').insert({ sticker_id: countdownId });
  check('D sets a countdown reminder', !rem.error, rem.error?.message);
  const remDel = await d.client
    .from('story_sticker_responses')
    .delete()
    .eq('sticker_id', countdownId)
    .select();
  check('D removes the reminder', rows(remDel).length === 1);
  const pollDel = await c.client
    .from('story_sticker_responses')
    .delete()
    .eq('sticker_id', pollId)
    .select();
  check('poll vote cannot be deleted', rows(pollDel).length === 0);

  const cCard = (await reel(c, a)).find((s) => s.id === stick.id);
  const poll = cCard.stickers.find((s) => s.id === pollId);
  check('C sees poll counts after voting', JSON.stringify(poll.results?.counts) === '[1,0]');
  check('C card has own vote', poll.mine?.[0]?.option === 0);
  const qz = cCard.stickers.find((s) => s.id === quizId);
  check('C sees quiz answer after answering', qz.results?.correct === 1);
  const sl = cCard.stickers.find((s) => s.id === sliderId);
  check('C sees slider average', Math.abs((sl.results?.average ?? 0) - 0.8) < 0.01);
  const dPoll = (await reel(d, a))
    .find((s) => s.id === stick.id)
    .stickers.find((s) => s.id === pollId);
  check('D (no vote) sees no poll counts', dPoll.results === null);
  const resp = rows(await a.client.rpc('story_responses', { p_story: stick.id }));
  check('A sees all 5 responses', resp.length === 5, String(resp.length));
  const dResp = rows(await d.client.rpc('story_responses', { p_story: stick.id }));
  check("D can't list A's responses", dResp.length === 0);
  const dRaw = rows(
    await d.client.from('story_sticker_responses').select('*').eq('story_id', stick.id),
  );
  check("D can't read C's answers", dRaw.length === 0);
  check(
    'mention visible on card',
    cCard.mentions.some((m) => m.id === c.id),
  );
  const lateMention = await a.client
    .from('story_mentions')
    .insert({ story_id: stick.id, user_id: d.id });
  check('no mentions after publishing', !!lateMention.error);

  // Add yours chain
  const cId = randomUUID();
  const chained = await makeStory(c, {
    stickers: [{ id: cId, type: 'add_yours', data: { prompt: 'changed' }, chain_id: rootId }],
  });
  const chainRows = rows(await d.client.rpc('add_yours_chain', { p_chain: rootId }));
  check('D sees the chain (A + C)', chainRows.length === 2, String(chainRows.length));
  const cCardChain = (await reel(a, c)).find((s) => s.id === chained.id);
  const ay = cCardChain.stickers[0];
  check('chained prompt follows the root', ay.data.prompt === 'Your pet');
  check('participants = 2', ay.results?.participants === 2);
  const fakeRoot = await makeStory(d, {
    publish: false,
    upload: false,
  }).catch((e) => e);
  const fr = await d.client.from('story_stickers').insert({
    story_id: fakeRoot.id,
    type: 'add_yours',
    data: { prompt: 'x' },
    chain_id: cf.id,
  });
  check('chain must point at a visible root sticker', !!fr.error);
}

// ---- Expiry, archive, highlights ----
{
  const hl = await a.client.rpc('save_highlight', {
    p_highlight: null,
    p_title: 'Trips',
    p_cover_path: null,
    p_story_ids: [draft.id, cf.id],
  });
  check('A creates a highlight with 2 stories', !hl.error, hl.error?.message);
  const hlId = hl.data;
  const empty = await a.client.rpc('save_highlight', {
    p_highlight: null,
    p_title: 'Empty',
    p_cover_path: null,
    p_story_ids: [],
  });
  check('empty highlight rejected', !!empty.error);
  const steal = await d.client.rpc('save_highlight', {
    p_highlight: null,
    p_title: 'Stolen',
    p_cover_path: null,
    p_story_ids: [draft.id],
  });
  check("D can't put A's story in a highlight", !!steal.error);

  await ageStory(draft.id, 30);
  await ageStory(cf.id, 30);
  await ageStory(priv.id, 30);
  check('expired story leaves the reel', !(await sees(c, a, draft.id)));
  check("expired private story: C can't sign it", !(await canSign(c, priv.path)));
  check('highlighted expired story still signable', await canSign(c, draft.path));
  const cH = rows(await c.client.rpc('highlight_reel', { p_highlight: hlId }));
  check('C (CF) sees both highlight items', cH.length === 2);
  const dH = rows(await d.client.rpc('highlight_reel', { p_highlight: hlId }));
  check('D sees only the Everyone item', dH.length === 1 && dH[0].id === draft.id);
  const ph = rows(await d.client.rpc('profile_highlights', { p_user: a.id }));
  check('profile_highlights for D counts 1 visible item', ph[0]?.item_count === 1);
  const like = await c.client.from('story_likes').delete().eq('story_id', draft.id);
  check('unlike still allowed after expiry', !like.error);
  const lateLike = await c.client.from('story_likes').insert({ story_id: draft.id });
  check('no likes on expired stories', !!lateLike.error);
  const lateReply = await c.client
    .from('story_replies')
    .insert({ story_id: draft.id, body: 'late' });
  check('no replies on expired stories', !!lateReply.error);

  const arch = rows(await a.client.rpc('story_archive'));
  check(
    'archive lists own stories',
    arch.some((s) => s.id === draft.id && s.in_highlight),
  );
  const dArch = rows(await d.client.rpc('story_archive'));
  check("archive is own-only (D's is empty)", dArch.length === 0);

  check(
    'viewer names visible to A at 30 h',
    rows(await a.client.rpc('story_viewers', { p_story: draft.id })).length === 1,
  );
  await ageStory(draft.id, 50);
  check(
    'viewer names hidden after 48 h',
    rows(await a.client.rpc('story_viewers', { p_story: draft.id })).length === 0,
  );
  check(
    'view count kept after 48 h',
    rows(await a.client.rpc('story_cards', { p_ids: [draft.id] }))[0]?.view_count === 1,
  );

  // Save to archive off → expired story becomes purgeable unless highlighted.
  await a.client.from('story_settings').update({ save_to_archive: false }).eq('user_id', a.id);
  const temp = await makeStory(a);
  await ageStory(temp.id, 25);
  const purge = rows(await a.client.rpc('my_purgeable_stories'));
  check(
    'unarchived expired story is purgeable',
    purge.some((p) => p.id === temp.id),
  );
  check('highlighted story never purgeable', !purge.some((p) => p.id === draft.id));
  check(
    'archive hides unarchived expired story',
    !rows(await a.client.rpc('story_archive')).some((s) => s.id === temp.id),
  );
  await a.client.from('story_settings').update({ save_to_archive: true }).eq('user_id', a.id);

  // Removing the last items deletes the highlight.
  await a.client.from('highlight_items').delete().eq('highlight_id', hlId).eq('story_id', cf.id);
  await a.client.from('highlight_items').delete().eq('highlight_id', hlId).eq('story_id', draft.id);
  const gone = rows(await a.client.from('highlights').select('id').eq('id', hlId));
  check('empty highlight deletes itself', gone.length === 0);
}

// ---- Post sticker (share sheet → Add to story) + resharing setting ----
{
  const postId = randomUUID();
  await d.client.from('posts').insert({ id: postId, caption: 'D post', aspect_ratio: 1 });
  const p = `${d.id}/${postId}/0.jpg`;
  await d.client.storage.from('posts').upload(p, JPEG, { contentType: 'image/jpeg' });
  await d.client
    .from('post_media')
    .insert({ post_id: postId, position: 0, type: 'image', path: p, width: 1080, height: 1080 });
  await d.client.rpc('publish_post', { p_post: postId });
  const ok = await c.client.from('stories').insert({ kind: 'text', reshared_post_id: postId });
  check("C adds D's public post to a story", !ok.error, ok.error?.message);
  await d.client.from('story_settings').upsert({ user_id: d.id, allow_resharing: false });
  const blocked = await c.client.from('stories').insert({ kind: 'text', reshared_post_id: postId });
  check('resharing off: rejected', !!blocked.error);
  const own = await d.client.from('stories').insert({ kind: 'text', reshared_post_id: postId });
  check('author can still add own post', !own.error);
}

// ---- Reports + deletion ----
{
  const fresh = await makeStory(a);
  const rep = await c.client
    .from('reports')
    .insert({ target_type: 'story', target_id: fresh.id, reason: 'scam_spam' });
  check('C reports a story', !rep.error, rep.error?.message);
  const selfRep = await a.client
    .from('reports')
    .insert({ target_type: 'story', target_id: fresh.id, reason: 'scam_spam' });
  check('cannot report own story', !!selfRep.error);
  const dDel = await d.client.from('stories').delete().eq('id', fresh.id).select();
  check("D can't delete A's story", rows(dDel).length === 0);
  const aDel = await a.client.from('stories').delete().eq('id', fresh.id).select();
  check('A deletes own story', rows(aDel).length === 1);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
