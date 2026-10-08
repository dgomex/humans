// Phase 3 (Content creation) schema + RLS check against the LOCAL stack, with three fresh users:
// A (public, author), B (private), C (public, viewer who follows nobody).
// Usage: node scripts/test-posts-rls.mjs
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
  const email = `p3-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p3${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase3 ${label.toUpperCase()}`,
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

const seePost = async (viewer, id) =>
  ((await viewer.client.from('posts').select('id').eq('id', id)).data ?? []).length === 1;
const canSign = async (viewer, path) =>
  !(await viewer.client.storage.from('posts').createSignedUrl(path, 60)).error;
const postsCount = async (user) =>
  (await user.client.from('profiles').select('posts_count').eq('id', user.id).single()).data
    ?.posts_count;
const grid = async (viewer, owner, kind = 'grid') =>
  (await viewer.client.rpc('profile_posts', { p_user: owner.id, p_kind: kind })).data ?? [];

const a = await makeUser('a');
const b = await makeUser('b');
const c = await makeUser('c');
await b.client.from('profiles').update({ is_private: true }).eq('id', b.id);

// Upload → publish lifecycle
{
  const id = randomUUID();
  const ins = await a.client.from('posts').insert({ id, caption: 'Draft', aspect_ratio: 1 });
  check('A creates an uploading post', !ins.error, ins.error?.message);
  const path = `${a.id}/${id}/0.jpg`;
  const m = await a.client
    .from('post_media')
    .insert({ post_id: id, position: 0, type: 'image', path, width: 1080, height: 1080 });
  check('A adds a media row', !m.error, m.error?.message);
  const early = await a.client.rpc('publish_post', { p_post: id });
  check('publish fails while the file is missing', early.error?.message === 'media_missing');
  check('C cannot see an uploading post', !(await seePost(c, id)));
  await a.client.storage.from('posts').upload(path, JPEG, { contentType: 'image/jpeg' });
  const cPub = await c.client.rpc('publish_post', { p_post: id });
  check("C cannot publish A's post", !!cPub.error);
  const pub = await a.client.rpc('publish_post', { p_post: id });
  check('A publishes once the file exists', !pub.error, pub.error?.message);
  check('C sees the published post', await seePost(c, id));
  check('C can sign the media URL', await canSign(c, path));
  check('A posts_count = 1', (await postsCount(a)) === 1);
  const status = await a.client.from('posts').update({ status: 'uploading' }).eq('id', id);
  check('client cannot write status', !!status.error);
  const cEdit = await c.client.from('posts').update({ caption: 'hacked' }).eq('id', id).select();
  check("C cannot edit A's caption", !cEdit.error && cEdit.data.length === 0);
  const cMedia = await c.client.from('post_media').insert({
    post_id: id,
    position: 1,
    type: 'image',
    path: `${c.id}/${id}/1.jpg`,
    width: 1,
    height: 1,
  });
  check("C cannot add media to A's post", !!cMedia.error);
  const lateMedia = await a.client.from('post_media').insert({
    post_id: id,
    position: 1,
    type: 'image',
    path: `${a.id}/${id}/1.jpg`,
    width: 1,
    height: 1,
  });
  check('no new slides after publishing', !!lateMedia.error);
  const lastDel = await a.client.from('post_media').delete().eq('post_id', id);
  check('cannot delete the last slide', !!lastDel.error);
  const del = await a.client.from('posts').delete().eq('id', id);
  check('A deletes the post', !del.error, del.error?.message);
  check('A posts_count back to 0', (await postsCount(a)) === 0);
}

