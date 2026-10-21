import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';

import { BUCKETS, getSignedUrls, removeFiles, SIGNED_URL_TTL, uploadFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Fn = Database['public']['Functions'];

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type Folder = 'inbox' | 'requests' | 'hidden';
export type MemberStatus = 'active' | 'request' | 'hidden' | 'left';

export type ThreadPerson = {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  nickname: string | null;
};

export type LastMessage = {
  id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  media_type: 'image' | 'video' | 'audio' | null;
  view_mode: ViewMode;
  vanish: boolean;
  data: MessageData;
  story_reply: boolean;
  post_kind: 'post' | 'reel' | null;
  created_at: string;
};

export type InboxThread = Omit<
  Fn['inbox_threads']['Returns'][number],
  'members' | 'last_message' | 'kind' | 'my_status' | 'my_role'
> & {
  kind: 'direct' | 'group';
  my_status: MemberStatus;
  my_role: 'admin' | 'member';
  members: ThreadPerson[];
  last_message: LastMessage | null;
};

export type ThreadMember = {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  is_private: boolean;
  followers_count: number;
  posts_count: number;
  role: 'admin' | 'member';
  status: MemberStatus;
  nickname: string | null;
  joined_at: string;
  last_read_at: string | null;
  last_active_at: string | null;
  i_follow: boolean;
  follows_me: boolean;
};

export type ThreadInfo = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  photo_path: string | null;
  theme: ThemeKey;
  approval_required: boolean;
  vanish_mode: boolean;
  invite_token: string | null;
  created_at: string;
  has_messages: boolean;
  me: {
    status: MemberStatus;
    role: 'admin' | 'member';
    read_receipts: boolean;
    muted_until: string | null;
    pinned_at: string | null;
    nickname: string | null;
    joined_at: string;
    left_at: string | null;
    marked_unread: boolean;
  };
  members: ThreadMember[];
  request_pending: boolean;
  my_message_count: number;
  pinned_count: number;
  scheduled_count: number;
  join_request_count: number | null;
};

export type MessageKind =
  'text' | 'media' | 'voice' | 'post' | 'story' | 'profile' | 'audio' | 'system';
export type ViewMode = 'keep' | 'once' | 'replay';

export type SystemEvent =
  | 'created'
  | 'renamed'
  | 'photo'
  | 'theme'
  | 'added'
  | 'removed'
  | 'left'
  | 'joined'
  | 'admin'
  | 'nickname'
  | 'vanish_on'
  | 'vanish_off'
  | 'pinned'
  | 'approval'
  | 'screenshot';

export type MessageData = {
  event?: SystemEvent;
  user_ids?: string[];
  title?: string | null;
  theme?: ThemeKey;
  nickname?: string | null;
  admin?: boolean;
  on?: boolean;
  removed?: boolean;
  message_id?: string;
  story_reply?: boolean;
  reaction?: boolean;
  note?: { body: string | null; author_id: string; audio: string | null };
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  reply_to: {
    id: string;
    sender_id: string;
    kind: MessageKind;
    body: string | null;
    media_type: string | null;
    view_mode: ViewMode;
    media_path: string | null;
    thumb_path: string | null;
    post_id: string | null;
  } | null;
  post_id: string | null;
  story: {
    id: string;
    visible: boolean;
    author_id?: string;
    kind?: string;
    thumb_path?: string | null;
    active?: boolean;
  } | null;
  profile: {
    id: string;
    username: string;
    full_name: string;
    avatar_path: string | null;
    is_private: boolean;
    followers_count: number;
    posts_count: number;
  } | null;
  audio: {
    id: string;
    title?: string;
    artist?: string | null;
    source?: string;
    cover_color?: string | null;
    audio_path?: string | null;
    owner_username?: string | null;
    unavailable?: boolean;
  } | null;
  media_type: 'image' | 'video' | 'audio' | null;
  media_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  waveform: number[] | null;
  view_mode: ViewMode;
  data: MessageData;
  vanish: boolean;
  pinned_at: string | null;
  edited_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  reactions: { user_id: string; emoji: string }[];
  views: { user_id: string; view_count: number; screenshot_at: string | null }[] | null;
  /** Signed URLs (messages bucket for media / voice, stories bucket for story previews). */
  mediaUrl: string | null;
  thumbUrl: string | null;
  storyUrl: string | null;
  replyThumbUrl: string | null;
};

