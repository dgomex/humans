import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { profileKeys } from '@/features/profile/api';
import { BUCKETS, SIGNED_URL_TTL, getPublicUrl, getSignedUrls, removeFiles } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { InteractiveKind, StoryAudience, StoryContent, StoryKind } from './types';

type Fn = Database['public']['Functions'];

// ---------------------------------------------------------------------------------------------
// Types (story_cards() JSON + signed URLs)
// ---------------------------------------------------------------------------------------------

export type StickerResponse = { option: number | null; value: number | null; body: string | null };

export type StickerResults = {
  total?: number;
  counts?: number[];
  correct?: number | null;
  average?: number | null;
  participants?: number;
};

export type CardSticker = {
  id: string;
  type: InteractiveKind;
  data: Record<string, unknown>;
  chain_id: string | null;
  mine: StickerResponse[] | null;
  results: StickerResults | null;
};

export type StoryCard = {
  id: string;
  author: { id: string; username: string; avatar_path: string | null; is_private: boolean };
  kind: StoryKind;
  media_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  content: StoryContent;
  audience: StoryAudience;
  published_at: string;
  is_active: boolean;
  is_own: boolean;
  audio_start_ms: number;
  audio: {
    id: string;
    title: string;
    artist: string;
    audio_path: string;
    duration_ms: number;
    cover_color: string;
  } | null;
  reshared_post_id: string | null;
  seen: boolean;
  liked: boolean;
  replies_allowed: boolean;
  view_count: number | null;
  like_count: number | null;
  reply_count: number | null;
  highlight_ids: string[] | null;
  mentions: { id: string; username: string }[];
  stickers: CardSticker[];
  /** Storage path → signed URL for every file the story uses. */
  urls: Record<string, string>;
  audioUrl: string | null;
};

export type TrayEntry = Fn['stories_tray']['Returns'][number];
export type StoryRing = Fn['story_rings']['Returns'][number];
export type StoryViewer = Fn['story_viewers']['Returns'][number] & {
  responses:
    | { type: InteractiveKind; option: number | null; value: number | null; body: string | null }[]
    | null;
};
export type StoryResponseRow = Fn['story_responses']['Returns'][number];
export type ArchivedStory = Omit<
  Fn['story_archive']['Returns'][number],
  'content' | 'kind' | 'audience'
> & {
  content: StoryContent;
  kind: StoryKind;
  audience: StoryAudience;
};
export type ChainStory = Fn['add_yours_chain']['Returns'][number];
export type ProfileHighlight = Fn['profile_highlights']['Returns'][number];
export type StorySettings = Database['public']['Tables']['story_settings']['Row'];

export const storyKeys = {
  all: ['stories'] as const,
  tray: ['stories', 'tray'] as const,
  rings: (ids: string[]) => ['stories', 'rings', ...ids] as const,
  reel: (userId: string) => ['stories', 'reel', userId] as const,
  highlight: (id: string) => ['stories', 'highlight', id] as const,
  cards: (ids: string[]) => ['stories', 'cards', ...ids] as const,
  viewers: (storyId: string, search: string) => ['stories', 'viewers', storyId, search] as const,
  responses: (storyId: string) => ['stories', 'responses', storyId] as const,
  chain: (chainId: string) => ['stories', 'chain', chainId] as const,
  archive: ['stories', 'archive'] as const,
  settings: ['stories', 'settings'] as const,
  hidden: ['stories', 'hidden'] as const,
};

const URL_STALE_MS = (SIGNED_URL_TTL - 5 * 60) * 1000;

/** Every storage path a story's content references. */
export function storyPaths(s: Pick<StoryCard, 'media_path' | 'thumb_path' | 'content'>): string[] {
  const out = new Set<string>();
  if (s.media_path) out.add(s.media_path);
  if (s.thumb_path) out.add(s.thumb_path);
  for (const c of s.content?.layout?.cells ?? []) if (c) out.add(c);
  for (const f of s.content?.boomerang?.frames ?? []) out.add(f);
  for (const e of s.content?.elements ?? []) {
    if (e.type === 'sticker' && e.sticker.kind === 'photo') out.add(e.sticker.path);
  }
  return [...out];
}

async function withUrls(raw: Omit<StoryCard, 'urls' | 'audioUrl'>[]): Promise<StoryCard[]> {
  const urls = await getSignedUrls(BUCKETS.stories, raw.flatMap(storyPaths));
  return raw.map((s) => ({
    ...s,
    content: s.content ?? { v: 1, background: ['#262626', '#121212'], elements: [] },
    urls,
    audioUrl: s.audio ? getPublicUrl(BUCKETS.audio, s.audio.audio_path) : null,
  }));
}

