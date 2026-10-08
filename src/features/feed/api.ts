import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { invalidatePosts } from '@/features/posts/api';
import { BUCKETS, getPublicUrl, getSignedUrls, SIGNED_URL_TTL } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Fn = Database['public']['Functions'];

// ---------------------------------------------------------------------------------------------
// Types (post_cards() JSON + signed URLs)
// ---------------------------------------------------------------------------------------------

export type CardMedia = {
  id: string;
  position: number;
  type: 'image' | 'video';
  path: string;
  thumb_path: string | null;
  width: number;
  height: number;
  duration_ms: number | null;
  alt_text: string | null;
  url: string | null;
  thumbUrl: string | null;
};

export type CardTag = {
  id: string;
  media_id: string;
  x: number | null;
  y: number | null;
  user: { id: string; username: string };
};

export type FeedPost = {
  id: string;
  author_id: string;
  author: {
    id: string;
    username: string;
    full_name: string;
    avatar_path: string | null;
    is_private: boolean;
  };
  caption: string;
  aspect_ratio: number;
  audience: 'everyone' | 'close_friends';
  hide_like_counts: boolean;
  comments_disabled: boolean;
  archived_at: string | null;
  pinned_at: string | null;
  published_at: string | null;
  edited_at: string | null;
  audio_start_ms: number;
  audio: {
    id: string;
    title: string;
    artist: string;
    audio_path: string;
    duration_ms: number;
  } | null;
  audioUrl: string | null;
  media: CardMedia[];
  tags: CardTag[];
  collaborators: {
    user_id: string;
    status: 'pending' | 'accepted';
    user: { id: string; username: string; avatar_path: string | null };
  }[];
  /** null when the author hid like counts (only the author sees the number). */
  like_count: number | null;
  comment_count: number;
  repost_count: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  can_repost: boolean;
  i_follow_author: boolean;
  requested_author: boolean;
  is_favorite_author: boolean;
  liked_by: { username: string; avatar_path: string | null } | null;
  preview_comments: { id: string; username: string; body: string }[];
};

/** Why a post is in a feed (Home ranking reasons, suggestions, reposts). */
export type FeedReason = 'own' | 'following' | 'favorite' | 'collab' | 'repost' | 'suggested';

export type FeedEntry =
  | {
      type: 'post';
      key: string;
      postId: string;
      reason: FeedReason;
      repostedBy?: { id: string; username: string; note: string | null };
    }
  | { type: 'caught-up'; key: 'caught-up' }
  | { type: 'suggested-header'; key: 'suggested-header' };

const URL_STALE_MS = (SIGNED_URL_TTL - 5 * 60) * 1000;

export const feedKeys = {
  all: ['feed'] as const,
  card: (id: string) => ['feed', 'card', id] as const,
  home: ['feed', 'home'] as const,
  chrono: (kind: ChronoKind) => ['feed', 'chrono', kind] as const,
  scroller: (source: ScrollerSource, ownerId: string) =>
    ['feed', 'scroller', source, ownerId] as const,
  comments: (postId: string) => ['feed', 'comments', postId] as const,
  replies: (commentId: string) => ['feed', 'replies', commentId] as const,
  hiddenComments: (postId: string) => ['feed', 'hidden-comments', postId] as const,
  likers: (target: LikersTarget, search: string) =>
    ['feed', 'likers', target.kind, target.id, search] as const,
};

// ---------------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------------

/** Fetch cards for ids (in order), sign their media, and seed each card's cache entry. */
export async function fetchCards(qc: QueryClient, ids: string[]): Promise<FeedPost[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('post_cards', { p_ids: ids });
  if (error) throw error;
  const raw = (data ?? []) as unknown as Omit<FeedPost, 'audioUrl'>[];
  const paths = raw.flatMap((p) =>
    p.media.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path])),
  );
  const urls = await getSignedUrls(BUCKETS.posts, paths);
  const cards = raw.map((p) => ({
    ...p,
    aspect_ratio: Number(p.aspect_ratio),
    audioUrl: p.audio ? getPublicUrl(BUCKETS.audio, p.audio.audio_path) : null,
    media: p.media.map((m) => ({
      ...m,
      url: urls[m.path] ?? null,
      thumbUrl: m.thumb_path ? (urls[m.thumb_path] ?? null) : null,
    })),
  }));
  for (const c of cards) qc.setQueryData(feedKeys.card(c.id), c);
  return cards;
}

