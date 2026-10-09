// Seed a small social graph with posts for trying the Phase 4 feed on the LOCAL stack.
// Creates (or reuses) accounts, generated gradient photos, carousels, follows, likes, comments,
// a repost and a close-friends post. Logins go to .test-users.local.json (git-ignored).
// Usage: node scripts/seed-feed.mjs   (run again after `npx supabase db reset`)
import { randomUUID } from 'node:crypto';

import { PALETTES, account, png } from './lib/seed.mjs';

let paletteIndex = 0;
async function post(user, caption, slides = 1, extra = {}) {
  const id = randomUUID();
  const ins = await user.client.from('posts').insert({ id, caption, aspect_ratio: 0.8, ...extra });
  if (ins.error) throw ins.error;
  for (let i = 0; i < slides; i++) {
    const path = `${user.id}/${id}/${randomUUID()}.png`;
    const [a, b] = PALETTES[paletteIndex++ % PALETTES.length];
    const up = await user.client.storage
      .from('posts')
      .upload(path, png(540, 675, a, b), { contentType: 'image/png' });
    if (up.error) throw up.error;
    const m = await user.client
      .from('post_media')
      .insert({ post_id: id, position: i, type: 'image', path, width: 1080, height: 1350 });
    if (m.error) throw m.error;
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

await cam.client.from('profiles').update({ is_private: true }).eq('id', cam.id);
for (const target of [ana, ben, cam]) await viewer.client.rpc('follow_user', { target: target.id });
await cam.client.rpc('approve_follow_request', { requester: viewer.id });
await ben.client.rpc('follow_user', { target: dina.id });
await viewer.client.from('favorites').upsert({ favorite_id: ben.id }, { ignoreDuplicates: true });
await ana.client.from('close_friends').upsert({ friend_id: viewer.id }, { ignoreDuplicates: true });

const p1 = await post(ana, 'Golden hour at the pier 🌅 #sunset #weekend');
const p2 = await post(ben, 'Three days, three cities. Swipe → @ana.lima', 3);
const p3 = await post(cam, 'Only for the people who follow me 🔒');
const p4 = await post(ana, 'Close friends only ✨', 1, { audience: 'close_friends' });
const p5 = await post(dina, 'Lisbon tram, the classic 28 🚋 #travel', 2);
const p6 = await post(dina, 'Morning coffee view ☕️');
await post(viewer, 'My first post here 👋');

const like = (u, p) => u.client.from('likes').upsert({ post_id: p }, { ignoreDuplicates: true });
await like(ben, p1);
await like(viewer, p2);
await like(ana, p2);
await like(ben, p5);
await like(ana, p5);
await like(viewer, p5);
await viewer.client.from('likes').delete().eq('post_id', p5);
await ana.client.from('comments').insert({ post_id: p2, body: 'These colors 😍' });
const c = await ben.client
  .from('comments')
  .insert({ post_id: p1, body: 'Wow, where is this?' })
  .select()
  .single();
await ana.client
  .from('comments')
  .insert({ post_id: p1, parent_id: c.data?.id, body: '@ben.okafor Santa Monica!' });
await ben.client
  .from('reposts')
  .upsert({ post_id: p5, note: 'Need to go here' }, { ignoreDuplicates: true });
await ana.client.from('posts').update({ hide_like_counts: true }).eq('id', p1);

console.log(`Seeded feed. Log in as @dev.viewer (password in .test-users.local.json).`);
console.log({ p1, p2, p3, p4, p5, p6 });
