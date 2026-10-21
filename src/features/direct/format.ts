import { PUBLIC_WEB_ORIGIN } from '@/features/profile/format';

import type {
  InboxThread,
  LastMessage,
  Message,
  ThemeKey,
  ThreadInfo,
  ThreadMember,
  ThreadPerson,
} from './api';

/** Name shown for a person inside a chat: nickname, else username. */
export function memberName(p: Pick<ThreadPerson, 'username' | 'nickname'> | undefined | null) {
  return p?.nickname || p?.username || 'Instagram User';
}

/** Chat title: group name, member names ("Ana, Ben and 3 others"), or the other person. */
export function threadTitle(t: {
  kind: 'direct' | 'group';
  title: string | null;
  members: ThreadPerson[];
  member_count?: number;
}) {
  if (t.title) return t.title;
  if (t.kind === 'direct') {
    const other = t.members[0];
    return other ? other.full_name || other.username : 'Instagram User';
  }
  const names = t.members.map((m) => m.nickname || m.username);
  const others = (t.member_count ?? names.length + 1) - 1;
  if (names.length === 0) return 'Group';
  if (others <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} and ${others - 2} others`;
}

export function infoTitle(info: ThreadInfo, me: string) {
  const others = info.members.filter((m) => m.id !== me && m.status !== 'left');
  return threadTitle({
    kind: info.kind,
    title: info.title,
    members: others.map((m) => ({ ...m, nickname: m.nickname })),
    member_count: others.length + 1,
  });
}

/** "now", "5m", "2h", "3d", "4w" — inbox / note ages. */
export function shortTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (7 * 86400))}w`;
}

/** Active status line: "Active now", "Active 12m ago" (hidden after a day, like Instagram). */
export function activeText(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const s = (now - new Date(iso).getTime()) / 1000;
  if (s < 5 * 60) return 'Active now';
  if (s < 3600) return `Active ${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `Active ${Math.floor(s / 3600)}h ago`;
  return null;
}

export const isActiveNow = (iso: string | null | undefined) =>
  !!iso && Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;

/** Centered separator between message runs ("Today 14:05", "Mon 09:12", "12 Mar 2026"). */
export function separatorTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return `Today ${time}`;
  if (d.getTime() >= startOfToday - 86400000) return `Yesterday ${time}`;
  if (d.getTime() >= startOfToday - 6 * 86400000)
    return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} ${time}`;
}

const mediaWord = (m: Pick<LastMessage, 'media_type' | 'view_mode'>) =>
  m.media_type === 'video' ? 'video' : 'photo';

/** Inbox preview line for the last message (page 74). */
export function previewText(
  t: Pick<InboxThread, 'kind' | 'members' | 'unread_count'>,
  m: LastMessage | null,
  me: string,
  names: Record<string, string> = {},
) {
  if (!m) return '';
  if (t.unread_count && t.unread_count > 1)
    return t.unread_count >= 5 ? '4+ new messages' : `${t.unread_count} new messages`;
  const mine = m.sender_id === me;
  const who = mine ? 'You' : t.kind === 'group' ? (names[m.sender_id] ?? 'Someone') : null;
  const lead = (s: string) => (who ? `${who}: ${s}` : s);
  const sent = (s: string) => (who ? `${who} sent ${s}` : `Sent ${s}`);
  if (m.vanish) return lead('Sent a message in vanish mode');
  switch (m.kind) {
    case 'text':
      if (m.story_reply)
        return m.data?.reaction
          ? `${mine ? 'You reacted' : 'Reacted'} ${m.body ?? ''} to ${mine ? 'their' : 'your'} story`
          : mine
            ? `You replied to their story`
            : `Replied to your story`;
      return lead(m.body ?? '');
    case 'media':
      return m.view_mode === 'keep'
        ? sent(`a ${mediaWord(m)}`)
        : sent(`a ${m.view_mode === 'once' ? 'view-once ' : ''}${mediaWord(m)}`);
    case 'voice':
      return sent('a voice message');
    case 'post':
      return sent(m.post_kind === 'reel' ? 'a reel' : 'a post');
    case 'story':
      return sent('a story');
    case 'profile':
      return sent('a profile');
    case 'audio':
      return sent('audio');
    case 'system':
      return systemText(m.data, m.sender_id, me, names);
  }
}

