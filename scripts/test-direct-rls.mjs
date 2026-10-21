// Phase 9 (Direct Messages) schema + RLS check against the LOCAL stack, with fresh users:
// A (main), B (follows A), C and D (strangers to A), E (bystander).
// Usage: node scripts/test-direct-rls.mjs   (add --cron to also wait for a scheduled message)
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
const WAIT_CRON = process.argv.includes('--cron');

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const rows = (r) => r.data ?? [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestCode(email) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`,
    );
    const { messages = [] } = await res.json();
    const match = messages[0]?.Subject.match(/\b(\d{6})\b/);
    if (match) return match[1];
    await sleep(300);
  }
  throw new Error(`No code email for ${email}`);
}

async function makeUser(label) {
  const client = createClient(url, key, opts);
  const email = `p9-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const otp = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otp.error) throw otp.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCode(email),
    type: 'email',
  });
  if (verified.error) throw verified.error;
  const username = `p9${label}${randomUUID().slice(0, 6)}`;
  const done = await client.rpc('complete_signup', {
    p_username: username,
    p_full_name: `Phase9 ${label.toUpperCase()}`,
    p_birthday: '1995-06-15',
  });
  if (done.error) throw done.error;
  return { client, username, id: verified.data.user.id };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const M4A = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);

async function makePost(user, caption) {
  const id = randomUUID();
  const mediaId = randomUUID();
  const ins = await user.client.from('posts').insert({ id, caption, aspect_ratio: 1 });
  if (ins.error) throw ins.error;
  const path = `${user.id}/${id}/${mediaId}.jpg`;
  const up = await user.client.storage
    .from('posts')
    .upload(path, JPEG, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const m = await user.client.from('post_media').insert({
    id: mediaId,
    post_id: id,
    position: 0,
    type: 'image',
    path,
    width: 1080,
    height: 1080,
  });
  if (m.error) throw m.error;
  const pub = await user.client.rpc('publish_post', { p_post: id });
  if (pub.error) throw pub.error;
  return id;
}

async function makeStory(user) {
  const id = randomUUID();
  const path = `${user.id}/${id}/media.jpg`;
  const ins = await user.client.from('stories').insert({
    id,
    kind: 'photo',
    media_path: path,
    thumb_path: path,
    files: [path],
    width: 1080,
    height: 1920,
    content: { v: 1, elements: [] },
  });
  if (ins.error) throw ins.error;
  const up = await user.client.storage
    .from('stories')
    .upload(path, JPEG, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const pub = await user.client.rpc('publish_story', { p_story: id });
  if (pub.error) throw pub.error;
  return id;
}

const send = (user, thread, fields) =>
  user.client
    .from('messages')
    .insert({ thread_id: thread, kind: 'text', ...fields })
    .select('id, created_at, vanish, data')
    .single();
const messagesOf = async (user, thread, extra = {}) =>
  rows(await user.client.rpc('thread_messages', { p_thread: thread, ...extra }));
const inbox = async (user, folder = 'inbox') =>
  rows(await user.client.rpc('inbox_threads', { p_folder: folder }));
const badge = async (user) => (await user.client.rpc('direct_badge')).data;
const info = async (user, thread) =>
  (await user.client.rpc('thread_info', { p_thread: thread })).data;

async function upload(user, thread, id, ext = 'jpg', bytes = JPEG, contentType = 'image/jpeg') {
  const path = `${thread}/${id}.${ext}`;
  const r = await user.client.storage.from('messages').upload(path, bytes, { contentType });
  if (r.error) throw r.error;
  return path;
}
const canDownload = async (user, path) => {
  const r = await user.client.storage.from('messages').download(path);
  return !r.error && !!r.data;
};

const [a, b, c, d, e] = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(makeUser));
await b.client.rpc('follow_user', { target: a.id });

// ---- 1:1 thread between people who follow ----
const t1 = (await a.client.rpc('get_or_create_direct', { p_other: b.id })).data;
check('A creates a 1:1 thread with B', !!t1);
const t1b = (await b.client.rpc('get_or_create_direct', { p_other: a.id })).data;
check('one thread per pair (B gets the same thread)', t1b === t1);
const self = await a.client.rpc('get_or_create_direct', { p_other: a.id });
check("can't message yourself", !!self.error);
check('empty thread not in the inbox', !(await inbox(b)).some((t) => t.id === t1));

const m1 = await send(a, t1, { body: 'hey B' });
check('A sends text', !m1.error, m1.error?.message);
const bMsgs = await messagesOf(b, t1);
check(
  'B reads it',
  bMsgs.some((m) => m.id === m1.data?.id),
);
check('E cannot read the thread', (await messagesOf(e, t1)).length === 0);
const eDirect = await e.client.from('messages').select('id').eq('thread_id', t1);
check('E cannot select messages directly', rows(eDirect).length === 0);
const eSend = await send(e, t1, { body: 'intruder' });
check('E cannot send into the thread', !!eSend.error);
const eInfo = await info(e, t1);
check('E gets no thread_info', !eInfo);
const forge = await b.client
  .from('messages')
  .insert({ thread_id: t1, kind: 'text', body: 'as A', sender_id: a.id });
check("B can't send as A", !!forge.error);
const sys = await b.client.from('messages').insert({ thread_id: t1, kind: 'system' });
check("clients can't write system lines", !!sys.error);

const bInbox = await inbox(b);
const bRow = bInbox.find((t) => t.id === t1);
check('thread in B inbox, unread', !!bRow && bRow.unread && bRow.my_status === 'active');
check('B badge counts it', (await badge(b))?.unread === 1);
check('A has no unread (own message)', (await badge(a))?.unread === 0);
const aRowBefore = (await inbox(a)).find((t) => t.id === t1);
check('not seen yet', aRowBefore && aRowBefore.seen === false);
await b.client.rpc('mark_thread_read', { p_thread: t1 });
check('B read → badge 0', (await badge(b))?.unread === 0);
const aRowAfter = (await inbox(a)).find((t) => t.id === t1);
check('A sees "Seen"', aRowAfter?.seen === true);
const peekRow = await b.client.from('thread_members').select('*').eq('thread_id', t1);
check('members table shows only your own row', rows(peekRow).length === 1);

const receipts = await b.client
  .from('thread_members')
  .update({ read_receipts: false })
  .eq('thread_id', t1)
  .eq('user_id', b.id);
check('B turns off read receipts for the chat', !receipts.error);
const aInfo = await info(a, t1);
const bForA = aInfo?.members.find((m) => m.id === b.id);
check('receipts off → A gets no seen time', bForA && bForA.last_read_at === null);
await b.client
  .from('thread_members')
  .update({ read_receipts: true })
  .eq('thread_id', t1)
  .eq('user_id', b.id);
const forgeMember = await b.client
  .from('thread_members')
  .update({ status: 'left' })
  .eq('thread_id', t1)
  .eq('user_id', b.id);
check("can't change own status directly", !!forgeMember.error);
const forgeOther = await b.client
  .from('thread_members')
  .update({ muted_until: new Date().toISOString() })
  .eq('thread_id', t1)
  .eq('user_id', a.id)
  .select();
check("can't update someone else's member row", rows(forgeOther).length === 0);

// ---- Reactions / replies / edit / unsend / pin ----
const r1 = await b.client.from('message_reactions').insert({ message_id: m1.data.id, emoji: '❤️' });
check('B reacts', !r1.error, r1.error?.message);
const rE = await e.client.from('message_reactions').insert({ message_id: m1.data.id, emoji: '😂' });
check("E can't react", !!rE.error);
const rUpd = await b.client
  .from('message_reactions')
  .update({ emoji: '😂' })
  .eq('message_id', m1.data.id)
  .eq('user_id', b.id)
  .select();
check('B changes the reaction', rows(rUpd).length === 1);
const withReact = (await messagesOf(a, t1)).find((m) => m.id === m1.data.id);
check('reactions embedded', withReact?.reactions?.[0]?.emoji === '😂');
check(
  'E sees no reactions',
  rows(await e.client.from('message_reactions').select('*')).length === 0,
);

const reply = await send(b, t1, { body: 'hi A', reply_to_id: m1.data.id });
check('B replies to a message', !reply.error);
const replyRow = (await messagesOf(a, t1)).find((m) => m.id === reply.data?.id);
check('reply preview embedded', replyRow?.reply_to?.id === m1.data.id);

const ed = await a.client.rpc('edit_message', { p_message: m1.data.id, p_body: 'hey B!' });
check('A edits own message', !ed.error);
const edited = (await messagesOf(b, t1)).find((m) => m.id === m1.data.id);
check('edit visible with edited_at', edited?.body === 'hey B!' && !!edited.edited_at);
const edB = await b.client.rpc('edit_message', { p_message: m1.data.id, p_body: 'hacked' });
check("B can't edit A's message", !!edB.error);

const pins = [];
for (let i = 0; i < 4; i++) {
  const m = await send(a, t1, { body: `pin me ${i}` });
  pins.push(m.data.id);
}
for (let i = 0; i < 3; i++)
  await b.client.rpc('pin_message', { p_message: pins[i], p_pinned: true });
const pin4 = await b.client.rpc('pin_message', { p_message: pins[3], p_pinned: true });
check('max 3 pinned messages', !!pin4.error);
const pinned = await messagesOf(a, t1, { p_filter: 'pinned' });
check('pinned filter lists 3', pinned.length === 3);
const pinE = await e.client.rpc('pin_message', { p_message: pins[3], p_pinned: true });
check("E can't pin", !!pinE.error);

const last = await send(a, t1, { body: 'oops' });
const unsendB = await b.client.from('messages').delete().eq('id', last.data.id).select();
check("B can't unsend A's message", rows(unsendB).length === 0);
const unsend = await a.client.from('messages').delete().eq('id', last.data.id).select();
check('A unsends', rows(unsend).length === 1);
const rowAfterUnsend = (await inbox(b)).find((t) => t.id === t1);
check(
  'inbox preview falls back to the previous message',
  rowAfterUnsend?.last_message?.body !== 'oops',
);

const search = await messagesOf(b, t1, { p_query: 'pin me 2' });
check('search in conversation', search.length === 1);

// ---- Media + view once + voice ----
const mediaId = randomUUID();
const mediaPath = await upload(a, t1, mediaId);
const media = await a.client
  .from('messages')
  .insert({
    id: mediaId,
    thread_id: t1,
    kind: 'media',
    media_type: 'image',
    media_path: mediaPath,
    width: 1080,
    height: 1350,
  })
  .select()
  .single();
check('A sends a photo', !media.error, media.error?.message);
check('B downloads it', await canDownload(b, mediaPath));
check("E can't download it", !(await canDownload(e, mediaPath)));
const eUp = await e.client.storage
  .from('messages')
  .upload(`${t1}/${randomUUID()}.jpg`, JPEG, { contentType: 'image/jpeg' });
check("E can't upload into the thread folder", !!eUp.error);
check('shared media filter', (await messagesOf(b, t1, { p_filter: 'media' })).length === 1);

const wrongId = randomUUID();
const wrongPath = await upload(a, t1, randomUUID());
const wrong = await a.client.from('messages').insert({
  id: wrongId,
  thread_id: t1,
  kind: 'media',
  media_type: 'image',
  media_path: wrongPath,
  width: 10,
  height: 10,
});
check('media path must match the message id', !!wrong.error);
const missingId = randomUUID();
const missing = await a.client.from('messages').insert({
  id: missingId,
  thread_id: t1,
  kind: 'media',
  media_type: 'image',
  media_path: `${t1}/${missingId}.jpg`,
  width: 10,
  height: 10,
});
check('media file must exist', !!missing.error);

const onceId = randomUUID();
const oncePath = await upload(a, t1, onceId);
const once = await a.client.from('messages').insert({
  id: onceId,
  thread_id: t1,
  kind: 'media',
  media_type: 'image',
  media_path: oncePath,
  width: 1080,
  height: 1920,
  view_mode: 'once',
});
check('A sends a view-once photo', !once.error, once.error?.message);
check('not downloadable before opening', !(await canDownload(b, oncePath)));
const open1 = await b.client.rpc('open_message_media', { p_message: onceId });
check('B opens it', open1.data === true);
check('downloadable right after opening', await canDownload(b, oncePath));
const open2 = await b.client.rpc('open_message_media', { p_message: onceId });
check("can't open view-once twice", open2.data === false);
const shot = await b.client.rpc('note_screenshot', { p_thread: t1, p_message: onceId });
check('screenshot noted', !shot.error);
const senderView = (await messagesOf(a, t1)).find((m) => m.id === onceId);
check(
  'sender sees opened + screenshot',
  senderView?.views?.[0]?.view_count === 1 && !!senderView.views[0].screenshot_at,
);
check(
  'view-once not in shared media',
  (await messagesOf(b, t1, { p_filter: 'media' })).length === 1,
);

const voiceId = randomUUID();
const voicePath = await upload(a, t1, voiceId, 'm4a', M4A, 'audio/mp4');
const voice = await a.client.from('messages').insert({
  id: voiceId,
  thread_id: t1,
  kind: 'voice',
  media_type: 'audio',
  media_path: voicePath,
  duration_ms: 4200,
  waveform: [0.1, 0.5, 0.9, 0.3],
});
check('A sends a voice message', !voice.error, voice.error?.message);
const longVoiceId = randomUUID();
const longVoice = await a.client.from('messages').insert({
  id: longVoiceId,
  thread_id: t1,
  kind: 'voice',
  media_type: 'audio',
  media_path: await upload(a, t1, longVoiceId, 'm4a', M4A, 'audio/mp4'),
  duration_ms: 301000,
});
check('voice messages ≤ 5 min', !!longVoice.error);

// ---- Shared content ----
const postA = await makePost(a, 'shared post');
const sharePost = await a.client
  .from('messages')
  .insert({ thread_id: t1, kind: 'post', post_id: postA });
check('A shares a post', !sharePost.error, sharePost.error?.message);
check('posts filter', (await messagesOf(b, t1, { p_filter: 'posts' })).length === 1);
const privPost = await (async () => {
  await e.client.from('profiles').update({ is_private: true }).eq('id', e.id);
  return makePost(e, 'private');
})();
const shareInvisible = await a.client
  .from('messages')
  .insert({ thread_id: t1, kind: 'post', post_id: privPost });
check("can't share a post you can't see", !!shareInvisible.error);
const shareProfile = await a.client
  .from('messages')
  .insert({ thread_id: t1, kind: 'profile', profile_id: e.id });
check('share a profile', !shareProfile.error);
const mixed = await a.client
  .from('messages')
  .insert({ thread_id: t1, kind: 'text', body: 'x', post_id: postA });
check('kind/columns must match', !!mixed.error);

// ---- Story replies land in DMs ----
const storyA = await makeStory(a);
const sr = await b.client
  .from('story_replies')
  .insert({ story_id: storyA, body: '🔥', is_reaction: true });
check('B reacts to A story', !sr.error, sr.error?.message);
const storyMsg = (await messagesOf(a, t1)).find((m) => m.story?.id === storyA);
check(
  'story reaction appears in the A–B chat',
  storyMsg?.data?.story_reply === true && storyMsg.data.reaction === true,
);
check('story preview embedded', storyMsg?.story?.visible === true);

// ---- Message requests ----
const t2 = (await c.client.rpc('get_or_create_direct', { p_other: a.id })).data;
const req1 = await send(c, t2, { body: 'hello stranger' });
check('C sends a request', !req1.error, req1.error?.message);
const req2 = await send(c, t2, { body: 'second' });
check('second message blocked until accepted', req2.error?.message?.includes('request_pending'));
const reqPost = await c.client
  .from('messages')
  .insert({ thread_id: t2, kind: 'profile', profile_id: c.id });
check('requests are text-only', !!reqPost.error);
check('request not in A inbox', !(await inbox(a)).some((t) => t.id === t2));
check(
  'request in A requests',
  (await inbox(a, 'requests')).some((t) => t.id === t2),
);
check('badge counts requests', (await badge(a))?.requests >= 1);
check('C sees pending state', (await info(c, t2))?.request_pending === true);
await a.client.rpc('mark_thread_read', { p_thread: t2 });
const cInfo = await info(c, t2);
check(
  'no seen time while pending',
  cInfo?.members.find((m) => m.id === a.id)?.last_read_at === null,
);
const reactReq = await a.client
  .from('message_reactions')
  .insert({ message_id: req1.data.id, emoji: '❤️' });
check("can't react before accepting", !!reactReq.error);
await a.client.rpc('accept_thread', { p_thread: t2 });
check(
  'accepted → inbox',
  (await inbox(a)).some((t) => t.id === t2),
);
const req3 = await send(c, t2, { body: 'thanks!' });
check('C can keep chatting after accept', !req3.error);

const t3 = (await d.client.rpc('get_or_create_direct', { p_other: a.id })).data;
await send(d, t3, { body: 'get FREE FOLLOWERS now' });
check(
  'flagged request → hidden',
  (await inbox(a, 'hidden')).some((t) => t.id === t3),
);
check('not in normal requests', !(await inbox(a, 'requests')).some((t) => t.id === t3));
const cleared = await a.client.rpc('clear_requests', { p_hidden: true });
check('delete all hidden requests', cleared.data >= 1);
check('hidden folder empty', (await inbox(a, 'hidden')).length === 0);

const t4 = (await e.client.rpc('get_or_create_direct', { p_other: a.id })).data;
await send(e, t4, { body: 'hi from E' });
const replyAccept = await send(a, t4, { body: 'hi E' });
check(
  'replying to a request accepts it',
  !replyAccept.error && (await inbox(a)).some((t) => t.id === t4),
);

// ---- Chat list state ----
const pinIds = [t1, t2, t4];
for (const t of pinIds) {
  await a.client
    .from('thread_members')
    .update({ pinned_at: new Date().toISOString() })
    .eq('thread_id', t)
    .eq('user_id', a.id);
}
const t5 = (await a.client.rpc('get_or_create_direct', { p_other: d.id })).data;
await send(a, t5, { body: 'hi D' });
const pin4c = await a.client
  .from('thread_members')
  .update({ pinned_at: new Date().toISOString() })
  .eq('thread_id', t5)
  .eq('user_id', a.id);
check('max 3 pinned chats', !!pin4c.error);
const aInbox = await inbox(a);
check(
  'pinned chats first',
  aInbox.slice(0, 3).every((t) => !!t.pinned_at),
);
await a.client
  .from('thread_members')
  .update({ muted_until: '2999-01-01T00:00:00Z', marked_unread: true })
  .eq('thread_id', t5)
  .eq('user_id', a.id);
const mutedRow = (await inbox(a)).find((t) => t.id === t5);
check('muted + marked unread', mutedRow?.muted === true && mutedRow.unread === true);
const badgeMuted = (await badge(a))?.unread;
await a.client.rpc('clear_thread', { p_thread: t5 });
check('delete chat hides it', !(await inbox(a)).some((t) => t.id === t5));
check('cleared messages hidden for me', (await messagesOf(a, t5)).length === 0);
check('…but not for D', (await messagesOf(d, t5)).length >= 1);
check('muted chats not in the badge', typeof badgeMuted === 'number');
const share = rows(await a.client.rpc('share_suggestions', { p_query: null, p_limit: 20 }));
check(
  'share suggestions list recent chats',
  share.some((s) => s.thread_id === t1),
);

// ---- Groups ----
const g = await a.client.rpc('create_group_thread', {
  p_members: [b.id, c.id, d.id],
  p_title: 'Trip',
});
check('A creates a group', !g.error, g.error?.message);
const gid = g.data;
const tooFew = await a.client.rpc('create_group_thread', { p_members: [b.id] });
check('groups need 2+ others', !!tooFew.error);
const gInfo = await info(a, gid);
check('creator is admin', gInfo?.me.role === 'admin');
check(
  'members who follow A are active, others requests',
  gInfo?.members.find((m) => m.id === b.id)?.status === 'active' &&
    gInfo?.members.find((m) => m.id === d.id)?.status === 'request',
);
check(
  'group in D requests',
  (await inbox(d, 'requests')).some((t) => t.id === gid),
);
const gm1 = await send(a, gid, { body: 'welcome' });
check('group message', !gm1.error);
check('E cannot read the group', (await messagesOf(e, gid)).length === 0);
const renameB = await b.client.rpc('rename_thread', { p_thread: gid, p_title: 'Trip 2026' });
check('members can rename', !renameB.error);
const theme = await b.client.rpc('set_thread_theme', { p_thread: gid, p_theme: 'ocean' });
check('members can change the theme', !theme.error);
const badTheme = await b.client.rpc('set_thread_theme', { p_thread: gid, p_theme: 'neon' });
check('unknown theme rejected', !!badTheme.error);
const nick = await b.client.rpc('set_nickname', {
  p_thread: gid,
  p_user: a.id,
  p_nickname: 'Boss',
});
check('nicknames', !nick.error);
const sysLines = (await messagesOf(a, gid))
  .filter((m) => m.kind === 'system')
  .map((m) => m.data.event);
check(
  'system lines for created / renamed / theme / nickname',
  ['created', 'renamed', 'theme', 'nickname'].every((ev) => sysLines.includes(ev)),
  sysLines.join(','),
);
const removeByB = await b.client.rpc('remove_thread_member', { p_thread: gid, p_user: d.id });
check("non-admins can't remove", !!removeByB.error);
const removeD = await a.client.rpc('remove_thread_member', { p_thread: gid, p_user: d.id });
check('admin removes D', !removeD.error);
const afterRemove = await send(a, gid, { body: 'after D left' });
const dMsgs = await messagesOf(d, gid);
check(
  'D keeps history up to removal only',
  dMsgs.some((m) => m.id === gm1.data.id) && !dMsgs.some((m) => m.id === afterRemove.data.id),
);
const dSend = await send(d, gid, { body: 'still here?' });
check("removed member can't send", !!dSend.error);

const appr = await a.client.rpc('set_thread_approval', { p_thread: gid, p_on: true });
check('admin turns on approval', !appr.error);
await c.client.rpc('accept_thread', { p_thread: gid });
const addE = await c.client.rpc('add_thread_members', { p_thread: gid, p_members: [e.id] });
check('member add → needs approval', addE.data === 'requested', JSON.stringify(addE));
const jr = rows(await a.client.rpc('thread_join_request_list', { p_thread: gid }));
check(
  'admin sees the join request',
  jr.some((r) => r.user_id === e.id),
);
const jrB = rows(await b.client.rpc('thread_join_request_list', { p_thread: gid }));
check('non-admins do not', jrB.length === 0);
await a.client.rpc('answer_join_request', { p_thread: gid, p_user: e.id, p_approve: true });
const eGroup = await messagesOf(e, gid);
check(
  'E joins and sees only new messages',
  eGroup.length > 0 && !eGroup.some((m) => m.id === gm1.data.id),
);

const token = (await a.client.rpc('create_thread_invite', { p_thread: gid })).data;
check('admin creates an invite link', typeof token === 'string' && token.length >= 20);
const tokenB = await b.client.rpc('create_thread_invite', { p_thread: gid });
check("non-admins can't create links", !!tokenB.error);
const preview = (await d.client.rpc('thread_invite_preview', { p_token: token })).data;
check(
  'invite preview for outsiders',
  preview?.title === 'Trip 2026' && preview.my_status === 'left',
);
await a.client.rpc('set_thread_approval', { p_on: false, p_thread: gid });
const join = (await d.client.rpc('join_thread_by_invite', { p_token: token })).data;
check('D rejoins via the link', join?.status === 'joined', JSON.stringify(join));
await a.client.rpc('disable_thread_invite', { p_thread: gid });
const dead = await e.client.rpc('join_thread_by_invite', { p_token: token });
check('disabled link stops working', !!dead.error);

const leave = await a.client.rpc('leave_thread', { p_thread: gid });
check('A leaves', !leave.error);
const gInfoB = await info(b, gid);
check(
  'oldest active member becomes admin',
  gInfoB?.members.find((m) => m.id === b.id)?.role === 'admin',
);
const aLeftRow = (await inbox(a)).find((t) => t.id === gid);
check('left group stays in A inbox as left', aLeftRow?.my_status === 'left');
const leaveDirect = await b.client.rpc('leave_thread', { p_thread: t1 });
check("can't leave a 1:1 chat", !!leaveDirect.error);

// ---- Vanish mode ----
const vGroup = await b.client.rpc('set_vanish_mode', { p_thread: gid, p_on: true });
check('no vanish mode in groups', !!vGroup.error);
const vOn = await b.client.rpc('set_vanish_mode', { p_thread: t1, p_on: true });
check('vanish mode on', !vOn.error, vOn.error?.message);
const vm = await send(b, t1, { body: 'poof' });
check('vanish message flagged', vm.data?.vanish === true);
const vEdit = await b.client.rpc('edit_message', { p_message: vm.data.id, p_body: 'x' });
check("vanish messages can't be edited", !!vEdit.error);
await b.client.rpc('end_vanish_session', { p_thread: t1 });
check(
  'unseen vanish message survives',
  (await messagesOf(a, t1)).some((m) => m.id === vm.data.id),
);
await a.client.rpc('mark_thread_read', { p_thread: t1 });
await a.client.rpc('end_vanish_session', { p_thread: t1 });
check(
  'seen vanish message disappears',
  !(await messagesOf(b, t1)).some((m) => m.id === vm.data.id),
);
await b.client.rpc('set_vanish_mode', { p_thread: t1, p_on: false });
const vOff = await send(b, t1, { body: 'normal' });
check('vanish off → normal messages', vOff.data?.vanish === false);

// ---- Scheduled messages ----
const tooSoon = await send(a, t1, { body: 'now', scheduled_for: new Date().toISOString() });
check('schedule must be in the future', !!tooSoon.error);
const when = new Date(Date.now() + 35_000).toISOString();
const sched = await send(a, t1, { body: 'later', scheduled_for: when });
check('A schedules a message', !sched.error, sched.error?.message);
check('B does not see it yet', !(await messagesOf(b, t1)).some((m) => m.id === sched.data?.id));
check('A sees it in scheduled', (await messagesOf(a, t1, { p_filter: 'scheduled' })).length === 1);
const schedMedia = await a.client
  .from('messages')
  .insert({ thread_id: t1, kind: 'profile', profile_id: c.id, scheduled_for: when });
check('only text can be scheduled', !!schedMedia.error);
if (WAIT_CRON) {
  let delivered = false;
  for (let i = 0; i < 20 && !delivered; i++) {
    await sleep(5000);
    delivered = (await messagesOf(b, t1)).some((m) => m.id === sched.data?.id);
  }
  check('pg_cron delivers it', delivered);
}

// ---- Notes ----
await a.client.rpc('follow_user', { target: b.id });
const note = await a.client.from('notes').insert({ body: 'coffee anyone?' }).select().single();
check('A posts a note', !note.error, note.error?.message);
const long = await a.client.from('notes').insert({ body: 'x'.repeat(61) });
check('notes ≤ 60 chars', !!long.error);
const bNotes = rows(await b.client.rpc('notes_tray'));
check(
  'mutual B sees the note',
  bNotes.some((n) => n.id === note.data.id),
);
const cNotes = rows(await c.client.rpc('notes_tray'));
check('non-mutual C does not', !cNotes.some((n) => n.id === note.data.id));
const like = await b.client.from('note_likes').insert({ note_id: note.data.id });
check('B likes the note', !like.error);
const likeC = await c.client.from('note_likes').insert({ note_id: note.data.id });
check("C can't like an invisible note", !!likeC.error);
const likers = rows(await a.client.rpc('note_likers', { p_note: note.data.id }));
check(
  'A sees who liked',
  likers.some((l) => l.user_id === b.id),
);
check(
  'like count only for the author',
  bNotes.find((n) => n.id === note.data.id)?.like_count === null,
);
const noteReply = await send(b, t1, { body: 'me!', note_id: note.data.id });
check(
  'B replies to the note in DMs',
  !noteReply.error && noteReply.data?.data?.note?.body === 'coffee anyone?',
);
await a.client.from('close_friends').insert({ owner_id: a.id, friend_id: c.id });
const cf = await a.client
  .from('notes')
  .insert({ body: 'CF only', audience: 'close_friends' })
  .select()
  .single();
const aNotes = rows(await a.client.from('notes').select('id'));
check('one active note per person', aNotes.length === 1 && aNotes[0].id === cf.data.id);
check(
  'Close Friends see CF notes',
  rows(await c.client.rpc('notes_tray')).some((n) => n.id === cf.data.id),
);
check('others do not', !rows(await b.client.rpc('notes_tray')).some((n) => n.id === cf.data.id));
const delNote = await b.client.from('notes').delete().eq('id', cf.data.id).select();
check("can't delete someone else's note", rows(delNote).length === 0);

// ---- Presence ----
await a.client.rpc('touch_presence');
await b.client.rpc('touch_presence');
await e.client.rpc('touch_presence');
const pB = rows(await b.client.rpc('presence_of', { p_users: [a.id] }));
check('B sees A active status', pB.length === 1);
const pX = rows(await d.client.rpc('presence_of', { p_users: [b.id] }));
check('strangers do not', pX.length === 0);

// ---- Reports ----
const rep = await b.client
  .from('reports')
  .insert({ target_type: 'message', target_id: m1.data.id, reason: 'scam_spam' });
check('B reports a message', !rep.error, rep.error?.message);
const repSelf = await a.client
  .from('reports')
  .insert({ target_type: 'message', target_id: m1.data.id, reason: 'scam_spam' });
check("can't report your own message", !!repSelf.error);
const repE = await e.client
  .from('reports')
  .insert({ target_type: 'message', target_id: m1.data.id, reason: 'scam_spam' });
check("can't report unreadable messages", !!repE.error);
const repG = await e.client
  .from('reports')
  .insert({ target_type: 'thread', target_id: gid, reason: 'scam_spam' });
check('members report a group', !repG.error, repG.error?.message);

// ---- Realtime (private topics) ----
async function subscribe(user, topic, onEvent) {
  await user.client.realtime.setAuth(
    (await user.client.auth.getSession()).data.session.access_token,
  );
  return new Promise((resolve) => {
    const ch = user.client
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: '*' }, (p) => onEvent?.(p))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve({ ch, ok: true });
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve({ ch, ok: false });
      });
  });
}
const got = [];
const subB = await subscribe(b, `thread:${t1}`, (p) => got.push(p));
check('B joins the thread topic', subB.ok);
const subE = await subscribe(e, `thread:${t1}`);
check("E can't join it", !subE.ok);
const inboxGot = [];
const subInbox = await subscribe(b, `inbox:${b.id}`, (p) => inboxGot.push(p));
check('B joins own inbox topic', subInbox.ok);
const subInboxE = await subscribe(e, `inbox:${b.id}`);
check("E can't join B's inbox topic", !subInboxE.ok);
const live = await send(a, t1, { body: 'realtime ping' });
for (let i = 0; i < 20 && !got.some((p) => p.payload?.message_id === live.data?.id); i++)
  await sleep(250);
check(
  'B gets the message event',
  got.some((p) => p.event === 'message' && p.payload.message_id === live.data?.id),
);
check(
  '…and the inbox event',
  inboxGot.some((p) => p.payload?.message_id === live.data?.id),
);
for (const s of [subB, subE, subInbox, subInboxE]) await s.ch.unsubscribe();

// ---- Purge + anon ----
const purge = rows(await a.client.rpc('my_purgeable_message_files'));
check(
  'purge lists only own files',
  purge.every((p) => p.startsWith(t1) || p.includes('/')),
);
const anon = createClient(url, key, opts);
const anonInbox = await anon.rpc('inbox_threads', {});
check('anon blocked', !!anonInbox.error);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
