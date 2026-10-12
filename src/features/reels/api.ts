import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchCards, usePostCard, type CardAudio, type FeedPost } from '@/features/feed/api';
import { BUCKETS, getPublicUrl, getSignedUrls, SIGNED_URL_TTL } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { sourceFromCard, type ReelSource } from './source';

const URL_STALE_MS = (SIGNED_URL_TTL - 5 * 60) * 1000;
const PAGE = 6;

export const reelKeys = {
  all: ['reels'] as const,
  feed: ['reels', 'feed'] as const,
  scroller: (source: ReelScrollerSource, id: string) => ['reels', 'scroller', source, id] as const,
  audio: (trackId: string) => ['reels', 'audio', trackId] as const,
  audioReels: (trackId: string) => ['reels', 'audio-reels', trackId] as const,
  remixes: (postId: string) => ['reels', 'remixes', postId] as const,
  mine: ['reels', 'mine'] as const,
  savedAudio: ['reels', 'saved-audio'] as const,
};

// ---------------------------------------------------------------------------------------------
// Feed (page 58)
// ---------------------------------------------------------------------------------------------

type FeedParam = { offset: number; snapshot: string | null };
export type ReelEntry = { key: string; postId: string; reason: string };

export function useReelsFeed() {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: reelKeys.feed,
    initialPageParam: { offset: 0, snapshot: null } as FeedParam,
    staleTime: Infinity,
    queryFn: async ({ pageParam }) => {
      const snapshot = pageParam.snapshot ?? new Date().toISOString();
      const { data, error } = await supabase.rpc('reels_feed', {
        p_snapshot: snapshot,
        p_offset: pageParam.offset,
        p_limit: PAGE,
      });
      if (error) throw error;
      const cards = await fetchCards(
        qc,
        data.map((r) => r.post_id),
      );
      const visible = new Set(cards.map((c) => c.id));
      const entries: ReelEntry[] = data
        .filter((r) => visible.has(r.post_id))
        .map((r) => ({
          key: `${pageParam.offset}:${r.post_id}`,
          postId: r.post_id,
          reason: r.reason,
        }));
      return {
        entries,
        // The ranking never runs dry: seen reels sink but come back, like Instagram's endless feed.
        next: data.length < PAGE ? null : { offset: pageParam.offset + data.length, snapshot },
      };
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

/** Drop a reel from the cached feed (Not interested / report / delete). */
export function removeFromReels(qc: QueryClient, postId: string) {
  qc.setQueriesData<InfiniteData<{ entries: ReelEntry[]; next: FeedParam | null }>>(
    { queryKey: reelKeys.feed },
    (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              entries: p.entries.filter((e) => e.postId !== postId),
            })),
          }
        : data,
  );
}

// ---------------------------------------------------------------------------------------------
// Scrollers: a profile's Reels tab, an audio page, a reel's remixes — opened at one reel
// ---------------------------------------------------------------------------------------------

export type ReelScrollerSource = 'profile' | 'audio' | 'remixes';
const SCROLLER_PAGE = 12;

async function scrollerIds(source: ReelScrollerSource, id: string, offset: number) {
  const args = { p_offset: offset, p_limit: SCROLLER_PAGE };
  const { data, error } =
    source === 'profile'
      ? await supabase.rpc('profile_posts', { p_user: id, p_kind: 'reels', ...args })
      : source === 'audio'
        ? await supabase.rpc('audio_reels', { p_track: id, ...args })
        : await supabase.rpc('reel_remixes', { p_post: id, ...args });
  if (error) throw error;
  return data.map((r) => r.id);
}

export function useReelScroller(source: ReelScrollerSource | undefined, id: string | undefined) {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: reelKeys.scroller(source ?? 'profile', id ?? ''),
    enabled: !!source && !!id,
    initialPageParam: 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: async ({ pageParam }) => {
      const ids = await scrollerIds(source!, id!, pageParam);
      const cards = await fetchCards(qc, ids);
      return { ids: cards.map((c) => c.id), count: ids.length };
    },
    getNextPageParam: (last, pages) =>
      last.count < SCROLLER_PAGE ? undefined : pages.reduce((n, p) => n + p.count, 0),
  });
}

// ---------------------------------------------------------------------------------------------
// Playback source: a card + its remix original / borrowed original audio
// ---------------------------------------------------------------------------------------------

/** Everything ReelPlayer needs for a card (fetches the remix original / audio reel if any). */
export function useReelSource(card: FeedPost | null | undefined): ReelSource | null {
  const originalId = card?.remix?.post_id ?? undefined;
  const audioOriginId =
    card?.audio?.source === 'original' && card.audio.origin_post_id !== card.id
      ? (card.audio.origin_post_id ?? undefined)
      : undefined;
  const original = usePostCard(originalId);
  const audioOrigin = usePostCard(audioOriginId);
  return useMemo(
    () =>
      card
        ? sourceFromCard(card, {
            // undefined = still loading; null = deleted or not visible ("Content unavailable").
            original: !card.remix
              ? undefined
              : !originalId
                ? null
                : original.isPending
                  ? undefined
                  : (original.data ?? null),
            audioOrigin: audioOriginId ? (audioOrigin.data ?? null) : undefined,
          })
        : null,
    [card, originalId, original.data, original.isPending, audioOriginId, audioOrigin.data],
  );
}