export type ThemeKey =
  | 'default'
  | 'berry'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'lavender'
  | 'candy'
  | 'midnight'
  | 'fire'
  | 'mono';

export type ShareTarget = {
  thread_id: string | null;
  kind: 'direct' | 'group';
  title: string | null;
  photo_path: string | null;
  members: ThreadPerson[];
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  avatar_path: string | null;
  last_message_at: string | null;
};

export type NoteItem = Omit<Fn['notes_tray']['Returns'][number], 'audio' | 'audience'> & {
  audience: 'mutuals' | 'close_friends';
  audio: {
    id: string;
    title: string;
    artist: string | null;
    audio_path: string | null;
    cover_color: string | null;
    start_ms: number;
  } | null;
};

export type DirectBadge = { unread: number; requests: number; hidden: number };

// ---------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------

export const directKeys = {
  all: ['direct'] as const,
  inbox: (folder: Folder, query = '') => ['direct', 'inbox', folder, query] as const,
  inboxAll: ['direct', 'inbox'] as const,
  badge: ['direct', 'badge'] as const,
  info: (id: string) => ['direct', 'info', id] as const,
  messages: (id: string) => ['direct', 'messages', id] as const,
  filtered: (id: string, filter: string, query = '') =>
    ['direct', 'filtered', id, filter, query] as const,
  share: (query: string) => ['direct', 'share', query] as const,
  notes: ['direct', 'notes'] as const,
  noteLikers: (id: string) => ['direct', 'note-likers', id] as const,
  joinRequests: (id: string) => ['direct', 'join-requests', id] as const,
  invite: (token: string) => ['direct', 'invite', token] as const,
};

/** After anything that changes a thread: its info, messages and every inbox list. */
export function invalidateThread(qc: QueryClient, threadId: string) {
  void qc.invalidateQueries({ queryKey: directKeys.info(threadId) });
  void qc.invalidateQueries({ queryKey: directKeys.messages(threadId) });
  void qc.invalidateQueries({ queryKey: ['direct', 'filtered', threadId] });
  void qc.invalidateQueries({ queryKey: directKeys.inboxAll });
  void qc.invalidateQueries({ queryKey: directKeys.badge });
}

// ---------------------------------------------------------------------------------------------
// Inbox (pages 74 / 75)
// ---------------------------------------------------------------------------------------------

const INBOX_PAGE = 30;

export function useInbox(folder: Folder, query = '') {
  return useInfiniteQuery({
    queryKey: directKeys.inbox(folder, query),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('inbox_threads', {
        p_folder: folder,
        p_before: pageParam ?? undefined,
        p_limit: INBOX_PAGE,
        p_query: query || undefined,
      });
      if (error) throw error;
      return (data ?? []) as unknown as InboxThread[];
    },
    getNextPageParam: (page) => {
      const unpinned = page.filter((t) => !t.pinned_at);
      return unpinned.length >= INBOX_PAGE
        ? (unpinned[unpinned.length - 1].last_message_at ?? null)
        : null;
    },
  });
}

