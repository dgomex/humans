// Seed Activity (Phase 8) for @dev.viewer on the LOCAL stack: grouped likes, comments + replies,
// a comment mention, follows, a tag, a collaboration invite, a bell post, and older rows spread
// over Yesterday / Last 7 days / Last 30 days. Also gives @cam.private two follow requests.
// Usage: node scripts/seed-activity.mjs   (after seed-audio + seed-feed; re-run after db reset)
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { PALETTES, account, opts, png, url } from './lib/seed.mjs';

let paletteIndex = 3;
async function post(user, caption, { tags = [], collaborators = [] } = {}) {
  const id = randomUUID();
  const mediaId = randomUUID();
  const ins = await user.client.from('posts').insert({ id, caption, aspect_ratio: 0.8 });
  if (ins.error) throw ins.error;
  const path = `${user.id}/${id}/${mediaId}.png`;
  const [a, b] = PALETTES[paletteIndex++ % PALETTES.length];
  const up = await user.client.storage
    .from('posts')
    .upload(path, png(540, 675, a, b), { contentType: 'image/png' });
  if (up.error) throw up.error;
  const m = await user.client
    .from('post_media')
    .insert({
      id: mediaId,
      post_id: id,
      position: 0,
      type: 'image',
      path,
      width: 1080,
      height: 1350,
    });
  if (m.error) throw m.error;
  for (const t of tags) {
    await user.client
      .from('post_tags')
      .insert({ post_id: id, media_id: mediaId, tagged_user_id: t, x: 0.4, y: 0.6 });
  }
  for (const c of collaborators) {
    await user.client.from('post_collaborators').insert({ post_id: id, user_id: c });
  }
  const pub = await user.client.rpc('publish_post', { p_post: id });
  if (pub.error) throw pub.error;
  return id;
}

const viewer = await account('dev.viewer', 'Dev Viewer');
const ana = await account('ana.lima', 'Ana Lima');
const ben = await account('ben.okafor', 'Ben Okafor');
const cam = await account('cam.private', 'Cam (private)');
const dina = await account('dina.travels', 'Dina Travels');
const eli = await account('eli.moreau', 'Eli Moreau');
const fay = await account('fay.chen', 'Fay Chen');

// Older activity first (backdated below): an older post with likes and a follow.
const old = await post(viewer, 'Throwback to the mountains 🏔️');
for (const u of [ana, ben, dina, eli]) {
  await u.client.from('likes').upsert({ post_id: old }, { ignoreDuplicates: true });
}
await eli.client.rpc('follow_user', { target: viewer.id });

// Recent activity.
const fresh = await post(viewer, 'New week, new light ☀️');
for (const u of [ana, ben, dina, fay]) {
  await u.client.from('likes').upsert({ post_id: fresh }, { ignoreDuplicates: true });
}
const c1 = await ben.client
  .from('comments')
  .insert({ post_id: fresh, body: 'This light is unreal 🔥' })
  .select()
  .single();
await viewer.client
  .from('comments')
  .insert({ post_id: fresh, parent_id: c1.data?.id, body: '@ben.okafor thank you!' });
await dina.client
  .from('comments')
  .insert({ post_id: fresh, parent_id: c1.data?.id, body: 'Agreed, stunning' });
const anaPost = await post(ana, 'Weekend picnic 🧺');
await ana.client
  .from('comments')
  .insert({ post_id: anaPost, body: '@dev.viewer you have to come next time!' });
for (const u of [dina, fay]) await u.client.rpc('follow_user', { target: viewer.id });
await post(ben, 'Rooftop session with friends', { tags: [viewer.id] });
await post(dina, 'Our Lisbon guide, part 1', { collaborators: [viewer.id] });
await viewer.client
  .from('profile_notification_prefs')
  .upsert({ target_id: dina.id, posts: true, stories: true });
await post(dina, 'Sunset from Miradouro 🌇 #sunset');

// Follow requests for the private account.
for (const u of [eli, fay]) await u.client.rpc('follow_user', { target: cam.id });

// Backdate the older rows (service role, local stack only) so every section shows.
const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }));
const admin = createClient(url, status.SERVICE_ROLE_KEY, opts);
const day = 86_400_000;
const ago = (d) => new Date(Date.now() - d).toISOString();
const olds =
  (await admin.from('notifications').select('id, actor_id').eq('post_id', old)).data ?? [];
for (const [i, n] of olds.entries()) {
  await admin
    .from('notifications')
    .update({ created_at: ago(i < 2 ? 3 * day : 12 * day) })
    .eq('id', n.id);
}
await admin
  .from('notifications')
  .update({ created_at: ago(day + 2 * 3_600_000) })
  .eq('type', 'follow')
  .eq('actor_id', eli.id)
  .eq('recipient_id', viewer.id);
// Activity was last opened two hours ago: newer rows are "New".
await admin.from('activity_state').upsert({ user_id: viewer.id, seen_at: ago(2 * 3_600_000) });

console.log('Seeded activity. Log in as @dev.viewer (or @cam.private for follow requests).');
