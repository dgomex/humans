// Phase 8 (Notifications / Activity) schema + RLS check against the LOCAL stack, with fresh users:
// A (public creator), B (private), C, D (actors), E (bystander).
// Usage: node scripts/test-activity-rls.mjs
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
  const email = `p8-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p8${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase8 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

async function makePost(
  user,
  caption,
  { tags = [], collaborators = [], audience = 'everyone' } = {},
) {
  const id = randomUUID();
  const mediaId = randomUUID();
  const ins = await user.client.from('posts').insert({ id, caption, audience, aspect_ratio: 1 });
  if (ins.error) throw ins.error;
  const path = `${user.id}/${id}/${mediaId}.jpg`;
  const up = await user.client.storage
    .from('posts')
    .upload(path, JPEG, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const m = await user.client.from('post_media').insert({
    id: mediaId,
    post_id: id,
    position: 0,
    type: 'image',
    path,
    width: 1080,
    height: 1080,
  });
  if (m.error) throw m.error;
  for (const t of tags) {
    const r = await user.client
      .from('post_tags')
      .insert({ post_id: id, media_id: mediaId, tagged_user_id: t, x: 0.5, y: 0.5 });
    if (r.error) throw r.error;
  }
  for (const cId of collaborators) {
    const r = await user.client.from('post_collaborators').insert({ post_id: id, user_id: cId });
    if (r.error) throw r.error;
  }
  const pub = await user.client.rpc('publish_post', { p_post: id });
  if (pub.error) throw pub.error;
  return { id, mediaId };
}

async function makeStory(user, { stickers = [], mentions = [] } = {}) {
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
  const up = await user.client.storage
    .from('stories')
    .upload(path, JPEG, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const pub = await user.client.rpc('publish_story', { p_story: id });
  if (pub.error) throw pub.error;
  return id;
}

const raw = async (user) =>
  rows(
    await user.client.from('notifications').select('*').order('created_at', { ascending: false }),
  );
const has = (list, type, actor, extra = {}) =>
  list.some(
    (n) =>
      n.type === type &&
      (!actor || n.actor_id === actor.id) &&
      Object.entries(extra).every(([k, v]) => n[k] === v),
  );
const feed = async (user, seen = null) => {
  const r = await user.client.rpc('activity_feed', {
    p_seen: seen,
    p_before: new Date(Date.now() + 1000).toISOString(),
    p_tz: 'Europe/Lisbon',
    p_offset: 0,
    p_limit: 100,
  });
  if (r.error) throw r.error;
  return r.data;
};

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');
const d = await makeUser('d');
const e = await makeUser('e');

// ---- Follows ----
await c.client.rpc('follow_user', { target: a.id });
await d.client.rpc('follow_user', { target: a.id });
let na = await raw(a);
check('follow → A notified by C and D', has(na, 'follow', c) && has(na, 'follow', d));
await d.client.rpc('unfollow_user', { target: a.id });
na = await raw(a);
check('unfollow retracts the follow notification', !has(na, 'follow', d) && has(na, 'follow', c));
await d.client.rpc('follow_user', { target: a.id });

// ---- Follow requests (private B) ----
await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);
await c.client.rpc('follow_user', { target: b.id });
await d.client.rpc('follow_user', { target: b.id });
const summary = rows(await b.client.rpc('follow_request_summary'))[0];
check('request summary: 2 pending, 2 avatars', summary?.total === 2 && summary.latest.length === 2);
const reqs = rows(await b.client.rpc('my_follow_requests', { p_search: null }));
check('my_follow_requests lists both requesters', reqs.length === 2);
const reqSearch = rows(
  await b.client.rpc('my_follow_requests', { p_search: c.username.slice(0, 7) }),
);
check(
  'my_follow_requests search filters',
  reqSearch.length >= 1 &&
    reqSearch.every((r) => r.id === c.id || r.username.startsWith(c.username.slice(0, 7))),
);
const cSummary = rows(await c.client.rpc('follow_request_summary'))[0];
check("C can't see B's requests", cSummary?.total === 0);
let badgeB = rows(await b.client.rpc('activity_badge'))[0];
check(
  'badge counts new requests',
  badgeB?.requests === 2 && badgeB.pending_requests === 2,
  JSON.stringify(badgeB),
);
await b.client.rpc('approve_follow_request', { requester: c.id });
const nc = await raw(c);
check('approve → requester gets follow_accepted', has(nc, 'follow_accepted', b));
check('approve → B gets "started following you"', has(await raw(b), 'follow', c));
const reqAfter = rows(await b.client.rpc('my_follow_requests', {}));
check('approved request leaves the list', reqAfter.length === 1 && reqAfter[0].id === d.id);
const reqFlags = rows(await b.client.rpc('my_follow_requests', {}))[0];
check(
  'request row has follow-back flags',
  reqFlags.i_follow === false && reqFlags.requested === false,
);
await d.client.rpc('unfollow_user', { target: b.id });
check(
  'cancelled request disappears',
  rows(await b.client.rpc('my_follow_requests', {})).length === 0,
);

// ---- Posts: likes, grouping, retract ----
const p1 = await makePost(a, `hello @${e.username}`);
await c.client.from('likes').insert({ post_id: p1.id });
await d.client.from('likes').insert({ post_id: p1.id });
await e.client.from('likes').insert({ post_id: p1.id });
na = await raw(a);
check(
  'likes → A notified 3×',
  na.filter((n) => n.type === 'post_like' && n.post_id === p1.id).length === 3,
);
check('caption mention → E notified', has(await raw(e), 'post_mention', a, { post_id: p1.id }));
let fa = await feed(a);
const likeGroup = fa.find((g) => g.type === 'post_like' && g.post?.id === p1.id);
check(
  'likes grouped into one row with 3 actors',
  likeGroup?.actor_count === 3 && likeGroup.actors.length === 2 && likeGroup.ids.length === 3,
  JSON.stringify(likeGroup?.actors),
);
check('grouped row has a post tile', !!likeGroup?.post?.cover_path);
const followGroup = fa.find((g) => g.type === 'follow');
check('follows grouped', followGroup?.actor_count === 2, String(followGroup?.actor_count));
check('follow row carries follow-back state', followGroup?.actor_follow?.i_follow === false);
await e.client.from('likes').delete().eq('post_id', p1.id);
check('unlike retracts', !has(await raw(a), 'post_like', e));
const selfLike = await a.client.from('likes').insert({ post_id: p1.id });
check('own like creates no notification', !selfLike.error && !has(await raw(a), 'post_like', a));

// ---- Comments, replies, mentions, comment likes ----
const c1 = await c.client
  .from('comments')
  .insert({ post_id: p1.id, body: `nice @${e.username}` })
  .select('id')
  .single();
check('comment inserted', !c1.error, c1.error?.message);
na = await raw(a);
check('comment → post author', has(na, 'comment', c, { comment_id: c1.data.id }));
check('comment mention → E', has(await raw(e), 'comment_mention', c, { comment_id: c1.data.id }));
const r1 = await d.client
  .from('comments')
  .insert({ post_id: p1.id, parent_id: c1.data.id, body: 'agreed' })
  .select('id')
  .single();
check(
  'reply → parent writer gets comment_reply',
  has(await raw(c), 'comment_reply', d, { comment_id: r1.data.id }),
);
check(
  'reply → post author gets comment',
  has(await raw(a), 'comment', d, { comment_id: r1.data.id }),
);
const r2 = await a.client
  .from('comments')
  .insert({ post_id: p1.id, parent_id: c1.data.id, body: `thanks @${c.username}` })
  .select('id')
  .single();
const ncr = (await raw(c)).filter((n) => n.comment_id === r2.data.id);
check(
  'reply that also mentions → only one notification',
  ncr.length === 1 && ncr[0].type === 'comment_reply',
  ncr.map((n) => n.type).join(),
);
await a.client.from('comment_likes').insert({ comment_id: c1.data.id });
check('comment like → writer', has(await raw(c), 'comment_like', a, { comment_id: c1.data.id }));
const fc = await feed(c);
const cl = fc.find((g) => g.type === 'comment_like');
check('comment like row carries the comment body', cl?.comment?.body?.startsWith('nice'));
await a.client.from('comment_likes').delete().eq('comment_id', c1.data.id);
check('comment unlike retracts', !has(await raw(c), 'comment_like', a));
fa = await feed(a);
const commentRow = fa.find((g) => g.type === 'comment' && g.comment?.id === c1.data.id);
check('comment row has liked=false for viewer', commentRow?.comment?.liked === false);
await c.client.from('comments').delete().eq('id', c1.data.id);
na = await raw(a);
check(
  'deleting a comment removes its notifications',
  !na.some((n) => n.comment_id === c1.data.id || n.comment_id === r1.data.id),
);

// ---- Tags and collaborators ----
const p2 = await makePost(a, 'collab', { tags: [c.id], collaborators: [d.id] });
check('tag on publish → C', has(await raw(c), 'post_tag', a, { post_id: p2.id }));
check('collab invite on publish → D', has(await raw(d), 'collab_invite', a, { post_id: p2.id }));
const fd = await feed(d);
check(
  'collab row status pending',
  fd.find((g) => g.type === 'collab_invite')?.collab_status === 'pending',
);
await d.client.rpc('respond_collab_invite', { p_post: p2.id, p_accept: true });
check(
  'accept → author gets collab_accepted',
  has(await raw(a), 'collab_accepted', d, { post_id: p2.id }),
);
await e.client.from('likes').insert({ post_id: p2.id });
check(
  'like on collab post reaches the collaborator too',
  has(await raw(d), 'post_like', e, { post_id: p2.id }),
);
const p3 = await makePost(a, 'declined', { collaborators: [c.id] });
await c.client.rpc('respond_collab_invite', { p_post: p3.id, p_accept: false });
check('decline removes the invite', !has(await raw(c), 'collab_invite', a, { post_id: p3.id }));
await a.client.from('post_tags').delete().eq('post_id', p2.id).eq('tagged_user_id', c.id);
check('untag retracts', !has(await raw(c), 'post_tag', a, { post_id: p2.id }));

// ---- Caption edit removes mention ----
await a.client.from('posts').update({ caption: 'no mentions' }).eq('id', p1.id);
check(
  'caption edit removes the mention',
  !has(await raw(e), 'post_mention', a, { post_id: p1.id }),
);

// ---- Reposts ----
await c.client.from('reposts').insert({ post_id: p1.id });
check('repost → author', has(await raw(a), 'repost', c, { post_id: p1.id }));
await c.client.from('reposts').delete().eq('post_id', p1.id);
check('undo repost retracts', !has(await raw(a), 'repost', c));

// ---- Bell ----
await c.client
  .from('profile_notification_prefs')
  .upsert({ target_id: a.id, posts: true, stories: true });
const p4 = await makePost(a, 'bell');
check('bell post → C', has(await raw(c), 'bell_post', a, { post_id: p4.id }));
check('no bell for E (no pref)', !has(await raw(e), 'bell_post', a));
// Close Friends post: bell row exists, but C can't see the post → hidden from C's feed.
const p5 = await makePost(a, 'cf only', { audience: 'close_friends' });
const fc2 = await feed(c);
check('bell for an invisible post is hidden in the feed', !fc2.some((g) => g.post?.id === p5.id));

// ---- Stories: mention, like, bell, add yours, countdown ----
const rootSticker = randomUUID();
const s1 = await makeStory(a, {
  mentions: [e.id],
  stickers: [
    { id: rootSticker, type: 'add_yours', data: { prompt: 'Your pet' }, chain_id: rootSticker },
  ],
});
check('story mention → E', has(await raw(e), 'story_mention', a, { story_id: s1 }));
check('bell story → C', has(await raw(c), 'bell_story', a, { story_id: s1 }));
await c.client.from('story_likes').insert({ story_id: s1 });
check('story like → A', has(await raw(a), 'story_like', c, { story_id: s1 }));
await c.client.from('story_likes').delete().eq('story_id', s1);
check('story unlike retracts', !has(await raw(a), 'story_like', c));
const s2 = await makeStory(d, {
  stickers: [{ type: 'add_yours', data: { prompt: 'Your pet' }, chain_id: rootSticker }],
});
check(
  'Add yours participation → chain starter',
  has(await raw(a), 'add_yours', d, { story_id: s2 }),
);
const cd = randomUUID();
await makeStory(a, {
  stickers: [
    {
      id: cd,
      type: 'countdown',
      data: { title: 'Launch', ends_at: new Date(Date.now() + 4_000).toISOString() },
    },
  ],
});
const rem = await c.client.from('story_sticker_responses').insert({ sticker_id: cd });
check('reminder set', !rem.error, rem.error?.message);
await c.client.rpc('activity_badge');
check('no countdown notification before it ends', !has(await raw(c), 'countdown_ended', a));
await new Promise((r) => setTimeout(r, 5_000));
await c.client.rpc('activity_badge');
check('ended countdown → notification after badge sync', has(await raw(c), 'countdown_ended', a));
const fc3 = await feed(c);
check(
  'countdown row carries the title',
  fc3.find((g) => g.type === 'countdown_ended')?.data?.title === 'Launch',
);

// ---- Visibility / RLS ----
const peek = await e.client.from('notifications').select('id').eq('recipient_id', a.id);
check("E can't read A's notifications", rows(peek).length === 0);
const forge = await e.client
  .from('notifications')
  .insert({ recipient_id: a.id, actor_id: e.id, type: 'follow' });
check("clients can't insert notifications", !!forge.error);
const someA = (await raw(a))[0];
const upd = await a.client
  .from('notifications')
  .update({ type: 'follow' })
  .eq('id', someA.id)
  .select();
check("clients can't update notifications", !!upd.error || rows(upd).length === 0);
const delOther = await e.client.from('notifications').delete().eq('id', someA.id).select();
check("E can't delete A's notification", rows(delOther).length === 0);
const preview = rows(await a.client.rpc('notification_preview', { p_id: someA.id }))[0];
check('notification_preview for the recipient', preview?.id === someA.id);
const previewE = rows(await e.client.rpc('notification_preview', { p_id: someA.id }));
check('notification_preview hidden from others', previewE.length === 0);
const anon = createClient(url, key, opts);
const anonFeed = await anon.rpc('activity_feed', {
  p_seen: null,
  p_before: new Date().toISOString(),
});
check('anon blocked from activity_feed', !!anonFeed.error);

// ---- Seen state + sections ----
const prev = await a.client.rpc('mark_activity_seen');
check('first mark_activity_seen returns -infinity', prev.data === '-infinity', String(prev.data));
const badgeA = rows(await a.client.rpc('activity_badge'))[0];
check('badge resets after seen', badgeA?.unseen === 0, JSON.stringify(badgeA));
const seenAt = new Date().toISOString();
await new Promise((r) => setTimeout(r, 50));
await e.client.from('likes').insert({ post_id: p4.id });
const badgeA2 = rows(await a.client.rpc('activity_badge'))[0];
check(
  'new like → badge likes = 1',
  badgeA2?.likes === 1 && badgeA2.unseen === 1,
  JSON.stringify(badgeA2),
);
const fa2 = await feed(a, seenAt);
check('newest like lands in New', fa2[0]?.section === 'new' && fa2[0].type === 'post_like');
check(
  'older rows are Today',
  fa2.slice(1).every((g) => g.section === 'today'),
);
const pageTwo = await a.client.rpc('activity_feed', {
  p_seen: seenAt,
  p_before: new Date(Date.now() + 1000).toISOString(),
  p_offset: 2,
  p_limit: 2,
});
check(
  'paging returns the next groups',
  rows(pageTwo).length === 2 && rows(pageTwo)[0].group_key === fa2[2].group_key,
);

// ---- Delete a notification ----
const del = await a.client.from('notifications').delete().in('id', fa2[0].ids).select();
check('recipient deletes a grouped row', rows(del).length === fa2[0].ids.length);

// ---- Post deleted → notifications gone ----
await a.client.from('posts').delete().eq('id', p4.id);
check('post deletion removes its notifications', !(await raw(c)).some((n) => n.post_id === p4.id));

// ---- Suggestions + dismissals ----
const sugE = rows(await e.client.rpc('suggested_accounts', { max_count: 100 }));
check('suggestions exclude self and followed', !sugE.some((s) => s.id === e.id));
await a.client.rpc('follow_user', { target: e.id });
const sugE2 = rows(await e.client.rpc('suggested_accounts', { max_count: 100 }));
const aRow = sugE2.find((s) => s.id === a.id);
check(
  '"follows you" ranks first',
  sugE2[0]?.id === a.id && aRow?.reason === 'follows_you' && aRow.follows_me,
);
await e.client.rpc('follow_user', { target: c.id });
const sugE3 = rows(await e.client.rpc('suggested_accounts', { max_count: 100 }));
const viaRow = sugE3.find((s) => s.id === b.id);
check(
  'friend-of-friend has mutual reason',
  viaRow?.reason === 'mutual' && viaRow.mutual_username === c.username,
  JSON.stringify(viaRow),
);
const dis = await e.client.from('suggestion_dismissals').insert({ target_id: a.id });
check('dismiss inserted', !dis.error, dis.error?.message);
const sugE4 = rows(await e.client.rpc('suggested_accounts', { max_count: 100 }));
check('dismissed account no longer suggested', !sugE4.some((s) => s.id === a.id));
const disForge = await e.client
  .from('suggestion_dismissals')
  .insert({ user_id: a.id, target_id: c.id });
check("can't dismiss for someone else", !!disForge.error);
const disPeek = await a.client.from('suggestion_dismissals').select('*').eq('user_id', e.id);
check('dismissals are private', rows(disPeek).length === 0);
const pageS = rows(await e.client.rpc('suggested_accounts', { max_count: 1, p_offset: 1 }));
check(
  'suggestions page with offset',
  pageS.length <= 1 && (sugE4.length < 2 || pageS[0]?.id === sugE4[1].id),
);

// ---- Reserved names ----
const reserved = await e.client.rpc('username_available', { name: 'activity' });
check('"activity" is reserved', reserved.data === false, JSON.stringify(reserved));

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