export function useDirectBadge(enabled = true) {
  return useQuery({
    queryKey: directKeys.badge,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('direct_badge');
      if (error) throw error;
      return data as unknown as DirectBadge;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------------------------
// Thread (pages 76 / 79)
// ---------------------------------------------------------------------------------------------

export function useThreadInfo(threadId: string | undefined) {
  return useQuery({
    queryKey: directKeys.info(threadId ?? ''),
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('thread_info', { p_thread: threadId! });
      if (error) throw error;
      return (data ?? null) as unknown as ThreadInfo | null;
    },
  });
}

type RawMessage = Omit<Message, 'mediaUrl' | 'thumbUrl' | 'storyUrl' | 'replyThumbUrl'>;

/** Sign the files a page of messages shows (kept media, posters, voice, story previews). */
async function signMessages(raw: RawMessage[]): Promise<Message[]> {
  const own = (m: RawMessage) => m.view_mode === 'keep';
  const messagePaths = raw.flatMap((m) => [
    ...(m.media_path && own(m) ? [m.media_path] : []),
    ...(m.thumb_path ? [m.thumb_path] : []),
    ...(m.reply_to?.thumb_path ? [m.reply_to.thumb_path] : []),
    ...(m.reply_to?.media_path && m.reply_to.media_type === 'image' ? [m.reply_to.media_path] : []),
  ]);
  const storyPaths = raw.flatMap((m) => (m.story?.thumb_path ? [m.story.thumb_path] : []));
  const [mUrls, sUrls] = await Promise.all([
    getSignedUrls(BUCKETS.messages, [...new Set(messagePaths)]).catch(
      () => ({}) as Record<string, string>,
    ),
    getSignedUrls(BUCKETS.stories, [...new Set(storyPaths)]).catch(
      () => ({}) as Record<string, string>,
    ),
  ]);
  return raw.map((m) => ({
    ...m,
    waveform: Array.isArray(m.waveform) ? m.waveform.map(Number) : null,
    mediaUrl: m.media_path && own(m) ? (mUrls[m.media_path] ?? null) : null,
    thumbUrl: m.thumb_path ? (mUrls[m.thumb_path] ?? null) : null,
    storyUrl: m.story?.thumb_path ? (sUrls[m.story.thumb_path] ?? null) : null,
    replyThumbUrl: m.reply_to
      ? (m.reply_to.thumb_path && mUrls[m.reply_to.thumb_path]) ||
        (m.reply_to.media_path && mUrls[m.reply_to.media_path]) ||
        null
      : null,
  }));
}

const MESSAGES_PAGE = 40;

async function fetchMessages(
  threadId: string,
  opts: { before?: string | null; filter?: string; query?: string; limit?: number } = {},
) {
  const { data, error } = await supabase.rpc('thread_messages', {
    p_thread: threadId,
    p_before: opts.before ?? undefined,
    p_limit: opts.limit ?? MESSAGES_PAGE,
    p_filter: opts.filter,
    p_query: opts.query || undefined,
  });
  if (error) throw error;
  return signMessages((data ?? []) as unknown as RawMessage[]);
}

/** Newest first; pages go back in time. */
export function useThreadMessages(threadId: string | undefined) {
  return useInfiniteQuery({
    queryKey: directKeys.messages(threadId ?? ''),
    enabled: !!threadId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchMessages(threadId!, { before: pageParam }),
    getNextPageParam: (page) =>
      page.length >= MESSAGES_PAGE ? page[page.length - 1].created_at : null,
    staleTime: (SIGNED_URL_TTL - 5 * 60) * 1000,
  });
}

export type MessageFilter = 'pinned' | 'media' | 'links' | 'posts' | 'scheduled' | 'search';

export function useFilteredMessages(
  threadId: string | undefined,
  filter: MessageFilter,
  query = '',
) {
  return useInfiniteQuery({
    queryKey: directKeys.filtered(threadId ?? '', filter, query),
    enabled: !!threadId && (filter !== 'search' || query.length > 0),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchMessages(threadId!, {
        before: pageParam,
        filter: filter === 'search' ? undefined : filter,
        query: filter === 'search' ? query : undefined,
      }),
    getNextPageParam: (page) =>
      page.length >= MESSAGES_PAGE && filter !== 'pinned' && filter !== 'scheduled'
        ? page[page.length - 1].created_at
        : null,
  });
}

/** Open (or create) the 1:1 chat with someone. */
export async function directThreadWith(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct', { p_other: userId });
  if (error) throw error;
  return data as string;
}

export async function openDirect(userId: string) {
  const id = await directThreadWith(userId);
  router.push(`/direct/t/${id}`);
}

// ---------------------------------------------------------------------------------------------
// Sending (page 76)
// ---------------------------------------------------------------------------------------------

export type Outgoing =
  | { kind: 'text'; body: string; replyTo?: string | null; noteId?: string; scheduledFor?: string }
  | { kind: 'post'; postId: string }
  | { kind: 'story'; storyId: string }
  | { kind: 'profile'; profileId: string }
  | { kind: 'audio'; audioId: string }
  | {
      kind: 'media';
      uri: string;
      mediaType: 'image' | 'video';
      width: number;
      height: number;
      durationMs?: number | null;
      posterUri?: string | null;
      mimeType?: string | null;
      viewMode?: ViewMode;
      replyTo?: string | null;
    }
  | {
      kind: 'voice';
      uri: string;
      durationMs: number;
      waveform: number[];
      mimeType?: string | null;
      replyTo?: string | null;
    };

function extOf(mime: string) {
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('mp4') && mime.startsWith('video')) return 'mp4';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.startsWith('audio')) return 'm4a';
  return 'jpg';
}

