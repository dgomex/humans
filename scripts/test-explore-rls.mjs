// Phase 7 (Search & Explore) schema + RLS check against the LOCAL stack, with four fresh users:
// A (public creator), B (private creator), C (follows A and B; B approves), D (follows nobody).
// Usage: node scripts/test-explore-rls.mjs
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

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const rows = (r) => r.data ?? [];
const ids = (r) => rows(r).map((x) => x.id ?? x.post_id);

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
  const email = `p7-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p7${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase7 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);

/** Publish a photo post (or a single-video reel with `video`). Returns the post id. */
async function makePost(user, caption, { audience = 'everyone', video = false } = {}) {
  const id = randomUUID();
  const mediaId = randomUUID();
  const ins = await user.client.from('posts').insert({
    id,
    caption,
    audience,
    aspect_ratio: video ? 0.5625 : 1,
    ...(video
      ? {
          kind: 'reel',
          reel: {
            v: 1,
            clips: [{ media_id: mediaId, in_ms: 0, out_ms: 4000, speed: 1 }],
            voiceovers: [],
            overlays: [],
          },
        }
      : {}),
  });
  if (ins.error) throw ins.error;
  const path = `${user.id}/${id}/${mediaId}.${video ? 'mp4' : 'jpg'}`;
  const up = await user.client.storage
    .from('posts')
    .upload(path, video ? MP4 : JPEG, { contentType: video ? 'video/mp4' : 'image/jpeg' });
  if (up.error) throw up.error;
  const m = await user.client.from('post_media').insert({
    id: mediaId,
    post_id: id,
    position: 0,
    type: video ? 'video' : 'image',
    path,
    width: 1080,
    height: video ? 1920 : 1080,
    duration_ms: video ? 4000 : null,
  });
  if (m.error) throw m.error;
  const pub = await user.client.rpc('publish_post', { p_post: id });
  if (pub.error) throw pub.error;
  return id;
}

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');
const d = await makeUser('d');

await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);
await c.client.rpc('follow_user', { target: a.id });
await c.client.rpc('follow_user', { target: b.id });
await b.client.rpc('approve_follow_request', { requester: c.id });

// Unique words so the shared local DB (seed data) doesn't interfere.
const tag = `p7tag${randomUUID().slice(0, 6)}`;
const word = `zebra${randomUUID().slice(0, 6)}`;
const secret = `hidden${randomUUID().slice(0, 6)}`;

const aPost = await makePost(a, `Sunset ${word} #${tag}`);
const aPost2 = await makePost(a, `Another one #${tag}`);
const aCf = await makePost(a, `Close friends only #${tag} ${word}`, { audience: 'close_friends' });
const aReel = await makePost(a, `Reel time #${tag}`, { video: true });
const bPost = await makePost(b, `Private ${secret} #${tag}`);
const bReel = await makePost(b, `Private reel ${secret}`, { video: true });
const dPost = await makePost(d, `Mine ${word} #${tag}`);
check('setup: posts and reels published', true);

// ---- Explore grid (page 65) ----
{
  const grid = await d.client.rpc('explore_grid', { p_limit: 60 });
  check('D: explore_grid runs', !grid.error, grid.error?.message);
  const got = ids(grid);
  check('D: explore shows A public post + reel', got.includes(aPost) && got.includes(aReel));
  check('D: explore hides B private posts', !got.includes(bPost) && !got.includes(bReel));
  check('D: explore hides A Close Friends post', !got.includes(aCf));
  check('D: explore hides your own posts', !got.includes(dPost));
  const reel = rows(grid).find((r) => r.id === aReel);
  check('explore tile has kind + cover', reel?.kind === 'reel' && !!reel?.cover_path);

  const snap = new Date().toISOString();
  const p1 = await d.client.rpc('explore_grid', { p_snapshot: snap, p_offset: 0, p_limit: 3 });
  const p2 = await d.client.rpc('explore_grid', { p_snapshot: snap, p_offset: 3, p_limit: 3 });
  const overlap = ids(p1).filter((x) => ids(p2).includes(x));
  check('explore paging is stable for one snapshot (no repeats)', overlap.length === 0);

  const anon = createClient(url, key, opts);
  const ar = await anon.rpc('explore_grid', {});
  check('anon cannot call explore_grid', !!ar.error);
}

