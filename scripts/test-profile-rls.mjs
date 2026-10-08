// Phase 2 (Profile) schema + RLS check against the LOCAL stack, with three fresh users:
// A (public), B (private), C (public, follows nobody).
// Usage: node scripts/test-profile-rls.mjs
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
  const email = `p2-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p2${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase2 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const profile = async (viewer, target) =>
  (await viewer.client.rpc('get_profile', { p_user_id: target.id })).data?.[0];
const list = async (viewer, target, kind, search = '') =>
  (
    await viewer.client.rpc('profile_connections', {
      p_user_id: target.id,
      p_kind: kind,
      p_search: search,
    })
  ).data ?? [];

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');

// Profile fields
{
  const ok = await a.client
    .from('profiles')
    .update({ bio: 'Hello #world', links: [{ url: 'https://example.com', title: 'Site' }] })
    .eq('id', a.id);
  check('A edits own bio + links', !ok.error, ok.error?.message);
  const tooLong = await a.client
    .from('profiles')
    .update({ bio: 'x'.repeat(151) })
    .eq('id', a.id);
  check('bio over 150 chars rejected', !!tooLong.error);
  const badLink = await a.client
    .from('profiles')
    .update({ links: [{ url: 'javascript:alert(1)' }] })
    .eq('id', a.id);
  check('non-http link rejected', !!badLink.error);
  const sixLinks = await a.client
    .from('profiles')
    .update({ links: Array.from({ length: 6 }, (_, i) => ({ url: `https://x${i}.com` })) })
    .eq('id', a.id);
  check('6 links rejected', !!sixLinks.error);
  const counter = await a.client.from('profiles').update({ followers_count: 999 }).eq('id', a.id);
  check('client cannot set counters', !!counter.error);
  const other = await b.client.from('profiles').update({ bio: 'hacked' }).eq('id', a.id).select();
  check("B cannot edit A's profile", !other.error && other.data.length === 0);
}

// B goes private
{
  const r = await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);
  check('B switches to private', !r.error, r.error?.message);
}

// Follow public / request private
{
  const r1 = await c.client.rpc('follow_user', { target: a.id });
  check('C follows public A → following', r1.data === 'following', r1.error?.message);
  const direct = await a.client.from('follows').insert({ follower_id: a.id, following_id: b.id });
  check('direct insert into follows of private B rejected', !!direct.error);
  const r2 = await a.client.rpc('follow_user', { target: b.id });
  check('A follows private B → requested', r2.data === 'requested', r2.error?.message);
  const pa = await profile(a, b);
  check('A sees B as requested, cannot view', pa?.requested === true && pa?.can_view === false);
  check('B counters visible to A', pa?.followers_count === 0 && pa?.following_count === 0);
  const cReq = await c.client.from('follow_requests').select('*');
  check('C cannot see A→B request', cReq.data?.length === 0);
}

// Private lists hidden
{
  await b.client.rpc('follow_user', { target: c.id }); // B follows C (public)
  const bFollowingAsA = await list(a, b, 'following');
  check("A cannot list private B's following", bFollowingAsA.length === 0);
  const bFollowingAsB = await list(b, b, 'following');
  check('B lists own following', bFollowingAsB.length === 1);
  const hl = await b.client.from('highlights').insert({ title: 'Trips' }).select().single();
  check('B creates a highlight', !hl.error, hl.error?.message);
  const hlAsA = await a.client.from('highlights').select('*').eq('owner_id', b.id);
  check("A cannot read private B's highlights", hlAsA.data?.length === 0);
  const hlAsC = await c.client.from('highlights').select('*').eq('owner_id', b.id);
  check("C (not B's follower) cannot read B's highlights", hlAsC.data?.length === 0);
}

// Approve, then visible
{
  const r = await b.client.rpc('approve_follow_request', { requester: a.id });
  check('B approves A', r.data === true, r.error?.message);
  const pa = await profile(a, b);
  check(
    'A can now view B, follower count 1',
    pa?.can_view && pa?.i_follow && pa?.followers_count === 1,
  );
  check("A lists private B's following", (await list(a, b, 'following')).length === 1);
  const hlAsA = await a.client.from('highlights').select('*').eq('owner_id', b.id);
  check("A reads B's highlights", hlAsA.data?.length === 1);
}

