// Phase 4 (Feed & interactions) schema + RLS check against the LOCAL stack, with four fresh users:
// A (public author), B (private author), C (follows A and B), D (follows nobody).
// Usage: node scripts/test-feed-rls.mjs
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
  const email = `p4-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p4${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase4 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

/** Create a post with `n` image slides; publish unless told not to. Returns { id, media }. */
async function makePost(user, { caption = '', audience = 'everyone', n = 1, publish = true } = {}) {
  const id = randomUUID();
  const ins = await user.client.from('posts').insert({ id, caption, audience, aspect_ratio: 0.8 });
  if (ins.error) throw ins.error;
  const media = [];
  for (let i = 0; i < n; i++) {
    const path = `${user.id}/${id}/${i}.jpg`;
    const up = await user.client.storage
      .from('posts')
      .upload(path, JPEG, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const m = await user.client
      .from('post_media')
      .insert({ post_id: id, position: i, type: 'image', path, width: 1080, height: 1350 })
      .select()
      .single();
    if (m.error) throw m.error;
    media.push(m.data);
  }
  if (publish) {
    const pub = await user.client.rpc('publish_post', { p_post: id });
    if (pub.error) throw pub.error;
  }
  return { id, media };
}

const grid = async (viewer, owner, kind = 'grid') =>
  (await viewer.client.rpc('profile_posts', { p_user: owner.id, p_kind: kind })).data ?? [];
const card = async (viewer, id) =>
  ((await viewer.client.rpc('post_cards', { p_ids: [id] })).data ?? [])[0] ?? null;
const home = async (viewer) =>
  (await viewer.client.rpc('home_feed', { p_limit: 30 })).data?.map((r) => r.post_id) ?? [];
const suggested = async (viewer) =>
  (await viewer.client.rpc('suggested_posts', { p_limit: 30 })).data?.map((r) => r.post_id) ?? [];
const chrono = async (viewer, kind) =>
  (await viewer.client.rpc('following_feed', { p_kind: kind, p_limit: 30 })).data?.map(
    (r) => r.post_id,
  ) ?? [];
const comments = async (viewer, postId, kind = 'top') =>
  (await viewer.client.rpc('post_comments', { p_post: postId, p_kind: kind })).data ?? [];
const rows = (res) => res.data ?? [];

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');
const d = await makeUser('d');
await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);
await c.client.rpc('follow_user', { target: a.id });
await c.client.rpc('follow_user', { target: b.id });
await b.client.rpc('approve_follow_request', { requester: c.id });

const pa = await makePost(a, { caption: 'Public post #sun', n: 2 });
const pb = await makePost(b, { caption: 'Private post' });
const pcf = await makePost(a, { caption: 'Close friends only', audience: 'close_friends' });

// ---- Likes ----
{
  const cLike = await c.client.from('likes').insert({ post_id: pa.id });
  check('C likes A post', !cLike.error, cLike.error?.message);
  check("D cannot like B's private post", !!(await d.client.from('likes').insert({ post_id: pb.id })).error);
  const cLikeB = await c.client.from('likes').insert({ post_id: pb.id });
  check("C (approved follower) likes B's post", !cLikeB.error, cLikeB.error?.message);
  check('double like rejected', !!(await c.client.from('likes').insert({ post_id: pa.id })).error);
  const forged = await d.client.from('likes').insert({ post_id: pa.id, user_id: c.id });
  check('D cannot like as C', !!forged.error);
  check('A card like_count = 1', (await card(a, pa.id))?.like_count === 1);
  check('C card liked = true', (await card(c, pa.id))?.liked === true);
  const dLikesB = await d.client.from('likes').select('user_id').eq('post_id', pb.id);
  check("D can't list likers of B's post", rows(dLikesB).length === 0);
  const likers = rows(await d.client.rpc('post_likers', { p_post: pa.id }));
  check('D sees C in likers of A post', likers.some((l) => l.id === c.id));
  await a.client.from('posts').update({ hide_like_counts: true }).eq('id', pa.id);
  check('hidden like count: D sees null', (await card(d, pa.id))?.like_count === null);
  check('hidden like count: author still sees 1', (await card(a, pa.id))?.like_count === 1);
  await a.client.from('posts').update({ hide_like_counts: false }).eq('id', pa.id);
  const delOther = await d.client
    .from('likes')
    .delete()
    .eq('post_id', pa.id)
    .eq('user_id', c.id)
    .select();
  check("D cannot remove C's like", rows(delOther).length === 0);
  const forgeCount = await c.client.from('posts').update({ like_count: 999 }).eq('id', pa.id);
  check('client cannot write like_count', !!forgeCount.error);
}

// ---- Comments ----
{
  const top = await c.client
    .from('comments')
    .insert({ post_id: pa.id, body: 'Nice!' })
    .select()
    .single();
  check('C comments on A post', !top.error, top.error?.message);
  const parentId = top.data?.id;
  const reply = await d.client
    .from('comments')
    .insert({ post_id: pa.id, parent_id: parentId, body: '@x agreed' })
    .select()
    .single();
  check('D replies', !reply.error, reply.error?.message);
  const nested = await a.client
    .from('comments')
    .insert({ post_id: pa.id, parent_id: reply.data?.id, body: 'thanks' })
    .select()
    .single();
  check('reply to a reply joins the parent thread', nested.data?.parent_id === parentId);
  check('comment_count = 3', (await card(d, pa.id))?.comment_count === 3);
  const parent = (await comments(d, pa.id)).find((x) => x.id === parentId);
  check('reply_count = 2', parent?.reply_count === 2);
  const replies = rows(
    await d.client.rpc('post_comments', { p_post: pa.id, p_kind: 'replies', p_parent: parentId }),
  );
  check('replies listed oldest first', replies[0]?.id === reply.data?.id && replies.length === 2);
  const tooMany = await c.client
    .from('comments')
    .insert({ post_id: pa.id, body: '@a @b @c @d @e @f' });
  check('more than 5 mentions rejected', !!tooMany.error);
  const empty = await c.client.from('comments').insert({ post_id: pa.id, body: '   ' });
  check('empty comment rejected', !!empty.error);
  const dOnB = await d.client.from('comments').insert({ post_id: pb.id, body: 'hi' });
  check("D cannot comment on B's private post", !!dOnB.error);
  const edit = await c.client.from('comments').update({ body: 'edited' }).eq('id', parentId);
  check('comments cannot be edited', !!edit.error);

  const cl = await a.client.from('comment_likes').insert({ comment_id: parentId });
  check('A likes C comment', !cl.error, cl.error?.message);
  const row = (await comments(d, pa.id)).find((x) => x.id === parentId);
  check('comment like_count 1 + liked by author', row?.like_count === 1 && row?.liked_by_post_author);
  const cLikers = rows(await d.client.rpc('comment_likers', { p_comment: parentId }));
  check('comment likers lists A', cLikers.some((u) => u.id === a.id));

  const cPin = await c.client.rpc('set_comment_pinned', { p_comment: parentId, p_pinned: true });
  check('C (not post author) cannot pin', !!cPin.error);
  const aPin = await a.client.rpc('set_comment_pinned', { p_comment: parentId, p_pinned: true });
  check('A pins C comment', !aPin.error, aPin.error?.message);
  const replyPin = await a.client.rpc('set_comment_pinned', {
    p_comment: reply.data?.id,
    p_pinned: true,
  });
  check('replies cannot be pinned', replyPin.error?.message === 'cannot_pin');
  for (let i = 0; i < 3; i++) {
    const x = await d.client
      .from('comments')
      .insert({ post_id: pa.id, body: `c${i}` })
      .select()
      .single();
    const r = await a.client.rpc('set_comment_pinned', { p_comment: x.data.id, p_pinned: true });
    if (i < 2) check(`pin #${i + 2} ok`, !r.error, r.error?.message);
    else check('4th pin rejected', r.error?.message === 'pin_limit');
  }
  const first = (await comments(d, pa.id))[0];
  check('first pinned comment listed first', first?.id === parentId && first?.is_pinned);

  const rude = await d.client
    .from('comments')
    .insert({ post_id: pa.id, body: 'rude' })
    .select()
    .single();
  const hide = await a.client.rpc('set_comment_hidden', { p_comment: rude.data.id, p_hidden: true });
  check('A hides D comment', !hide.error, hide.error?.message);
  check('C no longer sees it', !(await comments(c, pa.id)).some((x) => x.id === rude.data.id));
  check('D still sees own hidden comment', (await comments(d, pa.id)).some((x) => x.id === rude.data.id));
  check('A sees it under hidden', (await comments(a, pa.id, 'hidden')).some((x) => x.id === rude.data.id));
  check('C cannot list hidden comments', (await comments(c, pa.id, 'hidden')).length === 0);

  const dDelC = await d.client.from('comments').delete().eq('id', parentId).select();
  check("D cannot delete C's comment", rows(dDelC).length === 0);
  const aDel = await a.client.from('comments').delete().eq('id', parentId).select();
  check('post author deletes C comment', rows(aDel).length === 1);
  const left = await a.client.from('comments').select('id').eq('parent_id', parentId);
  check('its replies are gone', rows(left).length === 0);
  check('comment_count back to 4', (await card(a, pa.id))?.comment_count === 4);

  await a.client.from('posts').update({ comments_disabled: true }).eq('id', pa.id);
  const off = await c.client.from('comments').insert({ post_id: pa.id, body: 'still?' });
  check('commenting off blocks new comments', !!off.error);
  await a.client.from('posts').update({ comments_disabled: false }).eq('id', pa.id);
}