// ---- Similar posts (page 70) ----
{
  const sim = await d.client.rpc('similar_posts', { p_post: aPost, p_limit: 30 });
  check('D: similar_posts runs', !sim.error, sim.error?.message);
  const list = rows(sim);
  check('similar: excludes the seed post', !list.some((r) => r.post_id === aPost));
  const first = list.filter((r) => r.similarity > 0).map((r) => r.post_id);
  check(
    'similar: same-author + same-hashtag posts rank as similar',
    first.includes(aPost2) && first.includes(aReel),
  );
  check(
    'similar: no private / Close Friends / own posts',
    !list.some((r) => [bPost, bReel, aCf, dPost].includes(r.post_id)),
  );
  const sorted = list.findIndex((r) => r.similarity === 0);
  check(
    'similar: similar posts come before the rest',
    sorted === -1 || list.slice(sorted).every((r) => r.similarity === 0),
  );
}

// ---- Hashtag page (page 68) ----
{
  const page = await d.client.rpc('hashtag_page', { p_name: `#${tag.toUpperCase()}` });
  check('hashtag_page normalizes "#TAG"', rows(page)[0]?.name === tag, page.error?.message);
  check('hashtag_page count = published posts using it', rows(page)[0]?.post_count === 6);
  check(
    'hashtag_page cover is a post D can see',
    [aPost, aPost2, aReel, dPost].includes(rows(page)[0]?.cover_post_id),
  );
  const none = await d.client.rpc('hashtag_page', { p_name: 'neverusedtag123456' });
  check('unknown hashtag → no row', rows(none).length === 0);

  const top = ids(await d.client.rpc('hashtag_posts', { p_name: tag, p_tab: 'top' }));
  check('D: Top shows A public post + reel', top.includes(aPost) && top.includes(aReel));
  check('D: Top hides private + Close Friends posts', !top.includes(bPost) && !top.includes(aCf));
  const cTop = ids(await c.client.rpc('hashtag_posts', { p_name: tag, p_tab: 'top' }));
  check('C (approved follower): Top includes B private post', cTop.includes(bPost));
  const reels = ids(await d.client.rpc('hashtag_posts', { p_name: tag, p_tab: 'reels' }));
  check('Reels tab = reels only', reels.length === 1 && reels[0] === aReel);
  const recent = rows(await d.client.rpc('hashtag_posts', { p_name: tag, p_tab: 'recent' }));
  check('Recent tab: newest first', recent[0]?.id === dPost || recent[0]?.id === aReel);
}

// ---- Search (page 66) ----
{
  const acc = await d.client.rpc('search_accounts', { p_query: b.username });
  check(
    'D finds private account B by username',
    rows(acc)[0]?.id === b.id && rows(acc)[0]?.is_private,
  );
  const byName = await d.client.rpc('search_accounts', { p_query: 'phase7 a' });
  check(
    'search by full name (case-insensitive)',
    ids(byName).includes(a.id),
    byName.error?.message,
  );
  const cAcc = rows(await c.client.rpc('search_accounts', { p_query: a.username }))[0];
  check('C sees "Following" on A', cAcc?.i_follow === true);
  const mutual = rows(await c.client.rpc('search_accounts', { p_query: d.username }))[0];
  check(
    'search result for D has no follow flags for C',
    mutual?.i_follow === false && mutual?.requested === false,
  );
  const atQuery = await d.client.rpc('search_accounts', { p_query: `@${a.username}` });
  check('leading @ is ignored', rows(atQuery)[0]?.id === a.id);
  const empty = await d.client.rpc('search_accounts', { p_query: '   ' });
  check('blank query → no accounts', rows(empty).length === 0);

  const tags = await d.client.rpc('search_hashtags', { p_query: `#${tag.slice(0, 8)}` });
  check(
    'hashtag prefix search',
    rows(tags).some((t) => t.name === tag),
    tags.error?.message,
  );

  const posts = ids(await d.client.rpc('search_posts', { p_query: word, p_kind: 'top' }));
  check('D: keyword search finds A caption', posts.includes(aPost));
  check('D: keyword search hides Close Friends + own-scope rules', !posts.includes(aCf));
  const hidden = ids(await d.client.rpc('search_posts', { p_query: secret, p_kind: 'top' }));
  check('D: keyword search hides private B posts', hidden.length === 0);
  const cHidden = ids(await c.client.rpc('search_posts', { p_query: secret, p_kind: 'top' }));
  check('C: keyword search finds B posts', cHidden.includes(bPost) && cHidden.includes(bReel));
  const byTag = ids(await d.client.rpc('search_posts', { p_query: tag, p_kind: 'reels' }));
  check('search Reels tab: hashtag match, reels only', byTag.length === 1 && byTag[0] === aReel);
  const byUser = ids(await d.client.rpc('search_posts', { p_query: a.username, p_kind: 'top' }));
  check('search posts by author username', byUser.includes(aPost2));

  // Original audio of B's private reel: visible to C, not to D.
  const dAudio = rows(await d.client.rpc('search_audio', { p_query: b.username }));
  check('D: private original audio not found', dAudio.length === 0);
  const cAudio = rows(await c.client.rpc('search_audio', { p_query: b.username }));
  check('C: private original audio found', cAudio.length === 1 && cAudio[0].source === 'original');
  const aAudio = rows(await d.client.rpc('search_audio', { p_query: a.username }));
  check('D: public original audio found with reel count', aAudio[0]?.reel_count === 1);
}

