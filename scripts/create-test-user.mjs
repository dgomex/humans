// Create a finished test account on the LOCAL stack (email code → password → complete_signup).
// Usage: node scripts/create-test-user.mjs <username> ["Full Name"]
// Credentials are appended to .test-users.local.json (git-ignored) — never commit them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [username, fullName = username] = process.argv.slice(2);
if (!username) {
  console.error('Usage: node scripts/create-test-user.mjs <username> ["Full Name"]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing to run against a non-local URL');
const MAILPIT = 'http://127.0.0.1:54324';

const email = `${username.replace(/[^a-z0-9]/gi, '')}@test.local`;
const password = `T-${randomBytes(9).toString('base64url')}`;
const client = createClient(url, env.EXPO_PUBLIC_SUPABASE_KEY, { auth: { persistSession: false } });

await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, {
  method: 'DELETE',
});
const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
if (otp.error) throw otp.error;

let code;
for (let i = 0; i < 20 && !code; i++) {
  const res = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`,
  );
  const { messages = [] } = await res.json();
  code = messages[0]?.Subject.match(/\b(\d{6})\b/)?.[1];
  if (!code) await new Promise((r) => setTimeout(r, 300));
}
if (!code) throw new Error('No code email received');

const verified = await client.auth.verifyOtp({ email, token: code, type: 'email' });
if (verified.error) throw verified.error;
const pw = await client.auth.updateUser({ password });
if (pw.error) throw pw.error;
const done = await client.rpc('complete_signup', {
  p_username: username,
  p_full_name: fullName,
  p_birthday: '1995-01-01',
});
if (done.error) throw done.error;

const file = new URL('../.test-users.local.json', import.meta.url);
const users = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
users[username] = { email, password, id: verified.data.user.id };
writeFileSync(file, JSON.stringify(users, null, 2) + '\n');
console.log(`Created @${username} (${email}); login saved to .test-users.local.json`);