// Caption limits, hashtags and mentions
{
  const long = await a.client.from('posts').insert({ caption: 'x'.repeat(2201) });
  check('caption over 2,200 chars rejected', !!long.error);
  const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
  const many = await a.client.from('posts').insert({ caption: tags });
  check('31 hashtags rejected', !!many.error);
  const tag = `phase3${randomUUID().slice(0, 6)}`;
  const p = await makePost(a, { caption: `Hello #${tag} @${c.username}` });
  const h = await c.client.from('hashtags').select('name, post_count').eq('name', tag).single();
  check('hashtag parsed with count 1', h.data?.post_count === 1, JSON.stringify(h.data));
  const men = await c.client.from('post_mentions').select('user_id').eq('post_id', p.id);
  check('mention of C recorded', men.data?.[0]?.user_id === c.id);
  const hw = await a.client.from('hashtags').insert({ name: 'nope' });
  check('clients cannot write hashtags', !!hw.error);
  await a.client.from('posts').update({ caption: 'No tags now' }).eq('id', p.id);
  const h2 = await c.client.from('hashtags').select('post_count').eq('name', tag).single();
  check('editing the caption updates hashtag counts', h2.data?.post_count === 0);
  const edited = await a.client.from('posts').select('edited_at').eq('id', p.id).single();
  check('caption edit sets edited_at', !!edited.data?.edited_at);
  await a.client.from('posts').delete().eq('id', p.id);
}

// Private author
{
  const p = await makePost(b);
  check("C cannot see private B's post", !(await seePost(c, p.id)));
  check("C cannot sign private B's media", !(await canSign(c, p.media[0].path)));
  await a.client.rpc('follow_user', { target: b.id });
  await b.client.rpc('approve_follow_request', { requester: a.id });
  check('approved follower A sees the post', await seePost(a, p.id));
  check('approved follower A can sign the media', await canSign(a, p.media[0].path));
}

// Close Friends audience
{
  const p = await makePost(a, { audience: 'close_friends' });
  check('C cannot see a close-friends post', !(await seePost(c, p.id)));
  check('C cannot sign close-friends media', !(await canSign(c, p.media[0].path)));
  await a.client.from('close_friends').insert({ friend_id: c.id });
  check('after being added, C sees it', await seePost(c, p.id));
  await a.client.from('posts').delete().eq('id', p.id);
}

// Tag people
{
  const p = await makePost(a, { n: 2 });
  const t = await a.client
    .from('post_tags')
    .insert({ post_id: p.id, media_id: p.media[0].id, tagged_user_id: c.id, x: 0.5, y: 0.4 });
  check('A tags C on slide 1', !t.error, t.error?.message);
  const bTag = await b.client
    .from('post_tags')
    .insert({ post_id: p.id, media_id: p.media[1].id, tagged_user_id: b.id, x: 0.1, y: 0.1 });
  check("B cannot tag in A's post", !!bTag.error);
  const bad = await a.client
    .from('post_tags')
    .insert({ post_id: p.id, media_id: p.media[1].id, tagged_user_id: b.id, x: 2, y: 0 });
  check('tag position outside 0–1 rejected', !!bad.error);
  const tagged = await grid(b, c, 'tagged');
  check(
    "the post is on C's Tagged tab",
    tagged.some((x) => x.id === p.id),
  );
  const untag = await c.client
    .from('post_tags')
    .delete()
    .eq('post_id', p.id)
    .eq('tagged_user_id', c.id)
    .select();
  check('C removes their own tag', !untag.error && untag.data.length === 1);
  check("gone from C's Tagged tab", !(await grid(b, c, 'tagged')).some((x) => x.id === p.id));

  // Reorder
  const ids = [p.media[1].id, p.media[0].id];
  const cr = await c.client.rpc('reorder_post_media', { p_post: p.id, p_media: ids });
  check("C cannot reorder A's slides", !!cr.error);
  const r = await a.client.rpc('reorder_post_media', { p_post: p.id, p_media: ids });
  check('A reorders slides', !r.error, r.error?.message);
  const order = await a.client
    .from('post_media')
    .select('id')
    .eq('post_id', p.id)
    .order('position');
  check('new order stored', order.data?.[0]?.id === ids[0]);
  const alt = await a.client
    .from('post_media')
    .update({ alt_text: 'A beach' })
    .eq('id', ids[0])
    .select();
  check('A writes alt text', alt.data?.length === 1);
  const cAlt = await c.client
    .from('post_media')
    .update({ alt_text: 'x' })
    .eq('id', ids[0])
    .select();
  check("C cannot write A's alt text", !cAlt.error && cAlt.data.length === 0);
  const pos = await a.client.from('post_media').update({ position: 5 }).eq('id', ids[0]);
  check('position only changes through the RPC', !!pos.error);
  await a.client.from('posts').delete().eq('id', p.id);
}