// ---- Saves + collections ----
{
  const save = await d.client.from('saves').insert({ post_id: pa.id });
  check('D saves A post', !save.error, save.error?.message);
  check("D cannot save B's private post", !!(await d.client.from('saves').insert({ post_id: pb.id })).error);
  const peek = await a.client.from('saves').select('user_id').eq('post_id', pa.id);
  check('A cannot see who saved', rows(peek).length === 0);
  const coll = await d.client.from('saved_collections').insert({ name: 'Trips' }).select().single();
  const item = await d.client
    .from('saved_collection_items')
    .insert({ collection_id: coll.data.id, post_id: pa.id });
  check('D adds to a collection', !item.error, item.error?.message);
  check('saved_posts(All) lists it', rows(await d.client.rpc('saved_posts', {})).some((p) => p.id === pa.id));
  const inColl = rows(await d.client.rpc('saved_posts', { p_collection: coll.data.id }));
  check('saved_posts(collection) lists it', inColl.some((p) => p.id === pa.id));
  const cItem = await c.client
    .from('saved_collection_items')
    .insert({ collection_id: coll.data.id, post_id: pa.id });
  check("C cannot add to D's collection", !!cItem.error);
  await d.client.from('saves').delete().eq('post_id', pa.id);
  const after = await d.client
    .from('saved_collection_items')
    .select('post_id')
    .eq('collection_id', coll.data.id);
  check('unsave removes it from collections', rows(after).length === 0);
  const via = await d.client
    .from('saved_collection_items')
    .insert({ collection_id: coll.data.id, post_id: pa.id });
  check('adding to a collection re-saves', !via.error && (await card(d, pa.id))?.saved === true);
}