/** One post card. Lists seed it; mutations update it, so every list showing the post stays in sync. */
export function usePostCard(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: feedKeys.card(id ?? ''),
    enabled: !!id,
    staleTime: URL_STALE_MS / 4,
    queryFn: async () => (await fetchCards(qc, [id!]))[0] ?? null,
  });
}

function patchCard(qc: QueryClient, id: string, patch: (p: FeedPost) => Partial<FeedPost>) {
  qc.setQueryData<FeedPost | null>(feedKeys.card(id), (p) => (p ? { ...p, ...patch(p) } : p));
}

// ---------------------------------------------------------------------------------------------
// Home (page 43): ranked following posts of the last 3 days → "caught up" → suggested posts
// ---------------------------------------------------------------------------------------------

const PAGE = 8;

type HomeParam = { phase: 'home' | 'suggested'; offset: number; snapshot: string | null };
type HomePage = { entries: FeedEntry[]; next: HomeParam | null; snapshot: string };

export function useHomeFeed() {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: feedKeys.home,
    initialPageParam: { phase: 'home', offset: 0, snapshot: null } as HomeParam,
    staleTime: Infinity,
    queryFn: async ({ pageParam }): Promise<HomePage> => {
      const snapshot = pageParam.snapshot ?? new Date().toISOString();
      const entries: FeedEntry[] = [];
      let next: HomeParam | null;

      if (pageParam.phase === 'home') {
        const { data, error } = await supabase.rpc('home_feed', {
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
        for (const r of data) {
          if (!visible.has(r.post_id)) continue;
          entries.push({
            type: 'post',
            key: `h:${r.post_id}`,
            postId: r.post_id,
            reason: r.reason as FeedReason,
            repostedBy: r.reposted_by_id
              ? {
                  id: r.reposted_by_id,
                  username: r.reposted_by_username,
                  note: r.repost_note,
                }
              : undefined,
          });
        }
        if (data.length < PAGE) {
          entries.push({ type: 'caught-up', key: 'caught-up' });
          next = { phase: 'suggested', offset: 0, snapshot };
        } else {
          next = { phase: 'home', offset: pageParam.offset + data.length, snapshot };
        }
        return { entries, next, snapshot };
      }

      const { data, error } = await supabase.rpc('suggested_posts', {
        p_snapshot: snapshot,
        p_offset: pageParam.offset,
        p_limit: PAGE,
      });
      if (error) throw error;
      const cards = await fetchCards(
        qc,
        data.map((r) => r.post_id),
      );
      if (pageParam.offset === 0 && cards.length > 0) {
        entries.push({ type: 'suggested-header', key: 'suggested-header' });
      }
      for (const c of cards) {
        entries.push({ type: 'post', key: `s:${c.id}`, postId: c.id, reason: 'suggested' });
      }
      next =
        data.length < PAGE
          ? null
          : { phase: 'suggested', offset: pageParam.offset + data.length, snapshot };
      return { entries, next, snapshot };
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

/** Drop a post from the cached Home feed (Hide / Not interested / report / unfollow). */
export function removeFromFeeds(qc: QueryClient, postId: string) {
  qc.setQueriesData<InfiniteData<HomePage>>({ queryKey: feedKeys.home }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            entries: p.entries.filter((e) => e.type !== 'post' || e.postId !== postId),
          })),
        }
      : data,
  );
}

// ---------------------------------------------------------------------------------------------
// Following / Favorites (page 51): chronological, keyset paging
// ---------------------------------------------------------------------------------------------

export type ChronoKind = 'following' | 'favorites';
type ChronoParam = { before: string | null; beforeId: string | null };

