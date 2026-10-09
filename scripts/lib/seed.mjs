// Shared helpers for the local seed scripts: a tiny PNG encoder (gradient images, no
// dependencies) and get-or-create test accounts (logins in .test-users.local.json, git-ignored).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
export const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_KEY;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing to run against a non-local URL');
const MAILPIT = 'http://127.0.0.1:54324';
export const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const usersFile = new URL('../../.test-users.local.json', import.meta.url);
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
export function png(w, h, [r1, g1, b1], [r2, g2, b2]) {
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
export const PALETTES = [
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

export async function account(username, fullName) {
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