// ---- Reposts ----
{
  const r = await d.client.from('reposts').insert({ post_id: pa.id, note: 'Love this' });
  check('D reposts A public post', !r.error, r.error?.message);
  check('A cannot repost own post', !!(await a.client.from('reposts').insert({ post_id: pa.id })).error);
  check(
    'private account posts cannot be reposted',
    !!(await c.client.from('reposts').insert({ post_id: pb.id })).error,
  );
  await a.client.from('close_friends').insert({ friend_id: c.id });
  check(
    'close-friends posts cannot be reposted',
    !!(await c.client.from('reposts').insert({ post_id: pcf.id })).error,
  );
  const longNote = await c.client.from('reposts').insert({ post_id: pa.id, note: 'x'.repeat(61) });
  check('repost note > 60 rejected', !!longNote.error);
  check('repost_count = 1', (await card(a, pa.id))?.repost_count === 1);
  check("D's Reposts tab lists it", (await grid(c, d, 'reposts')).some((p) => p.id === pa.id));
  await c.client.rpc('follow_user', { target: d.id });
  const cHome = rows(await c.client.rpc('home_feed', { p_limit: 30 }));
  check('followed author wins over repost', cHome.find((x) => x.post_id === pa.id)?.reason === 'following');
  await a.client.rpc('follow_user', { target: d.id });
  const aHome = rows(await a.client.rpc('home_feed', { p_limit: 30 }));
  check("own post isn't shown as someone's repost", aHome.find((x) => x.post_id === pa.id)?.reason === 'own');
  const x = await makeUser('x');
  await x.client.rpc('follow_user', { target: d.id });
  const xHome = rows(await x.client.rpc('home_feed', { p_limit: 30 }));
  const item = xHome.find((i) => i.post_id === pa.id);
  check('repost reaches followers of the reposter', item?.reason === 'repost' && item?.reposted_by_id === d.id);
  check('repost carries the note', item?.repost_note === 'Love this');
  await d.client.from('reposts').delete().eq('post_id', pa.id);
  check('undo repost', (await grid(c, d, 'reposts')).length === 0);
}