/** Upload files (if any) and insert one message. Returns the new message id. */
export async function sendMessage(threadId: string, out: Outgoing): Promise<string> {
  const id = Crypto.randomUUID();
  let row: Database['public']['Tables']['messages']['Insert'];
  if (out.kind === 'text') {
    row = {
      id,
      thread_id: threadId,
      kind: 'text',
      body: out.body,
      reply_to_id: out.replyTo ?? null,
      note_id: out.noteId ?? null,
      scheduled_for: out.scheduledFor ?? null,
    };
  } else if (out.kind === 'post') {
    row = { id, thread_id: threadId, kind: 'post', post_id: out.postId };
  } else if (out.kind === 'story') {
    row = { id, thread_id: threadId, kind: 'story', story_id: out.storyId };
  } else if (out.kind === 'profile') {
    row = { id, thread_id: threadId, kind: 'profile', profile_id: out.profileId };
  } else if (out.kind === 'audio') {
    row = { id, thread_id: threadId, kind: 'audio', audio_id: out.audioId };
  } else if (out.kind === 'media') {
    const mime = out.mimeType ?? (out.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    const path = `${threadId}/${id}.${extOf(mime)}`;
    await uploadFile(BUCKETS.messages, path, out.uri, { contentType: mime });
    let thumb: string | null = null;
    if (out.posterUri) {
      thumb = `${threadId}/${id}-thumb.jpg`;
      await uploadFile(BUCKETS.messages, thumb, out.posterUri, { contentType: 'image/jpeg' });
    }
    row = {
      id,
      thread_id: threadId,
      kind: 'media',
      media_type: out.mediaType,
      media_path: path,
      thumb_path: thumb,
      width: Math.max(1, Math.round(out.width)),
      height: Math.max(1, Math.round(out.height)),
      duration_ms: out.mediaType === 'video' ? Math.max(1, Math.round(out.durationMs ?? 1)) : null,
      view_mode: out.viewMode ?? 'keep',
      reply_to_id: out.replyTo ?? null,
    };
  } else {
    const mime = out.mimeType ?? 'audio/mp4';
    const path = `${threadId}/${id}.${extOf(mime)}`;
    await uploadFile(BUCKETS.messages, path, out.uri, { contentType: mime });
    row = {
      id,
      thread_id: threadId,
      kind: 'voice',
      media_type: 'audio',
      media_path: path,
      duration_ms: Math.round(out.durationMs),
      waveform: out.waveform,
      reply_to_id: out.replyTo ?? null,
    };
  }
  const { error } = await supabase.from('messages').insert(row);
  if (error) {
    if (row.media_path) void removeFiles(BUCKETS.messages, [row.media_path]).catch(() => {});
    throw error;
  }
  return id;
}

/** Share sheets: send the same content to several chats / people (+ an optional message). */
export async function sendToTargets(
  targets: Pick<ShareTarget, 'thread_id' | 'user_id'>[],
  content: Outgoing | null,
  note?: string,
) {
  const ids = await Promise.all(
    targets.map((t) => (t.thread_id ? Promise.resolve(t.thread_id) : directThreadWith(t.user_id!))),
  );
  await Promise.all(
    ids.map(async (threadId) => {
      if (content) await sendMessage(threadId, content);
      if (note?.trim()) await sendMessage(threadId, { kind: 'text', body: note.trim() });
    }),
  );
  return ids;
}

export function useShareTargets(query: string) {
  return useQuery({
    queryKey: directKeys.share(query),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('share_suggestions', {
        p_query: query || undefined,
        p_limit: 30,
      });
      if (error) throw error;
      return (data ?? []) as unknown as ShareTarget[];
    },
    placeholderData: (prev) => prev,
  });
}

