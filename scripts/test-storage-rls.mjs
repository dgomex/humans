// Two-user storage RLS check against the LOCAL stack (`npx supabase start`).
// Usage: node scripts/test-storage-rls.mjs
// Signs up two throwaway users with the publishable key (local auth has email confirmation off).
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

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

async function newUser(label) {
  const client = createClient(url, key, opts);
  const email = `rls-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const { data, error } = await client.auth.signUp({ email, password: randomUUID() });
  if (error) throw error;
  return { client, id: data.user.id };
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const up = (c, bucket, path, type = 'image/png') =>
  c.storage.from(bucket).upload(path, png, { contentType: type, upsert: false });

const a = await newUser('a');
const b = await newUser('b');
const anon = createClient(url, key, opts);

// Owners can write into their own folder.
for (const bucket of ['avatars', 'posts', 'reels', 'stories', 'highlights-covers']) {
  const r = await up(a.client, bucket, `${a.id}/${randomUUID()}.png`);
  check(`A uploads own ${bucket}`, !r.error, r.error?.message);
}

// Nobody can write into someone else's folder.
for (const bucket of ['avatars', 'posts', 'stories']) {
  const r = await up(a.client, bucket, `${b.id}/${randomUUID()}.png`);
  check(`A cannot upload into B's ${bucket}`, !!r.error, r.error?.message);
}
{
  const r = await up(anon, 'avatars', `${a.id}/${randomUUID()}.png`);
  check('anon cannot upload', !!r.error, r.error?.message);
}

// messages: deny-all until Phase 9.
{
  const r = await up(a.client, 'messages', `${randomUUID()}/${randomUUID()}.png`);
  check('messages bucket denies writes (Phase 9 adds policies)', !!r.error, r.error?.message);
}

// MIME allow-list.
{
  const r = await up(a.client, 'avatars', `${a.id}/${randomUUID()}.txt`, 'text/plain');
  check('avatars rejects text/plain', !!r.error, r.error?.message);
}

// Private bucket reads: owner signs, other user cannot.
const postPath = `${a.id}/${randomUUID()}/0.png`;
await up(a.client, 'posts', postPath);
{
  const own = await a.client.storage.from('posts').createSignedUrl(postPath, 60);
  check('A can sign own private post', !!own.data?.signedUrl, own.error?.message);
  const res = own.data ? await fetch(own.data.signedUrl) : null;
  check('signed URL downloads', res?.status === 200, `status ${res?.status}`);
  const other = await b.client.storage.from('posts').createSignedUrl(postPath, 60);
  check("B cannot sign A's private post", !!other.error, other.error?.message);
  const anonSign = await anon.storage.from('posts').createSignedUrl(postPath, 60);
  check("anon cannot sign A's private post", !!anonSign.error, anonSign.error?.message);
}

// Public bucket: readable by public URL; others cannot delete/overwrite.
const avatarPath = `${a.id}/${randomUUID()}.png`;
await up(a.client, 'avatars', avatarPath);
{
  const publicUrl = anon.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl;
  const res = await fetch(publicUrl);
  check('avatar public URL readable anonymously', res.status === 200, `status ${res.status}`);

  await b.client.storage.from('avatars').remove([avatarPath]);
  const still = await fetch(publicUrl);
  check("B cannot delete A's avatar", still.status === 200, `status ${still.status}`);

  const overwrite = await b.client.storage
    .from('avatars')
    .upload(avatarPath, png, { contentType: 'image/png', upsert: true });
  check("B cannot overwrite A's avatar", !!overwrite.error, overwrite.error?.message);

  const del = await a.client.storage.from('avatars').remove([avatarPath]);
  const gone = await fetch(publicUrl);
  check('A can delete own avatar', !del.error && gone.status !== 200, `status ${gone.status}`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll storage RLS checks passed');
process.exit(failures ? 1 : 0);