// ---- Feeds ----
{
  const cHome = await home(c);
  check('C home has A public post', cHome.includes(pa.id));
  check("C home has B's private post (approved)", cHome.includes(pb.id));
  check('C (now close friend) home has A CF post', cHome.includes(pcf.id));
  await a.client.from('close_friends').delete().eq('friend_id', c.id);
  check('C (not CF) home lacks A CF post', !(await home(c)).includes(pcf.id));
  check('D home lacks A post (not following)', !(await home(d)).includes(pa.id));
  const dSug = await suggested(d);
  check('D suggested has A public post', dSug.includes(pa.id));
  check("D suggested lacks B's private post", !dSug.includes(pb.id));
  check('D suggested lacks A CF post', !dSug.includes(pcf.id));
  check('C suggested lacks followed A', !(await suggested(c)).includes(pa.id));
  check('A home shows own post', (await home(a)).includes(pa.id));

  const following = await chrono(c, 'following');
  check('C Following feed has A + B', following.includes(pa.id) && following.includes(pb.id));
  check('C Favorites feed empty', (await chrono(c, 'favorites')).length === 0);
  await c.client.from('favorites').insert({ favorite_id: a.id });
  const fav = await chrono(c, 'favorites');
  check('C Favorites feed = A only', fav.includes(pa.id) && !fav.includes(pb.id));
  const favHome = rows(await c.client.rpc('home_feed', { p_limit: 30 }));
  check('home reason = favorite', favHome.find((r) => r.post_id === pa.id)?.reason === 'favorite');
  const page1 = rows(await c.client.rpc('following_feed', { p_kind: 'following', p_limit: 1 }));
  const page2 = rows(
    await c.client.rpc('following_feed', {
      p_kind: 'following',
      p_limit: 1,
      p_before: page1[0]?.published_at,
      p_before_id: page1[0]?.post_id,
    }),
  );
  check('Following feed keyset paging', page2.length === 1 && page2[0].post_id !== page1[0].post_id);

  await c.client.from('post_hides').insert({ post_id: pb.id, reason: 'hidden' });
  check('hidden post leaves C home', !(await home(c)).includes(pb.id));
  check('…and the Following feed', !(await chrono(c, 'following')).includes(pb.id));
  await c.client.from('post_hides').delete().eq('post_id', pb.id);
  check('undo hide brings it back', (await home(c)).includes(pb.id));
  const dPeek = await d.client.from('post_hides').select('*').eq('user_id', c.id);
  check("D cannot read C's hides", rows(dPeek).length === 0);
  await d.client.from('post_hides').insert({ post_id: pa.id, reason: 'not_interested' });
  check('Not interested removes it from suggestions', !(await suggested(d)).includes(pa.id));
  await d.client.from('post_hides').delete().eq('post_id', pa.id);

  const seen = await c.client.rpc('mark_posts_seen', { p_ids: [pa.id, pb.id] });
  check('mark_posts_seen ok', !seen.error, seen.error?.message);
  await d.client.rpc('mark_posts_seen', { p_ids: [pb.id] });
  check('seen ignores posts D cannot view', rows(await d.client.from('post_seen').select('post_id')).length === 0);
  check("D cannot read C's seen rows", rows(await d.client.from('post_seen').select('*').eq('user_id', c.id)).length === 0);
}