export async function fetchStoryCards(ids: string[]): Promise<StoryCard[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('story_cards', { p_ids: ids });
  if (error) throw error;
  return withUrls((data ?? []) as unknown as StoryCard[]);
}

// ---------------------------------------------------------------------------------------------
// Tray, rings, reels
// ---------------------------------------------------------------------------------------------

/** Page 43 tray: you first, then followed accounts with active stories (unseen first). */
export function useStoriesTray(enabled = true) {
  return useQuery({
    queryKey: storyKeys.tray,
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stories_tray');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Ring state for avatars (profiles). */
export function useStoryRing(userId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.rings(userId ? [userId] : []),
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('story_rings', { p_users: [userId!] });
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });
}

export function ringOf(r: Pick<StoryRing, 'has_unseen' | 'has_close_friends'> | null | undefined) {
  if (!r) return 'none' as const;
  if (r.has_close_friends && r.has_unseen) return 'closeFriends' as const;
  return r.has_unseen ? ('unseen' as const) : ('seen' as const);
}

export async function fetchReel(userId: string) {
  const { data, error } = await supabase.rpc('story_reel', { p_user: userId });
  if (error) throw error;
  return withUrls((data ?? []) as unknown as StoryCard[]);
}

export function useStoryReel(userId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.reel(userId ?? ''),
    enabled: !!userId,
    staleTime: URL_STALE_MS / 4,
    queryFn: () => fetchReel(userId!),
  });
}

export function useHighlightReel(highlightId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.highlight(highlightId ?? ''),
    enabled: !!highlightId,
    staleTime: URL_STALE_MS / 4,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('highlight_reel', { p_highlight: highlightId! });
      if (error) throw error;
      return withUrls((data ?? []) as unknown as StoryCard[]);
    },
  });
}

/** Specific stories (archive viewer, Add yours chain). */
export function useStoryCards(ids: string[]) {
  return useQuery({
    queryKey: storyKeys.cards(ids),
    enabled: ids.length > 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: () => fetchStoryCards(ids),
  });
}

/** Patch a story wherever it is cached (reels, highlights, cards). */
export function patchStory(
  qc: QueryClient,
  id: string,
  patch: (s: StoryCard) => Partial<StoryCard>,
) {
  const update = (list: StoryCard[] | undefined) =>
    list?.map((s) => (s.id === id ? { ...s, ...patch(s) } : s));
  qc.setQueriesData<StoryCard[]>({ queryKey: ['stories', 'reel'] }, update);
  qc.setQueriesData<StoryCard[]>({ queryKey: ['stories', 'highlight'] }, update);
  qc.setQueriesData<StoryCard[]>({ queryKey: ['stories', 'cards'] }, update);
}

// ---------------------------------------------------------------------------------------------
// Viewing, likes, replies, stickers (page 52)
// ---------------------------------------------------------------------------------------------

const pendingViews = new Set<string>();
let viewTimer: ReturnType<typeof setTimeout> | null = null;

/** Batched "seen" marks; the tray ring turns grey when everything is seen. */
export function markStoryViewed(qc: QueryClient, story: StoryCard) {
  if (story.is_own || story.seen || !story.is_active) return;
  patchStory(qc, story.id, () => ({ seen: true }));
  pendingViews.add(story.id);
  if (viewTimer) return;
  viewTimer = setTimeout(async () => {
    viewTimer = null;
    const ids = [...pendingViews];
    pendingViews.clear();
    await supabase.rpc('mark_stories_viewed', { p_ids: ids });
    void qc.invalidateQueries({ queryKey: storyKeys.tray });
    void qc.invalidateQueries({ queryKey: ['stories', 'rings'] });
  }, 800);
}

export function useToggleStoryLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => {
      const res = liked
        ? await supabase.from('story_likes').delete().eq('story_id', id)
        : await supabase.from('story_likes').insert({ story_id: id });
      if (res.error && res.error.code !== '23505') throw res.error;
    },
    onMutate: ({ id, liked }) => patchStory(qc, id, () => ({ liked: !liked })),
    onError: (_e, { id, liked }) => patchStory(qc, id, () => ({ liked })),
  });
}

export function useSendStoryReply() {
  return useMutation({
    mutationFn: async (args: { storyId: string; body: string; isReaction?: boolean }) => {
      const { error } = await supabase.from('story_replies').insert({
        story_id: args.storyId,
        body: args.body,
        is_reaction: args.isReaction ?? false,
      });
      if (error) throw error;
    },
  });
}