/** Readable error codes from the database (raise exception '<code>'). */
export function directError(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (msg.includes('request_pending'))
    return 'You can send more messages after your request is accepted.';
  if (msg.includes('request_text_only')) return 'Only text can be sent until they accept.';
  if (msg.includes('pin_limit')) return 'You can only pin 3.';
  if (msg.includes('too_many_members')) return 'Groups can have up to 250 people.';
  if (msg.includes('too_few_members')) return 'Choose at least 2 people.';
  if (msg.includes('last_admin')) return 'Groups need at least one admin.';
  if (msg.includes('invalid_schedule')) return 'Choose a time between 1 minute and 29 days ahead.';
  if (msg.includes('cannot_edit')) return 'Messages can only be edited for 15 minutes.';
  if (msg.includes('invite_limit')) return 'This link has reached its daily limit.';
  if (msg.includes('invalid_invite')) return 'This invite link is no longer active.';
  if (msg.includes('not_member')) return "You're not in this chat.";
  return 'Something went wrong. Try again.';
}

// ---------------------------------------------------------------------------------------------
// Message actions
// ---------------------------------------------------------------------------------------------

export function useMessageActions(threadId: string) {
  const qc = useQueryClient();
  const refresh = () => invalidateThread(qc, threadId);
  const patch = (id: string, fn: (m: Message) => Message) =>
    qc.setQueryData<InfiniteData<Message[]>>(directKeys.messages(threadId), (d) =>
      d ? { ...d, pages: d.pages.map((p) => p.map((m) => (m.id === id ? fn(m) : m))) } : d,
    );
  const drop = (id: string) =>
    qc.setQueryData<InfiniteData<Message[]>>(directKeys.messages(threadId), (d) =>
      d ? { ...d, pages: d.pages.map((p) => p.filter((m) => m.id !== id)) } : d,
    );

  return {
    react: async (message: Message, me: string, emoji: string | null) => {
      const mine = message.reactions.find((r) => r.user_id === me);
      patch(message.id, (m) => ({
        ...m,
        reactions: [
          ...m.reactions.filter((r) => r.user_id !== me),
          ...(emoji && emoji !== mine?.emoji ? [{ user_id: me, emoji }] : []),
        ],
      }));
      const res =
        !emoji || mine?.emoji === emoji
          ? await supabase
              .from('message_reactions')
              .delete()
              .eq('message_id', message.id)
              .eq('user_id', me)
          : mine
            ? await supabase
                .from('message_reactions')
                .update({ emoji })
                .eq('message_id', message.id)
                .eq('user_id', me)
            : await supabase.from('message_reactions').insert({ message_id: message.id, emoji });
      if (res.error) {
        refresh();
        throw res.error;
      }
    },
    unsend: async (message: Message) => {
      drop(message.id);
      const { error } = await supabase.from('messages').delete().eq('id', message.id);
      if (error) {
        refresh();
        throw error;
      }
      const files = [message.media_path, message.thumb_path].filter(Boolean) as string[];
      void removeFiles(BUCKETS.messages, files).catch(() => {});
      refresh();
    },
    edit: async (message: Message, body: string) => {
      patch(message.id, (m) => ({ ...m, body, edited_at: new Date().toISOString() }));
      const { error } = await supabase.rpc('edit_message', { p_message: message.id, p_body: body });
      refresh();
      if (error) throw error;
    },
    pin: async (message: Message, pinned: boolean) => {
      const { error } = await supabase.rpc('pin_message', {
        p_message: message.id,
        p_pinned: pinned,
      });
      refresh();
      if (error) throw error;
    },
  };
}

/** Open view-once / replay media: registers the view, then signs the file. */
export async function openMessageMedia(message: Pick<Message, 'id' | 'media_path'>) {
  const { data, error } = await supabase.rpc('open_message_media', { p_message: message.id });
  if (error) throw error;
  if (!data || !message.media_path) return null;
  const urls = await getSignedUrls(BUCKETS.messages, [message.media_path], 5 * 60);
  return urls[message.media_path] ?? null;
}

export async function markThreadRead(threadId: string) {
  await supabase.rpc('mark_thread_read', { p_thread: threadId });
}

// ---------------------------------------------------------------------------------------------
// Thread state + group management
// ---------------------------------------------------------------------------------------------

