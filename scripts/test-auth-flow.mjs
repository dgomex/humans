// End-to-end Phase 1 auth check against the LOCAL stack: sign-up by email code, password,
// complete_signup, login by username/email (account-auth function), recovery, and RLS between
// two users. Reads the emailed codes from the local Mailpit inbox.
// Usage: node scripts/test-auth-flow.mjs
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
    if (messages.length) {
      const match = messages[0].Subject.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No code email for ${email}`);
}

async function clearInbox(email) {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, {
    method: 'DELETE',
  });
}

async function accountAuth(body) {
  const res = await fetch(`${url}/functions/v1/account-auth`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function signUp(label) {
  const client = createClient(url, key, opts);
  const email = `p1-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `pw-${randomUUID()}`;
  await clearInbox(email);
  const pre = await accountAuth({ action: 'lookup', identifier: email });
  check(`${label}: new email not found before sign-up`, pre.body.exists === false);

  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  check(`${label}: sign-up code sent`, !otp.error, otp.error?.message);
  const code = await latestCode(email);
  const verified = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  check(`${label}: code verified → session`, !!verified.data.session, verified.error?.message);

  const pw = await client.auth.updateUser({ password });
  check(`${label}: password set`, !pw.error, pw.error?.message);

  const mid = await accountAuth({ action: 'lookup', identifier: email });
  check(
    `${label}: unfinished sign-up = exists without profile`,
    mid.body.exists && !mid.body.hasProfile,
  );

  const [suggestion] =
    (await client.rpc('suggest_usernames', { full_name: `Test ${label} Person` })).data ?? [];
  const username = `${suggestion}_${randomUUID().slice(0, 4)}`.slice(0, 30);
  const avail = await client.rpc('username_available', { name: username });
  check(`${label}: username available`, avail.data === true, avail.error?.message);

  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Test ${label}`,
    p_birthday: '1995-06-15',
  });
  check(
    `${label}: complete_signup creates profile`,
    done.data?.username === username,
    done.error?.message,
  );
  return { client, email, password, username, id: verified.data.user.id };
}

const a = await signUp('a');
const b = await signUp('b');

// Login via account-auth.
{
  const r = await accountAuth({
    action: 'login',
    identifier: a.username.toUpperCase(),
    password: a.password,
  });
  check(
    'login by username (case-insensitive)',
    r.status === 200 && !!r.body.session?.access_token,
    JSON.stringify(r.body).slice(0, 80),
  );
  const r2 = await accountAuth({ action: 'login', identifier: a.email, password: a.password });
  check('login by email', r2.status === 200 && !!r2.body.session?.refresh_token);
  const r3 = await accountAuth({
    action: 'login',
    identifier: a.username,
    password: 'wrong-password',
  });
  check(
    'wrong password → invalid_password',
    r3.status === 401 && r3.body.error === 'invalid_password',
  );
  const r4 = await accountAuth({ action: 'login', identifier: 'no_such_user_xyz', password: 'x' });
  check(
    'unknown account → user_not_found',
    r4.status === 404 && r4.body.error === 'user_not_found',
  );
  const leaked =
    JSON.stringify(r4.body) +
    JSON.stringify(await accountAuth({ action: 'lookup', identifier: a.username }));
  check('lookup never returns the full email', !leaked.includes(a.email));
}

// Recovery.
{
  await clearInbox(a.email);
  const start = await accountAuth({ action: 'recover-start', identifier: a.username });
  check(
    'recover-start returns masked email',
    start.status === 200 && start.body.maskedEmail?.includes('•••'),
    JSON.stringify(start.body),
  );
  const code = await latestCode(a.email);
  const bad = await accountAuth({
    action: 'recover-verify',
    identifier: a.username,
    code: '000000',
  });
  check(
    'recover-verify rejects wrong code',
    bad.status === 400 && bad.body.error === 'invalid_code',
  );
  const ok = await accountAuth({ action: 'recover-verify', identifier: a.username, code });
  check(
    'recover-verify returns a session',
    ok.status === 200 && !!ok.body.session?.access_token,
    JSON.stringify(ok.body).slice(0, 80),
  );

  const rc = createClient(url, key, opts);
  await rc.auth.setSession(ok.body.session);
  const newPassword = `new-${randomUUID()}`;
  const upd = await rc.auth.updateUser({ password: newPassword });
  check('reset password', !upd.error, upd.error?.message);
  const relog = await accountAuth({
    action: 'login',
    identifier: a.username,
    password: newPassword,
  });
  check('login with new password', relog.status === 200);
  const old = await accountAuth({ action: 'login', identifier: a.username, password: a.password });
  check('old password rejected', old.status === 401);
}

// RLS between users.
{
  const upd = await b.client
    .from('profiles')
    .update({ full_name: 'hacked' })
    .eq('id', a.id)
    .select();
  check("B cannot edit A's profile", (upd.data ?? []).length === 0);
  const priv = await b.client.from('account_private').select('user_id');
  check(
    'B sees only own private row',
    (priv.data ?? []).every((r) => r.user_id === b.id) && priv.data?.length === 1,
  );
  const follow = await b.client.from('follows').insert({ follower_id: b.id, following_id: a.id });
  check('B follows A', !follow.error, follow.error?.message);
  const spoof = await b.client.from('follows').insert({ follower_id: a.id, following_id: b.id });
  check('B cannot follow on behalf of A', !!spoof.error);
  const direct = await b.client
    .from('profiles')
    .insert({ id: b.id, username: 'x' + randomUUID().slice(0, 6) });
  check('profiles cannot be inserted directly', !!direct.error);
  const lookup = await b.client.rpc('auth_lookup', { identifier: a.username });
  check('clients cannot call auth_lookup', !!lookup.error);
  const anon = createClient(url, key, opts);
  const anonRead = await anon.from('profiles').select('id').limit(1);
  check('anon cannot read profiles', (anonRead.data ?? []).length === 0);
  const avatar = await b.client
    .from('profiles')
    .update({ avatar_path: `${a.id}/x.jpg` })
    .eq('id', b.id);
  check('avatar_path must be in own folder', !!avatar.error);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll auth flow checks passed');
process.exit(failures ? 1 : 0);