// ---- Not interested → excluded everywhere ----
{
  await d.client.from('post_hides').insert({ post_id: aPost2, reason: 'not_interested' });
  const grid = ids(await d.client.rpc('explore_grid', { p_limit: 60 }));
  check('Not interested post leaves explore', !grid.includes(aPost2));
  const top = ids(await d.client.rpc('hashtag_posts', { p_name: tag, p_tab: 'top' }));
  check('Not interested post leaves hashtag grid', !top.includes(aPost2));
  const sim = rows(await d.client.rpc('similar_posts', { p_post: aPost, p_limit: 30 }));
  check('Not interested post leaves the scroller', !sim.some((r) => r.post_id === aPost2));
}

// ---- Recent searches (page 67) ----
{
  const tagId = rows(await d.client.rpc('hashtag_page', { p_name: tag }))[0].id;
  const r1 = await d.client.rpc('record_search', { p_kind: 'account', p_target: a.id });
  check('record account search', !r1.error, r1.error?.message);
  await d.client.rpc('record_search', { p_kind: 'hashtag', p_target: tagId });
  await d.client.rpc('record_search', { p_kind: 'keyword', p_query: '  Cats  ' });
  await d.client.rpc('record_search', { p_kind: 'keyword', p_query: 'cats' });
  await new Promise((r) => setTimeout(r, 20));
  await d.client.rpc('record_search', { p_kind: 'account', p_target: a.id });
  const list = rows(await d.client.rpc('recent_searches', {}));
  check('recents: 3 entries (case-insensitive de-dup)', list.length === 3, `${list.length}`);
  check(
    'recents: repeat moves to the top',
    list[0]?.kind === 'account' && list[0]?.username === a.username,
  );
  check(
    'recents: hashtag carries name + count',
    list.some((x) => x.tag_name === tag && x.post_count === 6),
  );

  const badKind = await d.client.rpc('record_search', { p_kind: 'place', p_target: a.id });
  check('unknown kind rejected', !!badKind.error);
  const badTarget = await d.client.rpc('record_search', {
    p_kind: 'account',
    p_target: randomUUID(),
  });
  check('missing account rejected', !!badTarget.error);
  const bAudio = rows(await c.client.rpc('search_audio', { p_query: b.username }))[0];
  const hiddenAudio = await d.client.rpc('record_search', { p_kind: 'audio', p_target: bAudio.id });
  check('invisible original audio rejected', !!hiddenAudio.error);
  const direct = await d.client.from('search_history').insert({ kind: 'keyword', query: 'sneaky' });
  check('direct insert rejected (RPC only)', !!direct.error);

  const cSees = rows(await c.client.from('search_history').select('id').eq('user_id', d.id));
  check("C can't read D's history", cSees.length === 0);
  const cDel = await c.client.from('search_history').delete().eq('user_id', d.id).select();
  check("C can't delete D's history", rows(cDel).length === 0);

  const one = list.find((x) => x.kind === 'keyword');
  await d.client.from('search_history').delete().eq('id', one.id);
  check('remove one entry', rows(await d.client.rpc('recent_searches', {})).length === 2);

  for (let i = 0; i < 55; i++) {
    await d.client.rpc('record_search', { p_kind: 'keyword', p_query: `q${i}` });
  }
  const capped = rows(await d.client.from('search_history').select('id'));
  check('history keeps the newest 50', capped.length === 50, `${capped.length}`);
  await d.client.from('search_history').delete().eq('user_id', d.id);
  check('clear all', rows(await d.client.rpc('recent_searches', {})).length === 0);
}

// ---- Reports on hashtags + reserved names ----
{
  const tagId = rows(await d.client.rpc('hashtag_page', { p_name: tag }))[0].id;
  const rep = await d.client
    .from('reports')
    .insert({ target_type: 'hashtag', target_id: tagId, reason: 'scam_spam' });
  check('report a hashtag', !rep.error, rep.error?.message);
  const bad = await d.client
    .from('reports')
    .insert({ target_type: 'hashtag', target_id: randomUUID(), reason: 'scam_spam' });
  check('report a missing hashtag rejected', !!bad.error);
  for (const name of ['search', 'tags', 'explore-feed', 'recent-searches']) {
    const v = await d.client.rpc('username_available', { name });
    check(`"${name}" is reserved`, v.data === false, v.error?.message);
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