export function useChronoFeed(kind: ChronoKind) {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: feedKeys.chrono(kind),
    initialPageParam: { before: null, beforeId: null } as ChronoParam,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('following_feed', {
        p_kind: kind,
        p_before: pageParam.before ?? undefined,
        p_before_id: pageParam.beforeId ?? undefined,
        p_limit: PAGE,
      });
      if (error) throw error;
      const cards = await fetchCards(
        qc,
        data.map((r) => r.post_id),
      );
      const last = data.at(-1);
      return {
        ids: cards.map((c) => c.id),
        next:
          data.length < PAGE || !last
            ? null
            : ({ before: last.published_at, beforeId: last.post_id } as ChronoParam),
      };
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

// ---------------------------------------------------------------------------------------------
// Post scroller (page 44): a profile grid / tagged / reposts / saved, opened at one post
// ---------------------------------------------------------------------------------------------

export type ScrollerSource = 'grid' | 'tagged' | 'reposts' | 'saved';
const SCROLLER_PAGE = 12;

export function usePostScroller(source: ScrollerSource | undefined, ownerId: string | undefined) {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: feedKeys.scroller(source ?? 'grid', ownerId ?? ''),
    enabled: !!source && !!ownerId,
    initialPageParam: 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: async ({ pageParam }) => {
      const { data, error } =
        source === 'saved'
          ? await supabase.rpc('saved_posts', {
              p_collection: ownerId === 'all' ? undefined : ownerId,
              p_offset: pageParam,
              p_limit: SCROLLER_PAGE,
            })
          : await supabase.rpc('profile_posts', {
              p_user: ownerId!,
              p_kind: source!,
              p_offset: pageParam,
              p_limit: SCROLLER_PAGE,
            });
      if (error) throw error;
      const cards = await fetchCards(
        qc,
        data.map((r) => r.id),
      );
      return { ids: cards.map((c) => c.id), count: data.length };
    },
    getNextPageParam: (last, pages) =>
      last.count < SCROLLER_PAGE ? undefined : pages.reduce((n, p) => n + p.count, 0),
  });
}

// ---------------------------------------------------------------------------------------------
// Likes, saves, reposts, hides
// ---------------------------------------------------------------------------------------------

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ post, like }: { post: FeedPost; like: boolean }) => {
      const { error } = like
        ? await supabase.from('likes').insert({ post_id: post.id })
        : await supabase.from('likes').delete().eq('post_id', post.id);
      // Already liked / already removed: the end state is what the user asked for.
      // Deletes only touch the caller's own rows (RLS).
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ post, like }) => {
      patchCard(qc, post.id, (p) => ({
        liked: like,
        like_count: p.like_count === null ? null : Math.max(p.like_count + (like ? 1 : -1), 0),
      }));
    },
    onError: (_e, { post, like }) => {
      patchCard(qc, post.id, (p) => ({
        liked: !like,
        like_count: p.like_count === null ? null : Math.max(p.like_count + (like ? -1 : 1), 0),
      }));
    },
    onSettled: (_d, _e, { post }) =>
      qc.invalidateQueries({ queryKey: ['feed', 'likers', 'post', post.id] }),
  });
}

export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, save }: { postId: string; save: boolean }) => {
      const { error } = save
        ? await supabase.from('saves').insert({ post_id: postId })
        : await supabase.from('saves').delete().eq('post_id', postId);
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ postId, save }) => patchCard(qc, postId, () => ({ saved: save })),
    onError: (_e, { postId, save }) => patchCard(qc, postId, () => ({ saved: !save })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}

