// Phase 6 (Reels) schema + RLS check against the LOCAL stack, with four fresh users:
// A (public creator), B (private creator), C (follows A and B; B approves), D (follows nobody).
// Usage: node scripts/test-reels-rls.mjs
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
  const email = `p6-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p6${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase6 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
// Not a playable video: the database and storage rules only look at names, types and sizes.
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
const M4A = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);

async function upload(user, path, bytes, contentType) {
  const r = await user.client.storage
    .from('posts')
    .upload(path, bytes, { contentType, upsert: true });
  return r.error;
}

/**
 * Creates a reel: one clip per `clips` entry ('video' | 'image'), optional voiceover + cover,
 * insert-time `extra` columns and an edit document. Returns { id, error, media, paths }.
 */
async function makeReel(
  user,
  {
    clips = ['image'],
    extra = {},
    doc = true,
    cover = true,
    voiceover = false,
    publish = true,
    durationMs = 4000,
  } = {},
) {
  const id = randomUUID();
  const media = clips.map((type) => ({ id: randomUUID(), type }));
  const coverPath = `${user.id}/${id}/cover.jpg`;
  const voPath = `${user.id}/${id}/vo-1.m4a`;
  const reel = doc
    ? {
        v: 1,
        clips: media.map((m) => ({ media_id: m.id, in_ms: 0, out_ms: durationMs, speed: 1 })),
        voiceovers: voiceover ? [{ id: '1', path: voPath, at_ms: 0, duration_ms: 1000 }] : [],
        overlays: [],
      }
    : null;
  const ins = await user.client.from('posts').insert({
    id,
    kind: 'reel',
    aspect_ratio: 0.5625,
    caption: 'reel #p6test',
    reel,
    cover_path: cover ? coverPath : null,
    ...extra,
  });
  if (ins.error) return { id, error: ins.error };
  for (const [i, m] of media.entries()) {
    const ext = m.type === 'video' ? 'mp4' : 'jpg';
    const path = `${user.id}/${id}/${m.id}.${ext}`;
    const upErr = await upload(
      user,
      path,
      m.type === 'video' ? MP4 : JPEG,
      m.type === 'video' ? 'video/mp4' : 'image/jpeg',
    );
    if (upErr) return { id, error: upErr };
    const r = await user.client.from('post_media').insert({
      id: m.id,
      post_id: id,
      position: i,
      type: m.type,
      path,
      width: 1080,
      height: 1920,
      duration_ms: m.type === 'video' ? durationMs : null,
    });
    if (r.error) return { id, error: r.error };
  }
  if (cover) await upload(user, coverPath, JPEG, 'image/jpeg');
  if (voiceover) {
    const e = await upload(user, voPath, M4A, 'audio/mp4');
    if (e) return { id, error: e };
  }
  if (publish) {
    const pub = await user.client.rpc('publish_post', { p_post: id });
    if (pub.error) return { id, error: pub.error };
  }
  return { id, error: null, media, coverPath, voPath };
}

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');
const d = await makeUser('d');

await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);
await c.client.rpc('follow_user', { target: a.id });
await c.client.rpc('follow_user', { target: b.id });
await b.client.rpc('approve_follow_request', { requester: c.id });

// ---- Creating reels ----
const aReel = await makeReel(a, { clips: ['video', 'image'], voiceover: true });
check(
  'A publishes a reel (video + photo clips, cover, voiceover)',
  !aReel.error,
  aReel.error?.message,
);
const bReel = await makeReel(b, { clips: ['video'] });
check('B (private) publishes a reel', !bReel.error, bReel.error?.message);

{
  const id = randomUUID();
  const bad = await a.client.from('posts').insert({
    id,
    kind: 'reel',
    aspect_ratio: 0.5625,
    cover_path: `${b.id}/${id}/cover.jpg`,
  });
  check('cover path outside your folder is rejected', !!bad.error);
  const postCover = await a.client.from('posts').insert({
    id: randomUUID(),
    kind: 'post',
    aspect_ratio: 1,
    cover_path: `${a.id}/x/cover.jpg`,
  });
  check('posts (kind post) cannot have reel columns', !!postCover.error);
  const narrow = await a.client
    .from('posts')
    .insert({ id: randomUUID(), kind: 'post', aspect_ratio: 0.5625 });
  check('9:16 is reel-only (posts keep 3:4 … 1.91)', !!narrow.error);
}
{
  const missingCover = await makeReel(a, { cover: false, extra: { cover_path: null } });
  check(
    'reel without a cover still publishes (first clip is the cover)',
    !missingCover.error,
    missingCover.error?.message,
  );
  const noCoverFile = await (async () => {
    const id = randomUUID();
    await a.client.from('posts').insert({
      id,
      kind: 'reel',
      aspect_ratio: 0.5625,
      cover_path: `${a.id}/${id}/cover.jpg`,
    });
    const mid = randomUUID();
    const path = `${a.id}/${id}/${mid}.jpg`;
    await upload(a, path, JPEG, 'image/jpeg');
    await a.client
      .from('post_media')
      .insert({
        id: mid,
        post_id: id,
        position: 0,
        type: 'image',
        path,
        width: 1080,
        height: 1920,
      });
    return a.client.rpc('publish_post', { p_post: id });
  })();
  check(
    'publish fails when the cover file is missing',
    noCoverFile.error?.message === 'media_missing',
    noCoverFile.error?.message,
  );

  const badClip = await makeReel(a, { doc: false, publish: false });
  const upd = await a.client.rpc('publish_post', { p_post: badClip.id });
  check('reel without a document publishes as a single clip', !upd.error, upd.error?.message);

  const tooLong = await makeReel(a, { clips: ['video'], durationMs: 180_000, extra: {} });
  check('3-minute clip is accepted on reels', !tooLong.error, tooLong.error?.message);
  const longPost = await (async () => {
    const id = randomUUID();
    await a.client.from('posts').insert({ id, kind: 'post', aspect_ratio: 1 });
    const mid = randomUUID();
    return a.client.from('post_media').insert({
      id: mid,
      post_id: id,
      position: 0,
      type: 'video',
      path: `${a.id}/${id}/${mid}.mp4`,
      width: 1080,
      height: 1080,
      duration_ms: 90_000,
    });
  })();
  check(
    'carousel videos stay ≤ 60 s',
    longPost.error?.message === 'video_too_long',
    longPost.error?.message,
  );

  const twoLong = await makeReel(a, { clips: ['video', 'video'], durationMs: 120_000 });
  check(
    'edit list longer than 3 minutes is rejected',
    twoLong.error?.message === 'reel_too_long',
    twoLong.error?.message,
  );

  // Voiceover in someone else's folder.
  const id = randomUUID();
  const mid = randomUUID();
  await a.client.from('posts').insert({
    id,
    kind: 'reel',
    aspect_ratio: 0.5625,
    reel: {
      v: 1,
      clips: [{ media_id: mid, in_ms: 0, out_ms: 2000, speed: 1 }],
      voiceovers: [{ id: '1', path: `${b.id}/${id}/vo.m4a`, at_ms: 0, duration_ms: 500 }],
    },
  });
  const path = `${a.id}/${id}/${mid}.jpg`;
  await upload(a, path, JPEG, 'image/jpeg');
  await a.client
    .from('post_media')
    .insert({ id: mid, post_id: id, position: 0, type: 'image', path, width: 1080, height: 1920 });
  const vo = await a.client.rpc('publish_post', { p_post: id });
  check(
    'voiceover outside the reel folder is rejected',
    vo.error?.message === 'bad_voiceover_path',
    vo.error?.message,
  );

  // Clip referring to another post's media.
  const id2 = randomUUID();
  await a.client.from('posts').insert({
    id: id2,
    kind: 'reel',
    aspect_ratio: 0.5625,
    reel: { v: 1, clips: [{ media_id: aReel.media[0].id, in_ms: 0, out_ms: 1000, speed: 1 }] },
  });
  const m2 = randomUUID();
  const p2 = `${a.id}/${id2}/${m2}.jpg`;
  await upload(a, p2, JPEG, 'image/jpeg');
  await a.client
    .from('post_media')
    .insert({
      id: m2,
      post_id: id2,
      position: 0,
      type: 'image',
      path: p2,
      width: 1080,
      height: 1920,
    });
  const foreign = await a.client.rpc('publish_post', { p_post: id2 });
  check(
    "clips must be the reel's own media",
    foreign.error?.message === 'bad_reel',
    foreign.error?.message,
  );
}

// ---- Visibility, files ----
{
  const dSeesB = rows(await d.client.from('posts').select('id').eq('id', bReel.id));
  check("D can't see B's private reel", dSeesB.length === 0);
  const cSeesB = rows(await c.client.from('posts').select('id').eq('id', bReel.id));
  check("C (approved follower) sees B's reel", cSeesB.length === 1);
  const dVo = await d.client.storage.from('posts').createSignedUrl(aReel.voPath, 60);
  check("D can read A's public voiceover file", !dVo.error, dVo.error?.message);
  const dCover = await d.client.storage
    .from('posts')
    .createSignedUrl(`${b.id}/${bReel.id}/cover.jpg`, 60);
  check("D can't read B's private cover", !!dCover.error);
}

// ---- Feed ----
{
  const feedOf = async (u) =>
    rows(await u.client.rpc('reels_feed', { p_limit: 30 })).map((r) => r.post_id);
  const dFeed = await feedOf(d);
  check("D's Reels feed recommends A's public reel", dFeed.includes(aReel.id));
  check("D's Reels feed never shows B's private reel", !dFeed.includes(bReel.id));
  const cFeed = await feedOf(c);
  check("C's Reels feed includes B's reel (follows)", cFeed.includes(bReel.id));
  const cRow = rows(await c.client.rpc('reels_feed', { p_limit: 30 })).find(
    (r) => r.post_id === aReel.id,
  );
  check('followed reels are marked "following"', cRow?.reason === 'following', cRow?.reason);
  await d.client.from('post_hides').insert({ post_id: aReel.id, reason: 'not_interested' });
  check('Not interested removes the reel from the feed', !(await feedOf(d)).includes(aReel.id));
  await d.client.from('post_hides').delete().eq('post_id', aReel.id);

  const cf = await makeReel(a, { extra: { audience: 'close_friends' } });
  check("D doesn't get A's Close Friends reel", !(await feedOf(d)).includes(cf.id));
  const posts = rows(await c.client.from('posts').select('id, kind').eq('author_id', a.id));
  check(
    'reels are posts (kind reel)',
    posts.every((p) => p.kind === 'reel'),
  );
}

// ---- Plays ----
{
  await d.client.rpc('record_reel_play', { p_post: aReel.id });
  await d.client.rpc('record_reel_play', { p_post: aReel.id });
  const card = rows(await a.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  check(
    'a play counts once (repeat within 5 s ignored)',
    card?.play_count === 1,
    String(card?.play_count),
  );
  await a.client.rpc('record_reel_play', { p_post: aReel.id });
  const again = rows(await a.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  check("own plays don't count", again?.play_count === 1, String(again?.play_count));
  await d.client.rpc('record_reel_play', { p_post: bReel.id });
  const bCard = rows(await b.client.rpc('post_cards', { p_ids: [bReel.id] }))[0];
  check(
    "plays on reels you can't see are ignored",
    bCard?.play_count === 0,
    String(bCard?.play_count),
  );
  const direct = await d.client.from('reel_plays').insert({ post_id: aReel.id });
  check("clients can't write reel_plays directly", !!direct.error);
  const mine = rows(await d.client.from('reel_plays').select('post_id'));
  check('reel_plays: you read only your own', mine.length === 1);

  await a.client.from('posts').update({ hide_like_counts: true }).eq('id', aReel.id);
  const masked = rows(await d.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  check('hidden counts mask plays for others', masked?.play_count === null);
  const own = rows(await a.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  check('the author still sees plays', own?.play_count === 1);
  await a.client.from('posts').update({ hide_like_counts: false }).eq('id', aReel.id);
  const grid = rows(await d.client.rpc('profile_posts', { p_user: a.id, p_kind: 'reels' }));
  check(
    'profile Reels tab lists the reels with plays',
    grid.some((g) => g.id === aReel.id && g.play_count === 1),
  );
  check(
    'profile Reels tab uses the reel cover',
    grid.find((g) => g.id === aReel.id)?.cover_path === aReel.coverPath,
  );
}

// ---- Original audio ----
let aTrack;
{
  const card = rows(await d.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  aTrack = card?.audio;
  check(
    'publishing a reel without music creates original audio',
    aTrack?.source === 'original' && aTrack.origin_post_id === aReel.id,
  );
  const photoOnly = await makeReel(a);
  const photoCard = rows(await a.client.rpc('post_cards', { p_ids: [photoOnly.id] }))[0];
  check('photo-only reels have no original audio', photoCard?.audio === null);

  const bCard = rows(await c.client.rpc('post_cards', { p_ids: [bReel.id] }))[0];
  const bTrack = bCard.audio.id;
  const dTrack = rows(await d.client.from('audio_tracks').select('id').eq('id', bTrack));
  check("D can't see B's private original audio", dTrack.length === 0);
  const dSave = await d.client.from('saved_audio').insert({ track_id: bTrack });
  check("D can't save audio they can't see", !!dSave.error);
  const cSave = await c.client.from('saved_audio').insert({ track_id: bTrack });
  check('C saves the audio of a reel they can see', !cSave.error, cSave.error?.message);

  const rename = await d.client.rpc('rename_original_audio', {
    p_track: aTrack.id,
    p_title: 'Mine now',
  });
  check("D can't rename A's audio", !!rename.error);
  const ok = await a.client.rpc('rename_original_audio', {
    p_track: aTrack.id,
    p_title: ' Beach vibes ',
  });
  check('A renames own original audio', ok.data === 'Beach vibes', ok.error?.message);
  const long = await a.client.rpc('rename_original_audio', {
    p_track: aTrack.id,
    p_title: 'x'.repeat(61),
  });
  check('audio names are ≤ 60 characters', !!long.error);
  const write = await a.client
    .from('audio_tracks')
    .update({ title: 'hack' })
    .eq('id', aTrack.id)
    .select();
  check("tracks can't be edited directly", rows(write).length === 0);

  // D uses A's original audio.
  const uses = await makeReel(d, { clips: ['video'], extra: { audio_track_id: aTrack.id } });
  check('D publishes a reel with A’s original audio', !uses.error, uses.error?.message);
  const usesCard = rows(await d.client.rpc('post_cards', { p_ids: [uses.id] }))[0];
  check('borrowed audio keeps its origin (no new original)', usesCard?.audio?.id === aTrack.id);
  const page = (await d.client.rpc('audio_page', { p_track: aTrack.id })).data;
  check(
    'audio page counts reels using the sound',
    page?.reel_count === 2,
    String(page?.reel_count),
  );
  check('audio page title follows the rename', page?.title === 'Beach vibes');
  const reels = rows(await d.client.rpc('audio_reels', { p_track: aTrack.id }));
  check(
    'audio grid lists the original reel first',
    reels[0]?.id === aReel.id && reels[0]?.is_origin,
  );

  const rep = await d.client
    .from('reports')
    .insert({ target_type: 'audio', target_id: aTrack.id, reason: 'intellectual_property' });
  check('D reports the audio', !rep.error, rep.error?.message);
  const selfRep = await a.client
    .from('reports')
    .insert({ target_type: 'audio', target_id: aTrack.id, reason: 'scam_spam' });
  check('cannot report your own audio', !!selfRep.error);
  const hidden = await d.client
    .from('reports')
    .insert({ target_type: 'audio', target_id: bCard.audio.id, reason: 'scam_spam' });
  check("cannot report audio you can't see", !!hidden.error);
}

// ---- Remix & linked reels ----
{
  const remix = await makeReel(d, { extra: { remix_of: aReel.id, remix_layout: 'side_by_side' } });
  check("D remixes A's public reel", !remix.error, remix.error?.message);
  const cardR = rows(await c.client.rpc('post_cards', { p_ids: [remix.id] }))[0];
  check(
    'remix card credits the original',
    cardR?.remix?.post_id === aReel.id && cardR.remix.username === a.username,
  );
  const remixes = rows(await c.client.rpc('reel_remixes', { p_post: aReel.id }));
  check(
    'View remixes lists it',
    remixes.some((r) => r.id === remix.id),
  );
  const aCard = rows(await c.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  check('original shows the remix count', aCard?.remix_count === 1);

  const priv = await makeReel(c, { extra: { remix_of: bReel.id, remix_layout: 'react' } });
  check(
    "private accounts' reels can't be remixed",
    priv.error?.message === 'remix_not_allowed',
    priv.error?.message,
  );
  const hiddenSrc = await makeReel(d, { extra: { remix_of: bReel.id, remix_layout: 'sequence' } });
  check(
    "can't remix a reel you can't see",
    hiddenSrc.error?.message === 'remix_source_not_found',
    hiddenSrc.error?.message,
  );
  const noLayout = await makeReel(d, { extra: { remix_of: aReel.id } });
  check('a remix needs a layout', noLayout.error?.message === 'bad_remix', noLayout.error?.message);
  const ownRemix = await makeReel(b, { extra: { remix_of: bReel.id, remix_layout: 'sequence' } });
  check('creators can remix their own private reel', !ownRemix.error, ownRemix.error?.message);

  await a.client.from('posts').update({ allow_remix: false }).eq('id', aReel.id);
  const off = await makeReel(c, { extra: { remix_of: aReel.id, remix_layout: 'react' } });
  check(
    'Allow remixing off blocks new remixes',
    off.error?.message === 'remix_not_allowed',
    off.error?.message,
  );
  const cCard = rows(await c.client.rpc('post_cards', { p_ids: [aReel.id] }))[0];
  check('card reports can_remix = false', cCard?.can_remix === false);
  await a.client.from('posts').update({ allow_remix: true }).eq('id', aReel.id);

  const link = await makeReel(a, { extra: { linked_reel_id: aReel.id } });
  check('A links a new reel to an own reel', !link.error, link.error?.message);
  const linkCard = rows(await d.client.rpc('post_cards', { p_ids: [link.id] }))[0];
  check('viewers get "Watch next part"', linkCard?.linked_reel_id === aReel.id);
  const foreignLink = await makeReel(d, { extra: { linked_reel_id: aReel.id } });
  check(
    "can't link someone else's reel",
    foreignLink.error?.message === 'linked_reel_not_found',
    foreignLink.error?.message,
  );

  // Original deleted: the remix stays, pointing at nothing ("Content unavailable").
  const temp = await makeReel(a);
  const r2 = await makeReel(d, { extra: { remix_of: temp.id, remix_layout: 'sequence' } });
  await a.client.from('posts').delete().eq('id', temp.id);
  const orphan = rows(await d.client.rpc('post_cards', { p_ids: [r2.id] }))[0];
  check(
    'deleting the original keeps the remix (original unavailable)',
    orphan?.remix?.layout === 'sequence' && orphan.remix.post_id === null,
  );
  const dUpd = await d.client
    .from('posts')
    .update({ allow_download: false })
    .eq('id', aReel.id)
    .select();
  check("D can't change A's reel settings", rows(dUpd).length === 0);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