// Mutuals: A follows C? A follows B; B follows C. For C viewing B's mutual: C follows nobody but A.
{
  // C follows A already. A follows B → for C, B is "followed by A" (mutual).
  const pc = await profile(c, b);
  check('C sees "Followed by A" on B', pc?.mutual_count === 1, JSON.stringify(pc?.mutual_preview));
  const m = await list(c, b, 'mutual');
  check('C mutual list of B = [A]', m.length === 1 && m[0].id === a.id);
  const s = await list(a, a, 'followers', c.username.slice(0, 5));
  check('search followers by username', s.length === 1 && s[0].id === c.id);
}

// Remove follower / unfollow / counters
{
  const rm = await a.client
    .from('follows')
    .delete()
    .eq('follower_id', c.id)
    .eq('following_id', a.id);
  check('A removes follower C', !rm.error);
  const pa = await profile(a, a);
  check('A follower count back to 0', pa?.followers_count === 0, String(pa?.followers_count));
  await c.client.rpc('follow_user', { target: b.id });
  const cancel = await c.client.rpc('unfollow_user', { target: b.id });
  const pc = await profile(c, b);
  check('C cancels request to B', !cancel.error && pc?.requested === false);
}

// Close friends / favorites are private to the owner
{
  const cf = await a.client.from('close_friends').insert({ friend_id: b.id });
  check('A adds B to close friends', !cf.error, cf.error?.message);
  const cfAsB = await b.client.from('close_friends').select('*');
  check("B cannot see A's close friends list", cfAsB.data?.length === 0);
  const fav = await a.client.from('favorites').insert({ favorite_id: b.id });
  check('A favorites followed B', !fav.error, fav.error?.message);
  const favNotFollowed = await a.client.from('favorites').insert({ favorite_id: c.id });
  check(
    'A cannot favorite unfollowed C',
    favNotFollowed.error?.message === 'favorites_must_follow',
  );
  const picker = (await a.client.rpc('people_picker', {})).data ?? [];
  const pb = picker.find((p) => p.id === b.id);
  check('people_picker flags B close friend + favorite', pb?.is_close_friend && pb?.is_favorite);
  await a.client.rpc('unfollow_user', { target: b.id });
  const favAfter = await a.client.from('favorites').select('*');
  check('unfollow removes favorite', favAfter.data?.length === 0);
}

// Going public auto-approves pending requests
{
  await c.client.rpc('follow_user', { target: b.id });
  const pub = await b.client.from('profiles').update({ is_private: false }).eq('id', b.id);
  const pc = await profile(c, b);
  check('B goes public → C request approved', !pub.error && pc?.i_follow === true);
}

// Saved collections are owner-only
{
  const col = await a.client
    .from('saved_collections')
    .insert({ name: 'Recipes' })
    .select()
    .single();
  check('A creates a collection', !col.error, col.error?.message);
  // Collection items reference real posts since Phase 3: make a one-slide post for A.
  const postId = randomUUID();
  const path = `${a.id}/${postId}/0.jpg`;
  await a.client.from('posts').insert({ id: postId });
  await a.client.storage
    .from('posts')
    .upload(path, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
  await a.client
    .from('post_media')
    .insert({ post_id: postId, position: 0, type: 'image', path, width: 1, height: 1 });
  await a.client.rpc('publish_post', { p_post: postId });
  const item = await a.client
    .from('saved_collection_items')
    .insert({ collection_id: col.data.id, post_id: postId });
  check('A adds an item', !item.error, item.error?.message);
  const asB = await b.client.from('saved_collections').select('*');
  check("B cannot see A's collections", asB.data?.length === 0);
  const bItem = await b.client
    .from('saved_collection_items')
    .insert({ collection_id: col.data.id, post_id: postId });
  check("B cannot add to A's collection", !!bItem.error);
  const empty = await a.client.from('saved_collections').insert({ name: '   ' });
  check('blank collection name rejected', !!empty.error);
}

// Notification bell prefs are owner-only
{
  const up = await a.client
    .from('profile_notification_prefs')
    .upsert({ owner_id: a.id, target_id: c.id, posts: true });
  check('A sets the bell for C', !up.error, up.error?.message);
  const asC = await c.client.from('profile_notification_prefs').select('*');
  check("C cannot see A's bell prefs", asC.data?.length === 0);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