type MemberPatch = Partial<{
  read_receipts: boolean;
  muted_until: string | null;
  pinned_at: string | null;
  marked_unread: boolean;
}>;

export async function updateMyMembership(threadId: string, me: string, patch: MemberPatch) {
  const { error } = await supabase
    .from('thread_members')
    .update(patch)
    .eq('thread_id', threadId)
    .eq('user_id', me);
  if (error) throw error;
}

type Rpc = keyof Fn;

/** Thread RPC + refresh. Throws readable messages via `directError`. */
export function useThreadRpc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fn,
      args,
      threadId,
    }: {
      fn: Rpc;
      args: Record<string, unknown>;
      threadId?: string;
    }) => {
      const { data, error } = await supabase.rpc(fn, args as never);
      if (error) throw error;
      if (threadId) invalidateThread(qc, threadId);
      else void qc.invalidateQueries({ queryKey: directKeys.all });
      return data as unknown;
    },
  });
}

export function useJoinRequests(threadId: string, enabled: boolean) {
  return useQuery({
    queryKey: directKeys.joinRequests(threadId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('thread_join_request_list', {
        p_thread: threadId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: directKeys.invite(token ?? ''),
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('thread_invite_preview', { p_token: token! });
      if (error) throw error;
      return data as unknown as {
        thread_id: string;
        title: string | null;
        photo_path: string | null;
        approval_required: boolean;
        member_count: number;
        members: { id: string; username: string; avatar_path: string | null }[];
        my_status: MemberStatus | null;
        requested: boolean;
      } | null;
    },
  });
}

/** Group photo: upload then point the thread at it. */
export async function setGroupPhoto(threadId: string, localUri: string) {
  const path = `${threadId}/group-${Crypto.randomUUID()}.jpg`;
  await uploadFile(BUCKETS.messages, path, localUri, { contentType: 'image/jpeg' });
  const { error } = await supabase.rpc('set_thread_photo', { p_thread: threadId, p_path: path });
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------
// Notes (page 81)
// ---------------------------------------------------------------------------------------------

export function useNotes(enabled = true) {
  return useQuery({
    queryKey: directKeys.notes,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('notes_tray');
      if (error) throw error;
      return (data ?? []) as unknown as NoteItem[];
    },
    staleTime: 60_000,
  });
}

export function useNoteLikers(noteId: string | undefined) {
  return useQuery({
    queryKey: directKeys.noteLikers(noteId ?? ''),
    enabled: !!noteId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('note_likers', { p_note: noteId! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNoteActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: directKeys.notes });
  };
  return {
    share: async (note: {
      body: string | null;
      audioTrackId: string | null;
      audioStartMs: number;
      audience: 'mutuals' | 'close_friends';
    }) => {
      const { error } = await supabase.from('notes').insert({
        body: note.body,
        audio_track_id: note.audioTrackId,
        audio_start_ms: note.audioStartMs,
        audience: note.audience,
      });
      refresh();
      if (error) throw error;
    },
    remove: async (noteId: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      refresh();
      if (error) throw error;
    },
    like: async (noteId: string, liked: boolean, me: string) => {
      qc.setQueryData<NoteItem[]>(directKeys.notes, (list) =>
        list?.map((n) => (n.id === noteId ? { ...n, liked } : n)),
      );
      const { error } = liked
        ? await supabase.from('note_likes').insert({ note_id: noteId })
        : await supabase.from('note_likes').delete().eq('note_id', noteId).eq('user_id', me);
      if (error) {
        refresh();
        throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Presence + cleanup
// ---------------------------------------------------------------------------------------------

export async function touchPresence() {
  await supabase.rpc('touch_presence');
}

/** Last active time by user id (only people whose status I may see). */
export function usePresence(userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ['direct', 'presence', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('presence_of', { p_users: ids });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.last_active_at])) as Record<
        string,
        string
      >;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Delete files I uploaded that are no longer needed (unsent, vanished, used-up view-once). */
export async function purgeMessageFiles() {
  const { data, error } = await supabase.rpc('my_purgeable_message_files');
  if (error || !data?.length) return;
  await removeFiles(BUCKETS.messages, data as string[]).catch(() => {});
}