/** Poll vote, quiz answer, slider value, question answer or countdown reminder. */
export function useRespondSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      storyId: string;
      stickerId: string;
      option?: number;
      value?: number;
      body?: string;
    }) => {
      const { error } = await supabase.from('story_sticker_responses').insert({
        sticker_id: args.stickerId,
        // Overwritten server-side from the sticker.
        story_id: args.storyId,
        type: 'poll',
        option: args.option ?? null,
        value: args.value ?? null,
        body: args.body ?? null,
      });
      if (error && error.code !== '23505') throw error;
      // Refresh results (counts / quiz answer / average) for this story.
      const [card] = await fetchStoryCards([args.storyId]);
      if (card) patchStory(qc, card.id, () => ({ stickers: card.stickers }));
    },
    onMutate: (args) =>
      patchStory(qc, args.storyId, (s) => ({
        stickers: s.stickers.map((k) =>
          k.id === args.stickerId
            ? {
                ...k,
                mine: [
                  ...(k.mine ?? []),
                  {
                    option: args.option ?? null,
                    value: args.value ?? null,
                    body: args.body ?? null,
                  },
                ],
              }
            : k,
        ),
      })),
  });
}

export function useCancelReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stickerId }: { storyId: string; stickerId: string }) => {
      const { error } = await supabase
        .from('story_sticker_responses')
        .delete()
        .eq('sticker_id', stickerId);
      if (error) throw error;
    },
    onMutate: ({ storyId, stickerId }) =>
      patchStory(qc, storyId, (s) => ({
        stickers: s.stickers.map((k) => (k.id === stickerId ? { ...k, mine: null } : k)),
      })),
  });
}