export function useAddToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, collectionId }: { postId: string; collectionId: string }) => {
      const { error } = await supabase
        .from('saved_collection_items')
        .insert({ post_id: postId, collection_id: collectionId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: (_d, { postId }) => patchCard(qc, postId, () => ({ saved: true })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}

export function useToggleRepost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      repost,
      note,
      replaceNote = false,
    }: {
      postId: string;
      repost: boolean;
      note?: string;
      /** Already reposted: only set the note. */
      replaceNote?: boolean;
    }) => {
      if (replaceNote) {
        const { error } = await supabase
          .from('reposts')
          .update({ note: note?.trim() ? note.trim() : null })
          .eq('post_id', postId);
        if (error) throw error;
        return;
      }
      const { error } = repost
        ? await supabase
            .from('reposts')
            .insert({ post_id: postId, note: note?.trim() ? note.trim() : null })
        : await supabase.from('reposts').delete().eq('post_id', postId);
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ postId, repost, replaceNote }) => {
      if (replaceNote) return;
      patchCard(qc, postId, (p) => ({
        reposted: repost,
        repost_count: Math.max(p.repost_count + (repost ? 1 : -1), 0),
      }));
    },
    onError: (_e, { postId, repost, replaceNote }) => {
      if (replaceNote) return;
      patchCard(qc, postId, (p) => ({
        reposted: !repost,
        repost_count: Math.max(p.repost_count + (repost ? -1 : 1), 0),
      }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['posts', 'grid'] });
      void qc.invalidateQueries({ queryKey: ['feed', 'scroller'] });
    },
  });
}

export type HideReason = 'hidden' | 'not_interested';

/** Hide / Not interested (with Undo). The card is replaced in place by the caller. */
export function useHidePost() {
  return useMutation({
    mutationFn: async ({
      postId,
      reason,
      undo = false,
    }: {
      postId: string;
      reason: HideReason;
      undo?: boolean;
    }) => {
      const { error } = undo
        ? await supabase.from('post_hides').delete().eq('post_id', postId)
        : await supabase
            .from('post_hides')
            .upsert({ post_id: postId, reason }, { ignoreDuplicates: true });
      if (error) throw error;
    },
  });
}

// Feed impressions are batched: cards report themselves once, flushed every few seconds.
const seenQueue = new Set<string>();
const seenSent = new Set<string>();
let seenTimer: ReturnType<typeof setTimeout> | null = null;

export function markSeen(postId: string) {
  if (seenSent.has(postId)) return;
  seenSent.add(postId);
  seenQueue.add(postId);
  if (seenTimer) return;
  seenTimer = setTimeout(() => {
    seenTimer = null;
    const ids = [...seenQueue];
    seenQueue.clear();
    void supabase.rpc('mark_posts_seen', { p_ids: ids });
  }, 3000);
}

// ---------------------------------------------------------------------------------------------
// Comments (page 46)
// ---------------------------------------------------------------------------------------------

export type Comment = Fn['post_comments']['Returns'][number] & {
  /** Optimistic row not yet confirmed by the server. */
  pending?: boolean;
  failed?: boolean;
};

const COMMENTS_PAGE = 20;

export function useComments(postId: string | undefined) {
  return useInfiniteQuery({
    queryKey: feedKeys.comments(postId ?? ''),
    enabled: !!postId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('post_comments', {
        p_post: postId!,
        p_kind: 'top',
        p_offset: pageParam,
        p_limit: COMMENTS_PAGE,
      });
      if (error) throw error;
      return data as Comment[];
    },
    getNextPageParam: (last, pages) =>
      last.length < COMMENTS_PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

export function useReplies(postId: string, commentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: feedKeys.replies(commentId),
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('post_comments', {
        p_post: postId,
        p_kind: 'replies',
        p_parent: commentId,
        p_offset: pageParam,
        p_limit: COMMENTS_PAGE,
      });
      if (error) throw error;
      return data as Comment[];
    },
    getNextPageParam: (last, pages) =>
      last.length < COMMENTS_PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

export function useHiddenComments(postId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: feedKeys.hiddenComments(postId ?? ''),
    enabled: !!postId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('post_comments', {
        p_post: postId!,
        p_kind: 'hidden',
        p_limit: 60,
      });
      if (error) throw error;
      return data as Comment[];
    },
  });
}