// Collaborators
{
  const p = await makePost(a);
  const self = await a.client.from('post_collaborators').insert({ post_id: p.id, user_id: a.id });
  check('cannot invite yourself', !!self.error);
  const inv = await a.client.from('post_collaborators').insert({ post_id: p.id, user_id: c.id });
  check('A invites C', !inv.error, inv.error?.message);
  const bInv = await b.client.from('post_collaborators').insert({ post_id: p.id, user_id: b.id });
  check("B cannot invite to A's post", !!bInv.error);
  const invites = (await c.client.rpc('my_collab_invites')).data ?? [];
  check(
    'C sees the invite',
    invites.some((x) => x.post_id === p.id),
  );
  const forged = await c.client
    .from('post_collaborators')
    .update({ status: 'accepted' })
    .eq('post_id', p.id);
  check('status not writable directly', !!forged.error);
  const acc = await c.client.rpc('respond_collab_invite', { p_post: p.id, p_accept: true });
  check('C accepts', acc.data === true, acc.error?.message);
  check(
    "collab post is on C's grid",
    (await grid(b, c)).some((x) => x.id === p.id),
  );
  await a.client.from('posts').delete().eq('id', p.id);
}

// Archive and pin
{
  const posts = [];
  for (let i = 0; i < 4; i++) posts.push(await makePost(a));
  const before = await postsCount(a);
  await a.client
    .from('posts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', posts[0].id);
  check('C cannot see an archived post', !(await seePost(c, posts[0].id)));
  check('archived post not counted', (await postsCount(a)) === before - 1);
  check(
    'A sees it in the archive',
    (await grid(a, a, 'archived')).some((x) => x.id === posts[0].id),
  );
  check("C cannot list A's archive", (await grid(c, a, 'archived')).length === 0);
  await a.client.from('posts').update({ archived_at: null }).eq('id', posts[0].id);
  check('unarchived post visible again', await seePost(c, posts[0].id));

  for (let i = 0; i < 3; i++) {
    const pin = await a.client
      .from('posts')
      .update({ pinned_at: new Date().toISOString() })
      .eq('id', posts[i].id);
    if (pin.error) check(`pin ${i + 1}`, false, pin.error.message);
  }
  const fourth = await a.client
    .from('posts')
    .update({ pinned_at: new Date().toISOString() })
    .eq('id', posts[3].id);
  check('a fourth pin is rejected', fourth.error?.message === 'pin_limit');
  const g = await grid(c, a);
  check('pinned posts come first', g.slice(0, 3).every((x) => x.is_pinned) && !g[3]?.is_pinned);
  for (const p of posts) await a.client.from('posts').delete().eq('id', p.id);
}

// Music catalog + saved collections FK
{
  const tracks = await c.client.from('audio_tracks').select('id').limit(1);
  check('audio_tracks readable', !tracks.error, tracks.error?.message);
  const w = await c.client
    .from('audio_tracks')
    .insert({ title: 'x', artist: 'y', duration_ms: 1, audio_path: 'x.wav' });
  check('clients cannot add tracks', !!w.error);
  const col = await a.client.from('saved_collections').insert({ name: 'FK' }).select().single();
  const item = await a.client
    .from('saved_collection_items')
    .insert({ collection_id: col.data.id, post_id: randomUUID() });
  check('collection items need a real post', !!item.error);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