/** System line text ("Ana named the group Trip", "You turned on vanish mode"). */
export function systemText(
  data: Message['data'],
  actorId: string,
  me: string,
  names: Record<string, string>,
) {
  const actor = actorId === me ? 'You' : (names[actorId] ?? 'Someone');
  const people = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => (id === me ? 'you' : (names[id] ?? 'someone'))).join(', ');
  switch (data.event) {
    case 'created':
      return `${actor} created the group.`;
    case 'renamed':
      return data.title
        ? `${actor} named the group ${data.title}.`
        : `${actor} removed the group name.`;
    case 'photo':
      return data.removed
        ? `${actor} removed the group photo.`
        : `${actor} changed the group photo.`;
    case 'theme':
      return `${actor} changed the theme to ${THEMES[data.theme ?? 'default']?.label ?? 'Default'}.`;
    case 'added':
      return `${actor} added ${people(data.user_ids)}.`;
    case 'removed':
      return `${actor} removed ${people(data.user_ids)}.`;
    case 'left':
      return `${actor} left the group.`;
    case 'joined':
      return `${actor} joined the group via invite link.`;
    case 'admin':
      return data.admin
        ? `${actor} made ${people(data.user_ids)} an admin.`
        : `${actor} removed ${people(data.user_ids)} as an admin.`;
    case 'nickname':
      return data.nickname
        ? `${actor} set the nickname for ${people(data.user_ids)} to ${data.nickname}.`
        : `${actor} cleared the nickname for ${people(data.user_ids)}.`;
    case 'vanish_on':
      return `${actor} turned on vanish mode. Seen messages will disappear when you leave the chat.`;
    case 'vanish_off':
      return `${actor} turned off vanish mode.`;
    case 'pinned':
      return `${actor} pinned a message.`;
    case 'approval':
      return data.on
        ? `${actor} turned on member approval. Admins must approve new members.`
        : `${actor} turned off member approval.`;
    case 'screenshot':
      return `${actor} took a screenshot.`;
    default:
      return '';
  }
}

export function namesOf(
  members: (Pick<ThreadMember, 'id' | 'username' | 'nickname'> | ThreadPerson)[],
) {
  return Object.fromEntries(members.map((m) => [m.id, m.nickname || m.username]));
}

/** "Seen", "Seen just now", "Seen by Ana, Ben" under my last message. */
export function seenText(info: ThreadInfo, me: string, at: string) {
  const readers = info.members.filter((m) => m.id !== me && m.last_read_at && m.last_read_at >= at);
  if (readers.length === 0) return null;
  if (info.kind === 'direct') {
    const when = Date.now() - new Date(readers[0].last_read_at!).getTime();
    return when < 60_000 ? 'Seen just now' : `Seen ${shortTime(readers[0].last_read_at)} ago`;
  }
  const others = info.members.filter((m) => m.id !== me && m.status === 'active');
  if (readers.length === others.length) return 'Seen by everyone';
  return `Seen by ${readers.map((r) => r.nickname || r.username).join(', ')}`;
}

/** Chat themes (page 79): own-bubble gradient + accent. */
export const THEMES: Record<ThemeKey, { label: string; colors: [string, string]; accent: string }> =
  {
    default: { label: 'Default', colors: ['#7C3AED', '#3797F0'], accent: '#3797F0' },
    berry: { label: 'Berry', colors: ['#C2185B', '#7B1FA2'], accent: '#C2185B' },
    ocean: { label: 'Ocean', colors: ['#00B4DB', '#0083B0'], accent: '#0083B0' },
    sunset: { label: 'Sunset', colors: ['#FF7E5F', '#FEB47B'], accent: '#FF7E5F' },
    forest: { label: 'Forest', colors: ['#2E7D32', '#66BB6A'], accent: '#2E7D32' },
    lavender: { label: 'Lavender', colors: ['#8E7CC3', '#B39DDB'], accent: '#8E7CC3' },
    candy: { label: 'Candy', colors: ['#FF5F9E', '#FFA6C9'], accent: '#FF5F9E' },
    midnight: { label: 'Midnight', colors: ['#232526', '#414345'], accent: '#5C6BC0' },
    fire: { label: 'Fire', colors: ['#F12711', '#F5AF19'], accent: '#F12711' },
    mono: { label: 'Monochrome', colors: ['#3A3A3A', '#3A3A3A'], accent: '#3A3A3A' },
  };

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

export const inviteUrl = (token: string) => `${PUBLIC_WEB_ORIGIN}/direct/join/${token}`;

/** Instagram-style "Mute" durations. */
export const MUTE_OPTIONS: { label: string; ms: number | null }[] = [
  { label: 'For 15 minutes', ms: 15 * 60 * 1000 },
  { label: 'For 1 hour', ms: 60 * 60 * 1000 },
  { label: 'For 8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: 'For 24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: 'Until I change it', ms: null },
];

export const muteUntil = (ms: number | null) =>
  ms === null ? '2999-12-31T00:00:00Z' : new Date(Date.now() + ms).toISOString();

export const isMuted = (until: string | null | undefined) =>
  !!until && new Date(until).getTime() > Date.now();

/** Whether an ISO time is more than `ms` ago. */
export function olderThan(iso: string, ms: number, now = Date.now()) {
  return now - new Date(iso).getTime() > ms;
}

/** Emoji-only messages (≤3 emoji) render large without a bubble. */
export function isBigEmoji(body: string | null) {
  if (!body || body.length > 12 || /[0-9A-Za-z#*]/.test(body)) return false;
  return (
    /\p{Extended_Pictographic}/u.test(body) &&
    /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(body)
  );
}

export const linkPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