export function useAddYoursChain(chainId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.chain(chainId ?? ''),
    enabled: !!chainId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('add_yours_chain', { p_chain: chainId! });
      if (error) throw error;
      const rows = data ?? [];
      const urls = await getSignedUrls(
        BUCKETS.stories,
        rows.flatMap((r) => (r.thumb_path ? [r.thumb_path] : [])),
      );
      return rows.map((r) => ({
        ...r,
        thumbUrl: r.thumb_path ? (urls[r.thumb_path] ?? null) : null,
      }));
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Own story: viewers, responses, delete (page 56)
// ---------------------------------------------------------------------------------------------

export function useStoryViewers(storyId: string | undefined, search: string) {
  return useQuery({
    queryKey: storyKeys.viewers(storyId ?? '', search),
    enabled: !!storyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('story_viewers', {
        p_story: storyId!,
        p_search: search,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as StoryViewer[];
    },
  });
}

export function useStoryResponses(storyId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.responses(storyId ?? ''),
    enabled: !!storyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('story_responses', { p_story: storyId! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function invalidateStories(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: storyKeys.all });
  void qc.invalidateQueries({ queryKey: ['profile'] });
}

/** Delete a story everywhere (files first, then the row; highlights drop it by cascade). */
export async function deleteStory(
  story: Pick<StoryCard, 'id' | 'media_path' | 'thumb_path' | 'content'>,
) {
  const { data } = await supabase.from('stories').select('files').eq('id', story.id).maybeSingle();
  await removeFiles(BUCKETS.stories, data?.files ?? storyPaths(story)).catch(() => {});
  const { error } = await supabase.from('stories').delete().eq('id', story.id);
  if (error) throw error;
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStory,
    onSuccess: () => invalidateStories(qc),
  });
}

/** Expired stories that aren't archived/highlighted, and abandoned uploads: removed on launch. */
export async function purgeExpiredStories() {
  const { data } = await supabase.rpc('my_purgeable_stories');
  for (const s of data ?? []) {
    await removeFiles(BUCKETS.stories, s.files).catch(() => {});
    await supabase.from('stories').delete().eq('id', s.id);
  }
}

// ---------------------------------------------------------------------------------------------
// Archive (page 28) and highlights (pages 25 / 57)
// ---------------------------------------------------------------------------------------------

const ARCHIVE_PAGE = 60;

export function useStoryArchive(enabled = true) {
  return useInfiniteQuery({
    queryKey: storyKeys.archive,
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('story_archive', {
        p_offset: pageParam,
        p_limit: ARCHIVE_PAGE,
      });
      if (error) throw error;
      const rows = (data ?? []) as unknown as ArchivedStory[];
      const urls = await getSignedUrls(
        BUCKETS.stories,
        rows.flatMap((r) => storyPaths(r)),
      );
      return rows.map((r) => ({ ...r, urls }));
    },
    getNextPageParam: (last, pages) =>
      last.length < ARCHIVE_PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

export type ArchiveEntry = ArchivedStory & { urls: Record<string, string> };

export function highlightCoverUrl(h: Pick<ProfileHighlight, 'cover_path'>) {
  return h.cover_path ? getPublicUrl(BUCKETS.highlightCovers, h.cover_path) : null;
}

export function useSaveHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string | null;
      title: string;
      coverPath: string | null;
      storyIds: string[];
    }) => {
      const { data, error } = await supabase.rpc('save_highlight', {
        // SQL nulls: create a new highlight / no cover.
        p_highlight: args.id as string,
        p_title: args.title,
        p_cover_path: args.coverPath as string,
        p_story_ids: args.storyIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidateStories(qc);
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (h: { id: string; cover_path: string | null }) => {
      const { error } = await supabase.from('highlights').delete().eq('id', h.id);
      if (error) throw error;
      if (h.cover_path) await removeFiles(BUCKETS.highlightCovers, [h.cover_path]).catch(() => {});
    },
    onSuccess: () => {
      invalidateStories(qc);
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function useRemoveFromHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ highlightId, storyId }: { highlightId: string; storyId: string }) => {
      const { error } = await supabase
        .from('highlight_items')
        .delete()
        .eq('highlight_id', highlightId)
        .eq('story_id', storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateStories(qc);
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/** Add one story to an existing highlight (the "Highlight" button on your story). */
export function useAddToHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ highlightId, storyId }: { highlightId: string; storyId: string }) => {
      const { data: last } = await supabase
        .from('highlight_items')
        .select('position')
        .eq('highlight_id', highlightId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from('highlight_items').insert({
        highlight_id: highlightId,
        story_id: storyId,
        position: (last?.position ?? -1) + 1,
      });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      invalidateStories(qc);
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/** Stories of one highlight in order (editor "Selected" tab). */
export async function highlightStoryIds(highlightId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('highlight_items')
    .select('story_id')
    .eq('highlight_id', highlightId)
    .order('position');
  if (error) throw error;
  return (data ?? []).map((r) => r.story_id);
}

// ---------------------------------------------------------------------------------------------
// Settings + Hide story from (page 55)
// ---------------------------------------------------------------------------------------------

export const DEFAULT_STORY_SETTINGS = {
  replies: 'everyone' as const,
  allow_resharing: true,
  save_to_archive: true,
};

export function useStorySettings(userId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.settings,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_settings')
        .select('replies, allow_resharing, save_to_archive')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        ...DEFAULT_STORY_SETTINGS,
        ...(data ?? {}),
      } as Pick<StorySettings, 'replies' | 'allow_resharing' | 'save_to_archive'>;
    },
  });
}

export function useUpdateStorySettings(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<Pick<StorySettings, 'replies' | 'allow_resharing' | 'save_to_archive'>>,
    ) => {
      const { error } = await supabase
        .from('story_settings')
        .upsert({ user_id: userId!, ...patch }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onMutate: (patch) =>
      qc.setQueryData(storyKeys.settings, (old: StorySettings | undefined) =>
        old ? { ...old, ...patch } : old,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: storyKeys.settings }),
  });
}

export function useHiddenFrom(enabled = true) {
  return useQuery({
    queryKey: storyKeys.hidden,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_hidden_from')
        .select(
          'hidden_id, profile:profiles!story_hidden_from_hidden_id_fkey(id, username, full_name, avatar_path)',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleHiddenFrom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, hidden }: { userId: string; hidden: boolean }) => {
      const res = hidden
        ? await supabase.from('story_hidden_from').delete().eq('hidden_id', userId)
        : await supabase.from('story_hidden_from').insert({ hidden_id: userId });
      if (res.error && res.error.code !== '23505') throw res.error;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: storyKeys.hidden });
      void qc.invalidateQueries({ queryKey: ['stories', 'viewers'] });
    },
  });
}

/** Highlight circle images: the chosen cover (public) or the first story's frame (signed). */
export function useHighlightCovers(highlights: ProfileHighlight[] | undefined) {
  const missing = (highlights ?? [])
    .filter((h) => !h.cover_path && h.first_thumb_path)
    .map((h) => h.first_thumb_path!);
  const signed = useQuery({
    queryKey: ['stories', 'covers', ...missing],
    enabled: missing.length > 0,
    staleTime: URL_STALE_MS,
    queryFn: () => getSignedUrls(BUCKETS.stories, missing),
  });
  const out: Record<string, string | null> = {};
  for (const h of highlights ?? []) {
    out[h.id] = h.cover_path
      ? highlightCoverUrl(h)
      : h.first_thumb_path
        ? (signed.data?.[h.first_thumb_path] ?? null)
        : null;
  }
  return out;
}
