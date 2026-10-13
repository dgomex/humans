import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { fetchCards, type FeedEntry } from '@/features/feed/api';
import { BUCKETS, getSignedUrls, SIGNED_URL_TTL } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Fn = Database['public']['Functions'];

const URL_STALE_MS = (SIGNED_URL_TTL - 5 * 60) * 1000;

export const exploreKeys = {
  all: ['explore'] as const,
  grid: ['explore', 'grid'] as const,
  scroller: (source: ExploreSource, owner: string, seed: string) =>
    ['explore', 'scroller', source, owner, seed] as const,
  hashtag: (name: string) => ['explore', 'hashtag', name] as const,
  hashtagPosts: (name: string, tab: HashtagTab) => ['explore', 'hashtag-posts', name, tab] as const,
  accounts: (q: string, limit: number) => ['explore', 'search', 'accounts', q, limit] as const,
  hashtags: (q: string, limit: number) => ['explore', 'search', 'hashtags', q, limit] as const,
  audio: (q: string, limit: number) => ['explore', 'search', 'audio', q, limit] as const,
  posts: (q: string, kind: PostSearchKind) => ['explore', 'search', 'posts', q, kind] as const,
  recent: ['explore', 'recent'] as const,
};

// ---------------------------------------------------------------------------------------------
// Grid tiles (Explore, search results, hashtag pages)
// ---------------------------------------------------------------------------------------------

export type ExploreTile = {
  id: string;
  author_id: string;
  kind: 'post' | 'reel';
  cover_path: string | null;
  cover_type: string | null;
  media_count: number;
  play_count: number | null;
  cover_offset: number;
  coverUrl: string | null;
};

type TileRow = Omit<ExploreTile, 'coverUrl' | 'kind'> & { kind: string };

async function signTiles(rows: TileRow[]): Promise<ExploreTile[]> {
  const urls = await getSignedUrls(
    BUCKETS.posts,
    rows.map((r) => r.cover_path).filter((p): p is string => !!p),
  );
  return rows.map((r) => ({
    ...r,
    kind: r.kind === 'reel' ? 'reel' : 'post',
    cover_offset: Number(r.cover_offset ?? 0.5),
    coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
  }));
}

/** Drop a post from every cached Explore grid (Not interested / report / hide). */
export function removeFromExplore(qc: QueryClient, postId: string) {
  qc.setQueriesData<InfiniteData<{ tiles: ExploreTile[] }>>(
    { queryKey: exploreKeys.all },
    (data) =>
      data && Array.isArray(data.pages) && data.pages.every((p) => Array.isArray(p?.tiles))
        ? {
            ...data,
            pages: data.pages.map((p) => ({ ...p, tiles: p.tiles.filter((t) => t.id !== postId) })),
          }
        : data,
  );
}

// ---------------------------------------------------------------------------------------------
// Explore grid (page 65): ranked, snapshot-stable paging; refresh = new snapshot (reshuffle)
// ---------------------------------------------------------------------------------------------

const GRID_PAGE = 30;