// ---- Cards ----
{
  check("D gets no card for B's private post", (await card(d, pb.id)) === null);
  const cCard = await card(c, pa.id);
  check('card has 2 media + author', cCard?.media.length === 2 && cCard?.author.username === a.username);
  check('card i_follow_author + favorite', cCard?.i_follow_author && cCard?.is_favorite_author);
  check('can_repost true for C on A public post', cCard?.can_repost === true);
  check('can_repost false on own post', (await card(a, pa.id))?.can_repost === false);
  await d.client.rpc('follow_user', { target: c.id });
  check('liked_by = a liker D follows', (await card(d, pa.id))?.liked_by?.username === c.username);
}

// ---- Reports ----
{
  const r = await d.client
    .from('reports')
    .insert({ target_type: 'post', target_id: pa.id, reason: 'scam_spam', sub_reason: 'spam' });
  check('D reports A post', !r.error, r.error?.message);
  check('reported post leaves D suggestions', !(await suggested(d)).includes(pa.id));
  const again = await d.client
    .from('reports')
    .upsert(
      { target_type: 'post', target_id: pa.id, reason: 'nudity' },
      { onConflict: 'reporter_id,target_type,target_id', ignoreDuplicates: true },
    );
  check('repeat report silently accepted', !again.error, again.error?.message);
  const self = await a.client
    .from('reports')
    .insert({ target_type: 'post', target_id: pa.id, reason: 'scam_spam' });
  check('cannot report own post', self.error?.message === 'cannot_report_self');
  const unseen = await d.client
    .from('reports')
    .insert({ target_type: 'post', target_id: pb.id, reason: 'scam_spam' });
  check("D cannot report B's post it can't see", !!unseen.error);
  const bad = await c.client
    .from('reports')
    .insert({ target_type: 'post', target_id: pa.id, reason: 'boring' });
  check('unknown reason rejected', !!bad.error);
  check("A cannot read D's report", rows(await a.client.from('reports').select('*')).length === 0);
  check('D reads own report', rows(await d.client.from('reports').select('*')).length === 1);
  const forge = await d.client.from('reports').update({ status: 'dismissed' }).eq('target_id', pa.id);
  check('reporter cannot change status', !!forge.error);
  const prof = await c.client
    .from('reports')
    .insert({ target_type: 'profile', target_id: d.id, reason: 'bullying' });
  check('profile report ok', !prof.error, prof.error?.message);
}

// ---- Deleting a post cascades every interaction ----
{
  await a.client.from('posts').delete().eq('id', pa.id);
  const likes = await c.client.from('likes').select('post_id').eq('post_id', pa.id);
  check('likes removed with the post', rows(likes).length === 0);
  const cm = await d.client.from('comments').select('id').eq('post_id', pa.id);
  check('comments removed with the post', rows(cm).length === 0);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