// Plays are reported once per reel per session (repeats within the same session are ignored;
// the server also counts a repeat only after a short gap).
const played = new Set<string>();

export function recordPlay(postId: string) {
  if (played.has(postId)) return;
  played.add(postId);
  void supabase.rpc('record_reel_play', { p_post: postId });
}

// ---------------------------------------------------------------------------------------------
// Grids (profile Reels tab covers, audio page, remixes)
// ---------------------------------------------------------------------------------------------

export type ReelTile = {
  id: string;
  coverUrl: string | null;
  play_count: number | null;
  cover_offset: number;
  is_origin?: boolean;
};

async function signTiles<
  T extends {
    id: string;
    cover_path: string | null;
    play_count: number | null;
    cover_offset: number;
  },
>(rows: T[]): Promise<(T & ReelTile)[]> {
  const urls = await getSignedUrls(
    BUCKETS.posts,
    rows.map((r) => r.cover_path).filter((p): p is string => !!p),
  );
  return rows.map((r) => ({
    ...r,
    cover_offset: Number(r.cover_offset ?? 0.5),
    coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
  }));
}

export type AudioPage = {
  id: string;
  title: string;
  artist: string;
  audio_path: string | null;
  duration_ms: number;
  cover_color: string;
  source: string;
  origin_post_id: string | null;
  renamed_at: string | null;
  owner: { id: string; username: string; avatar_path: string | null } | null;
  is_owner: boolean;
  saved: boolean;
  reel_count: number;
  audioUrl: string | null;
};

export function useAudioPage(trackId: string | undefined) {
  return useQuery({
    queryKey: reelKeys.audio(trackId ?? ''),
    enabled: !!trackId,
    queryFn: async (): Promise<AudioPage | null> => {
      const { data, error } = await supabase.rpc('audio_page', { p_track: trackId! });
      if (error) throw error;
      if (!data) return null;
      const page = data as unknown as Omit<AudioPage, 'audioUrl'>;
      return {
        ...page,
        audioUrl: page.audio_path ? getPublicUrl(BUCKETS.audio, page.audio_path) : null,
      };
    },
  });
}

export function useAudioReels(trackId: string | undefined) {
  return useInfiniteQuery({
    queryKey: reelKeys.audioReels(trackId ?? ''),
    enabled: !!trackId,
    initialPageParam: 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('audio_reels', {
        p_track: trackId!,
        p_offset: pageParam,
        p_limit: 30,
      });
      if (error) throw error;
      return signTiles(data);
    },
    getNextPageParam: (last, pages) =>
      last.length < 30 ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

export function useRemixes(postId: string | undefined) {
  return useQuery({
    queryKey: reelKeys.remixes(postId ?? ''),
    enabled: !!postId,
    staleTime: URL_STALE_MS / 4,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reel_remixes', {
        p_post: postId!,
        p_limit: 60,
      });
      if (error) throw error;
      return signTiles(data);
    },
  });
}

/** Own reels for "Link a reel" (page 61). */
export function useMyReels(enabled = true) {
  return useQuery({
    queryKey: reelKeys.mine,
    enabled,
    staleTime: URL_STALE_MS / 4,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_reels', { p_limit: 60 });
      if (error) throw error;
      return signTiles(data.map((r) => ({ ...r, play_count: null })));
    },
  });
}

export function useToggleAudioSaved(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (save: boolean) => {
      const { error } = save
        ? await supabase.from('saved_audio').insert({ track_id: trackId })
        : await supabase.from('saved_audio').delete().eq('track_id', trackId);
      if (error && error.code !== '23505') throw error;
    },
    onMutate: (save) =>
      qc.setQueryData<AudioPage | null>(reelKeys.audio(trackId), (p) =>
        p ? { ...p, saved: save } : p,
      ),
    onError: (_e, save) =>
      qc.setQueryData<AudioPage | null>(reelKeys.audio(trackId), (p) =>
        p ? { ...p, saved: !save } : p,
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: reelKeys.savedAudio });
      void qc.invalidateQueries({ queryKey: ['posts', 'tracks'] });
    },
  });
}

export function useRenameAudio(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase.rpc('rename_original_audio', {
        p_track: trackId,
        p_title: title,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (title) => {
      qc.setQueryData<AudioPage | null>(reelKeys.audio(trackId), (p) => (p ? { ...p, title } : p));
      // Cards show the audio title on the reel.
      void qc.invalidateQueries({ queryKey: ['feed', 'card'] });
    },
  });
}

export type SavedAudio = {
  id: string;
  title: string;
  artist: string;
  source: string;
  cover_color: string;
  duration_ms: number;
};

/** Saved → Audio (page 26 tile, page 62 bookmark). */
export function useSavedAudio() {
  return useQuery({
    queryKey: reelKeys.savedAudio,
    queryFn: async (): Promise<SavedAudio[]> => {
      const { data, error } = await supabase
        .from('saved_audio')
        .select(
          'created_at, track:audio_tracks ( id, title, artist, source, cover_color, duration_ms )',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Tracks that are no longer visible (original reel hidden) come back null.
      return data.flatMap((r) => (r.track ? [r.track as SavedAudio] : []));
    },
  });
}

/** Label for a reel's sound ("Artist · Title" or "username · Original audio"). */
export function audioLabel(audio: CardAudio | null, fallbackUsername: string) {
  if (!audio) return `${fallbackUsername} · Original audio`;
  return `${audio.artist} · ${audio.title}`;
}