export function useExploreGrid() {
  return useInfiniteQuery({
    queryKey: exploreKeys.grid,
    initialPageParam: { offset: 0, snapshot: null as string | null },
    staleTime: URL_STALE_MS / 2,
    queryFn: async ({ pageParam }) => {
      const snapshot = pageParam.snapshot ?? new Date().toISOString();
      const { data, error } = await supabase.rpc('explore_grid', {
        p_snapshot: snapshot,
        p_offset: pageParam.offset,
        p_limit: GRID_PAGE,
      });
      if (error) throw error;
      return {
        tiles: await signTiles(data),
        next: data.length < GRID_PAGE ? null : { offset: pageParam.offset + data.length, snapshot },
      };
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

// ---------------------------------------------------------------------------------------------
// Explore post scroller (page 70): the tapped post → its source list (hashtag / search) →
// similar posts (similar first, then the rest of Explore)
// ---------------------------------------------------------------------------------------------

export type ExploreSource = 'explore' | 'tag' | 'search';
type ScrollerParam = { phase: 'source' | 'similar'; offset: number; snapshot: string | null };
const SCROLLER_PAGE = 8;

export function useExploreScroller(
  seed: string,
  source: ExploreSource,
  owner: string,
  tab: HashtagTab,
) {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: [...exploreKeys.scroller(source, owner, seed), tab],
    initialPageParam: {
      phase: source === 'explore' ? 'similar' : 'source',
      offset: 0,
      snapshot: null,
    } as ScrollerParam,
    staleTime: Infinity,
    queryFn: async ({ pageParam }) => {
      const snapshot = pageParam.snapshot ?? new Date().toISOString();
      let ids: string[];
      let next: ScrollerParam | null;
      if (pageParam.phase === 'source') {
        const args = { p_offset: pageParam.offset, p_limit: SCROLLER_PAGE };
        const { data, error } =
          source === 'tag'
            ? await supabase.rpc('hashtag_posts', { p_name: owner, p_tab: tab, ...args })
            : await supabase.rpc('search_posts', { p_query: owner, p_kind: 'top', ...args });
        if (error) throw error;
        ids = data.map((r) => r.id);
        next =
          data.length < SCROLLER_PAGE
            ? { phase: 'similar', offset: 0, snapshot }
            : { phase: 'source', offset: pageParam.offset + data.length, snapshot };
      } else {
        const { data, error } = await supabase.rpc('similar_posts', {
          p_post: seed,
          p_snapshot: snapshot,
          p_offset: pageParam.offset,
          p_limit: SCROLLER_PAGE,
        });
        if (error) throw error;
        ids = data.map((r) => r.post_id);
        next =
          data.length < SCROLLER_PAGE
            ? null
            : { phase: 'similar', offset: pageParam.offset + data.length, snapshot };
      }
      const cards = await fetchCards(qc, ids);
      return {
        posts: cards.map((c) => ({ id: c.id, following: c.i_follow_author })),
        phase: pageParam.phase,
        next,
      };
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

/** Scroller pages → feed entries (seed first, no duplicates). Followed authors don't get Follow. */
export function scrollerEntries(
  seed: string,
  seedFollowing: boolean,
  pages: { posts: { id: string; following: boolean }[] }[],
): FeedEntry[] {
  const seen = new Set([seed]);
  const entries: FeedEntry[] = [
    { type: 'post', key: seed, postId: seed, reason: seedFollowing ? 'following' : 'suggested' },
  ];
  for (const page of pages) {
    for (const p of page.posts) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      entries.push({
        type: 'post',
        key: p.id,
        postId: p.id,
        reason: p.following ? 'following' : 'suggested',
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------------------------
// Hashtag page (page 68)
// ---------------------------------------------------------------------------------------------

export type HashtagTab = 'top' | 'recent' | 'reels';
export type HashtagHeader = Fn['hashtag_page']['Returns'][number] & { coverUrl: string | null };

export function normalizeTag(name: string) {
  return name.trim().replace(/^#+/, '').toLowerCase();
}

export function useHashtag(name: string) {
  return useQuery({
    queryKey: exploreKeys.hashtag(name),
    staleTime: URL_STALE_MS / 4,
    queryFn: async (): Promise<HashtagHeader | null> => {
      const { data, error } = await supabase.rpc('hashtag_page', { p_name: name });
      if (error) throw error;
      const row = data[0];
      if (!row) return null;
      const urls = row.cover_path ? await getSignedUrls(BUCKETS.posts, [row.cover_path]) : {};
      return { ...row, coverUrl: row.cover_path ? (urls[row.cover_path] ?? null) : null };
    },
  });
}

const TAG_PAGE = 30;

export function useHashtagPosts(name: string, tab: HashtagTab) {
  return useInfiniteQuery({
    queryKey: exploreKeys.hashtagPosts(name, tab),
    initialPageParam: 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('hashtag_posts', {
        p_name: name,
        p_tab: tab,
        p_offset: pageParam,
        p_limit: TAG_PAGE,
      });
      if (error) throw error;
      return { tiles: await signTiles(data), count: data.length };
    },
    getNextPageParam: (last, pages) =>
      last.count < TAG_PAGE ? undefined : pages.reduce((n, p) => n + p.count, 0),
  });
}

// ---------------------------------------------------------------------------------------------
// Search (page 66)
// ---------------------------------------------------------------------------------------------

export type AccountResult = Fn['search_accounts']['Returns'][number];
export type HashtagResult = Fn['search_hashtags']['Returns'][number];
export type AudioResult = Fn['search_audio']['Returns'][number];
export type PostSearchKind = 'top' | 'reels';

export function useSearchAccounts(query: string, limit = 20, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: exploreKeys.accounts(q, limit),
    enabled: enabled && q.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_accounts', {
        p_query: q,
        p_limit: limit,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useSearchHashtags(query: string, limit = 20, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: exploreKeys.hashtags(q, limit),
    enabled: enabled && normalizeTag(q).length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_hashtags', {
        p_query: q,
        p_limit: limit,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useSearchAudio(query: string, limit = 20, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: exploreKeys.audio(q, limit),
    enabled: enabled && q.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_audio', { p_query: q, p_limit: limit });
      if (error) throw error;
      return data;
    },
  });
}

const POSTS_PAGE = 30;

export function useSearchPosts(query: string, kind: PostSearchKind, enabled = true) {
  const q = query.trim();
  return useInfiniteQuery({
    queryKey: exploreKeys.posts(q, kind),
    enabled: enabled && q.length > 0,
    initialPageParam: 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('search_posts', {
        p_query: q,
        p_kind: kind,
        p_offset: pageParam,
        p_limit: POSTS_PAGE,
      });
      if (error) throw error;
      return { tiles: await signTiles(data), count: data.length };
    },
    getNextPageParam: (last, pages) =>
      last.count < POSTS_PAGE ? undefined : pages.reduce((n, p) => n + p.count, 0),
  });
}

// ---------------------------------------------------------------------------------------------
// Recent searches (page 67)
// ---------------------------------------------------------------------------------------------

export type RecentSearch = Fn['recent_searches']['Returns'][number];
export type SearchKind = 'account' | 'hashtag' | 'audio' | 'keyword';

export function useRecentSearches(limit = 50) {
  return useQuery({
    queryKey: exploreKeys.recent,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('recent_searches', { p_limit: 50 });
      if (error) throw error;
      return data;
    },
    select: (rows) => rows.slice(0, limit),
  });
}

/** Save an opened result / submitted keyword (fire and forget; the list refreshes after). */
export function useRecordSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { kind: SearchKind; target?: string; query?: string }) => {
      const { error } = await supabase.rpc('record_search', {
        p_kind: entry.kind,
        p_target: entry.target,
        p_query: entry.query,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: exploreKeys.recent }),
  });
}

export function useRemoveRecent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('search_history').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => {
      qc.setQueryData<RecentSearch[]>(exploreKeys.recent, (rows) =>
        rows?.filter((r) => r.id !== id),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: exploreKeys.recent }),
  });
}

export function useClearRecents(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('search_history').delete().eq('user_id', userId!);
      if (error) throw error;
    },
    onMutate: () => qc.setQueryData<RecentSearch[]>(exploreKeys.recent, []),
    onSettled: () => qc.invalidateQueries({ queryKey: exploreKeys.recent }),
  });
}