function invalidateComments(qc: QueryClient, postId: string) {
  void qc.invalidateQueries({ queryKey: feedKeys.comments(postId) });
  void qc.invalidateQueries({ queryKey: ['feed', 'replies'] });
  void qc.invalidateQueries({ queryKey: feedKeys.hiddenComments(postId) });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: string | null }) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, body: body.trim(), parent_id: parentId ?? null })
        .select('id, parent_id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      patchCard(qc, postId, (p) => ({ comment_count: p.comment_count + 1 }));
      invalidateComments(qc, postId);
      // Preview comments under the card.
      void qc.invalidateQueries({ queryKey: feedKeys.card(postId) });
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (comment: Comment) => {
      const { error } = await supabase.from('comments').delete().eq('id', comment.id);
      if (error) throw error;
    },
    onSuccess: (_d, comment) => {
      patchCard(qc, postId, (p) => ({
        comment_count: Math.max(
          p.comment_count - 1 - (comment.parent_id ? 0 : comment.reply_count),
          0,
        ),
      }));
      invalidateComments(qc, postId);
      void qc.invalidateQueries({ queryKey: feedKeys.card(postId) });
    },
  });
}

export function useToggleCommentLike(postId: string) {
  const qc = useQueryClient();
  const patch = (c: Comment, like: boolean) => {
    const update = (rows: Comment[]) =>
      rows.map((r) =>
        r.id === c.id
          ? { ...r, liked: like, like_count: Math.max(r.like_count + (like ? 1 : -1), 0) }
          : r,
      );
    qc.setQueriesData<InfiniteData<Comment[]>>(
      { queryKey: c.parent_id ? feedKeys.replies(c.parent_id) : feedKeys.comments(postId) },
      (data) => (data ? { ...data, pages: data.pages.map(update) } : data),
    );
  };
  return useMutation({
    mutationFn: async ({ comment, like }: { comment: Comment; like: boolean }) => {
      const { error } = like
        ? await supabase.from('comment_likes').insert({ comment_id: comment.id })
        : await supabase.from('comment_likes').delete().eq('comment_id', comment.id);
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ comment, like }) => patch(comment, like),
    onError: (_e, { comment, like }) => patch(comment, !like),
  });
}

export function usePinComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, pinned }: { commentId: string; pinned: boolean }) => {
      const { error } = await supabase.rpc('set_comment_pinned', {
        p_comment: commentId,
        p_pinned: pinned,
      });
      if (error) throw error;
    },
    onSettled: () => invalidateComments(qc, postId),
  });
}

export function useHideComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, hidden }: { commentId: string; hidden: boolean }) => {
      const { error } = await supabase.rpc('set_comment_hidden', {
        p_comment: commentId,
        p_hidden: hidden,
      });
      if (error) throw error;
    },
    onSettled: () => invalidateComments(qc, postId),
  });
}

// ---------------------------------------------------------------------------------------------
// Likers (page 47)
// ---------------------------------------------------------------------------------------------

export type LikersTarget = { kind: 'post' | 'comment'; id: string };
export type Liker = Fn['post_likers']['Returns'][number];

export function useLikers(target: LikersTarget, search: string) {
  return useInfiniteQuery({
    queryKey: feedKeys.likers(target, search),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const args = { p_search: search, p_offset: pageParam, p_limit: 30 };
      const { data, error } =
        target.kind === 'post'
          ? await supabase.rpc('post_likers', { p_post: target.id, ...args })
          : await supabase.rpc('comment_likers', { p_comment: target.id, ...args });
      if (error) throw error;
      return data as Liker[];
    },
    getNextPageParam: (last, pages) =>
      last.length < 30 ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

// ---------------------------------------------------------------------------------------------
// Reports (page 50)
// ---------------------------------------------------------------------------------------------

export type ReportTarget = 'post' | 'comment' | 'profile';
export type ReportReason = Database['public']['Tables']['reports']['Insert']['reason'];

export function useReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      targetType: ReportTarget;
      targetId: string;
      reason: ReportReason;
      subReason?: string | null;
    }) => {
      const { error } = await supabase.from('reports').upsert(
        {
          target_type: args.targetType,
          target_id: args.targetId,
          reason: args.reason,
          sub_reason: args.subReason ?? null,
        },
        { onConflict: 'reporter_id,target_type,target_id', ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    onSuccess: (_d, { targetType, targetId }) => {
      if (targetType === 'post') removeFromFeeds(qc, targetId);
    },
  });
}

/** After follow / favorite changes, feeds and cards need fresh relationship flags. */
export function invalidateFeeds(qc: QueryClient) {
  invalidatePosts(qc); // also invalidates ['feed']
}
