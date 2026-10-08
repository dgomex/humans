// Seed a small social graph with posts for trying the Phase 4 feed on the LOCAL stack.
// Creates (or reuses) accounts, generated gradient photos, carousels, follows, likes, comments,
// a repost and a close-friends post. Logins go to .test-users.local.json (git-ignored).
// Usage: node scripts/seed-feed.mjs   (run again after `npx supabase db reset`)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
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
const usersFile = new URL('../.test-users.local.json', import.meta.url);
const saved = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, 'utf8')) : {};

// ---- tiny PNG encoder (RGB gradient with a diagonal band) ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, [r1, g1, b1], [r2, g2, b2]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      const band = Math.abs(((x + y) % 160) - 80) < 6 ? 30 : 0;
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = Math.min(255, r1 + (r2 - r1) * t + band);
      raw[i + 1] = Math.min(255, g1 + (g2 - g1) * t + band);
      raw[i + 2] = Math.min(255, b1 + (b2 - b1) * t + band);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PALETTES = [
  [
    [255, 94, 98],
    [255, 195, 113],
  ],
  [
    [67, 206, 162],
    [24, 90, 157],
  ],
  [
    [131, 96, 195],
    [46, 191, 145],
  ],
  [
    [252, 70, 107],
    [63, 94, 251],
  ],
  [
    [255, 175, 189],
    [255, 195, 160],
  ],
  [
    [33, 147, 176],
    [109, 213, 237],
  ],
  [
    [238, 156, 167],
    [255, 221, 225],
  ],
  [
    [19, 78, 94],
    [113, 178, 128],
  ],
];

// ---- accounts ----
async function latestCode(email) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`,
    );
    const { messages = [] } = await res.json();
    const code = messages[0]?.Subject.match(/\b(\d{6})\b/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No code email for ${email}`);
}

async function account(username, fullName) {
  const client = createClient(url, key, opts);
  const known = saved[username];
  if (known) {
    const login = await client.auth.signInWithPassword({
      email: known.email,
      password: known.password,
    });
    if (!login.error) return { client, username, id: login.data.user.id };
  }
  const email = `${username.replace(/[^a-z0-9]/gi, '')}@test.local`;
  const password = `T-${randomBytes(9).toString('base64url')}`;
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, {
    method: 'DELETE',
  });
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const v = await client.auth.verifyOtp({ email, token: await latestCode(email), type: 'email' });
  if (v.error) throw v.error;
  const pw = await client.auth.updateUser({ password });
  if (pw.error) throw pw.error;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: fullName,
    p_birthday: '1995-01-01',
  });
  if (done.error) throw done.error;
  saved[username] = { email, password, id: v.data.user.id };
  writeFileSync(usersFile, JSON.stringify(saved, null, 2) + '\n');
  return { client, username, id: v.data.user.id };
}

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
