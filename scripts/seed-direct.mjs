// Demo Direct Messages for dev.viewer on the LOCAL stack (run after seed-audio + seed-feed):
// 1:1 chats (photo, shared post, reactions, reply, unread), a group with a theme + pinned message,
// a message request + a hidden request, and notes from mutuals (one with a song).
// Usage: node scripts/seed-direct.mjs   (run again after `npx supabase db reset`)
import { randomUUID } from 'node:crypto';

import { PALETTES, account, png } from './lib/seed.mjs';

const viewer = await account('dev.viewer', 'Dev Viewer');
const ana = await account('ana.lima', 'Ana Lima');
const ben = await account('ben.okafor', 'Ben Okafor');
const dina = await account('dina.travels', 'Dina Travels');
const eli = await account('eli.newhere', 'Eli New');
const spam = await account('free.follows.now', 'Growth Tips');

// Mutual follows (notes are for followers you follow back).
for (const u of [ana, ben]) await u.client.rpc('follow_user', { target: viewer.id });
for (const u of [ana, ben, dina]) await viewer.client.rpc('follow_user', { target: u.id });
await dina.client.rpc('follow_user', { target: viewer.id });

async function send(user, thread, fields) {
  const r = await user.client
    .from('messages')
    .insert({ thread_id: thread, kind: 'text', ...fields })
    .select('id')
    .single();
  if (r.error) throw r.error;
  return r.data.id;
}
async function photo(user, thread, palette) {
  const id = randomUUID();
  const path = `${thread}/${id}.png`;
  const [a, b] = PALETTES[palette % PALETTES.length];
  const up = await user.client.storage
    .from('messages')
    .upload(path, png(480, 600, a, b), { contentType: 'image/png' });
  if (up.error) throw up.error;
  return send(user, thread, {
    id,
    kind: 'media',
    media_type: 'image',
    media_path: path,
    width: 1080,
    height: 1350,
  });
}
const thread = async (from, to) =>
  (await from.client.rpc('get_or_create_direct', { p_other: to.id })).data;
const react = async (user, message, emoji) => {
  const r = await user.client.from('message_reactions').insert({ message_id: message, emoji });
  if (r.error) throw r.error;
};
const latestPost = async (user) =>
  (
    await viewer.client
      .from('posts')
      .select('id')
      .eq('author_id', user.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ).data?.id;

// ---- Ana: a back-and-forth with a photo, a shared post, a reply and reactions ----
const tAna = await thread(ana, viewer);
await send(ana, tAna, { body: 'hey!! are you coming on saturday? 🎉' });
const q = await send(viewer, tAna, { body: 'yes! what time should I be there?' });
await send(ana, tAna, { body: 'around 7, bring snacks 😄', reply_to_id: q });
const pic = await photo(ana, tAna, 1);
await react(viewer, pic, '😍');
const benPost = await latestPost(ben);
if (benPost) await send(ana, tAna, { kind: 'post', post_id: benPost });
const last = await send(viewer, tAna, { body: 'deal 🙌 see you there' });
await react(ana, last, '❤️');
await ana.client.rpc('mark_thread_read', { p_thread: tAna });

// ---- Ben: unread messages ----
const tBen = await thread(ben, viewer);
await send(ben, tBen, { body: 'yo, did you see the pier photos?' });
await send(ben, tBen, { kind: 'profile', profile_id: dina.id });
await send(ben, tBen, { body: 'Dina is doing a photo walk next week, want in?' });

// ---- Group: Weekend trip ----
const g = await ana.client.rpc('create_group_thread', {
  p_members: [viewer.id, ben.id, dina.id],
  p_title: 'Weekend trip 🏕️',
});
if (g.error) throw g.error;
const gid = g.data;
await ana.client.rpc('set_thread_theme', { p_thread: gid, p_theme: 'ocean' });
const plan = await send(ana, gid, { body: 'Plan: leave Friday 6pm, back Sunday night' });
await ana.client.rpc('pin_message', { p_message: plan, p_pinned: true });
await send(ben, gid, { body: "I'll drive 🚗" });
await send(dina, gid, { body: 'I have two tents ⛺' });
await photo(dina, gid, 3);
await ben.client.rpc('set_nickname', { p_thread: gid, p_user: dina.id, p_nickname: 'Tent queen' });
await send(viewer, gid, { body: 'count me in!' });

// ---- Requests: one normal, one hidden ----
const tEli = await thread(eli, viewer);
await send(eli, tEli, { body: 'Hi! Loved your photos, are you a photographer? 📸' });
const tSpam = await thread(spam, viewer);
await send(spam, tSpam, { body: 'Get FREE FOLLOWERS today, click my link!!' });

// ---- Notes ----
const track = (
  await viewer.client.from('audio_tracks').select('id').neq('source', 'original').limit(1)
).data?.[0];
await ana.client.from('notes').insert({ body: 'beach day ☀️ anyone?' });
await ben.client
  .from('notes')
  .insert({ body: 'on repeat', audio_track_id: track?.id ?? null, audio_start_ms: 0 });
for (const u of [ana, ben]) await u.client.rpc('touch_presence');

console.log(
  'Seeded Direct for dev.viewer: chats with ana.lima + ben.okafor, a group, 2 requests, notes.',
);
