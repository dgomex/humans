import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { followKeys, type SuggestedAccount } from '@/features/follows/api';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type NotificationType =
  | 'post_like'
  | 'comment'
  | 'comment_reply'
  | 'comment_like'
  | 'comment_mention'
  | 'post_mention'
  | 'post_tag'
  | 'follow'
  | 'follow_accepted'
  | 'collab_invite'
  | 'collab_accepted'
  | 'repost'
  | 'story_like'
  | 'story_mention'
  | 'remix'
  | 'audio_use'
  | 'countdown_ended'
  | 'add_yours'
  | 'bell_post'
  | 'bell_reel'
  | 'bell_story';

export type ActivitySection = 'new' | 'today' | 'yesterday' | 'week' | 'month' | 'older';

export type ActivityActor = { id: string; username: string; avatar_path: string | null };

/** One row of page 71: a single notification or a group (likes on a post, new followers…). */
export type ActivityGroup = {
  group_key: string;
  section: ActivitySection;
  type: NotificationType;
  latest_at: string;
  ids: string[];
  actor_count: number;
  actors: ActivityActor[];
  data: { title?: string; prompt?: string };
  post: {
    id: string;
    author_id: string;
    kind: 'post' | 'reel';
    cover_path: string | null;
    cover_type: 'image' | 'video' | null;
    media_count: number;
    cover_offset: number | null;
  } | null;
  comment: {
    id: string;
    body: string;
    parent_id: string | null;
    author_id: string;
    liked: boolean;
  } | null;
  story: {
    id: string;
    visible: boolean;
    kind?: string;
    author_id?: string;
    thumb_path?: string | null;
  } | null;
  audio: { id: string; title: string } | null;
  actor_follow: { is_private: boolean; i_follow: boolean; requested: boolean } | null;
  collab_status: 'pending' | 'accepted' | null;
};

export type ActivityBadge = {
  unseen: number;
  likes: number;
  comments: number;
  follows: number;
  requests: number;
  pending_requests: number;
};

export type FollowRequest = {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  is_private: boolean;
  i_follow: boolean;
  requested: boolean;
  created_at: string;
};

export const activityKeys = {
  all: ['activity'] as const,
  badge: ['activity', 'badge'] as const,
  feed: ['activity', 'feed'] as const,
  requestSummary: ['activity', 'request-summary'] as const,
  requests: (search: string) => ['activity', 'requests', search] as const,
  requestFrom: (userId: string) => ['activity', 'request-from', userId] as const,
  discover: ['activity', 'discover'] as const,
};

const PAGE = 30;
const timeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

// ---------------------------------------------------------------------------------------------
// Badge (Home ♡ dot + bubble)
// ---------------------------------------------------------------------------------------------

export function useActivityBadge(enabled = true) {
  return useQuery({
    queryKey: activityKeys.badge,
    enabled,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<ActivityBadge> => {
      const { data, error } = await supabase.rpc('activity_badge');
      if (error) throw error;
      return (
        (data?.[0] as ActivityBadge | undefined) ?? {
          unseen: 0,
          likes: 0,
          comments: 0,
          follows: 0,
          requests: 0,
          pending_requests: 0,
        }
      );
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Feed (page 71)
// ---------------------------------------------------------------------------------------------

type FeedPage = { groups: ActivityGroup[]; offset: number; seen: string; snapshot: string };
type FeedParam = { offset: number; seen: string | null; snapshot: string | null };

/**
 * Opening the feed marks Activity seen; the first page remembers the previous "seen" time so
 * newer rows still land under New for this visit. Pull to refresh starts a new visit.
 */
export function useActivityFeed() {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: activityKeys.feed,
    initialPageParam: { offset: 0, seen: null, snapshot: null } as FeedParam,
    staleTime: 0,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      let seen = pageParam.seen;
      if (seen === null) {
        const { data, error } = await supabase.rpc('mark_activity_seen');
        if (error) throw error;
        seen = data as string;
        qc.setQueryData<ActivityBadge>(activityKeys.badge, (b) =>
          b ? { ...b, unseen: 0, likes: 0, comments: 0, follows: 0, requests: 0 } : b,
        );
      }
      const snapshot = pageParam.snapshot ?? new Date().toISOString();
      const { data, error } = await supabase.rpc('activity_feed', {
        p_seen: seen === '-infinity' ? '1970-01-01T00:00:00Z' : seen,
        p_before: snapshot,
        p_tz: timeZone,
        p_offset: pageParam.offset,
        p_limit: PAGE,
      });
      if (error) throw error;
      return {
        groups: (data ?? []) as unknown as ActivityGroup[],
        offset: pageParam.offset,
        seen,
        snapshot,
      };
    },
    getNextPageParam: (last) =>
      last.groups.length < PAGE
        ? undefined
        : { offset: last.offset + PAGE, seen: last.seen, snapshot: last.snapshot },
  });
}

/** Remove a row (all notifications of a group) — long-press → Delete. */
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: ActivityGroup) => {
      const { error } = await supabase.from('notifications').delete().in('id', group.ids);
      if (error) throw error;
    },
    onMutate: (group) => {
      qc.setQueryData<InfiniteData<FeedPage>>(activityKeys.feed, (d) =>
        d
          ? {
              ...d,
              pages: d.pages.map((p) => ({
                ...p,
                groups: p.groups.filter((g) => g.group_key !== group.group_key),
              })),
            }
          : d,
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: activityKeys.feed }),
  });
}

/** Patch one group in the cached feed (inline follow / like / collab answers). */
export function patchActivityGroup(
  qc: ReturnType<typeof useQueryClient>,
  key: string,
  patch: (g: ActivityGroup) => ActivityGroup,
) {
  qc.setQueryData<InfiniteData<FeedPage>>(activityKeys.feed, (d) =>
    d
      ? {
          ...d,
          pages: d.pages.map((p) => ({
            ...p,
            groups: p.groups.map((g) => (g.group_key === key ? patch(g) : g)),
          })),
        }
      : d,
  );
}

export type NotificationPreview = {
  id: string;
  type: NotificationType;
  actor_username: string;
  actor_avatar_path: string | null;
  post_id: string | null;
  post_kind: 'post' | 'reel' | null;
  comment_body: string | null;
  story_id: string | null;
  data: { title?: string; prompt?: string };
};

export async function fetchNotificationPreview(id: string) {
  const { data, error } = await supabase.rpc('notification_preview', { p_id: id });
  if (error) throw error;
  return ((data ?? [])[0] as NotificationPreview | undefined) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Follow requests (page 72)
// ---------------------------------------------------------------------------------------------

export function useFollowRequestSummary(enabled = true) {
  return useQuery({
    queryKey: activityKeys.requestSummary,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('follow_request_summary');
      if (error) throw error;
      const row = data?.[0];
      return {
        total: row?.total ?? 0,
        latest: (row?.latest ?? []) as unknown as ActivityActor[],
      };
    },
  });
}

export function useMyFollowRequests(search: string) {
  return useInfiniteQuery({
    queryKey: activityKeys.requests(search),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('my_follow_requests', {
        p_search: search || undefined,
        p_offset: pageParam,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as FollowRequest[];
    },
    getNextPageParam: (last, all) => (last.length < 50 ? undefined : all.length * 50),
  });
}

/** Confirm (approve) or Delete a request; refreshes the summary row and badge afterwards. */
export function useAnswerRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requesterId, approve }: { requesterId: string; approve: boolean }) => {
      if (approve) {
        const { error } = await supabase.rpc('approve_follow_request', { requester: requesterId });
        if (error) throw error;
      } else {
        const { data: me } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('follow_requests')
          .delete()
          .eq('requester_id', requesterId)
          .eq('target_id', me.user!.id);
        if (error) throw error;
      }
    },
    onSettled: (_d, _e, { requesterId }) => {
      void qc.invalidateQueries({ queryKey: activityKeys.requestSummary });
      void qc.invalidateQueries({ queryKey: activityKeys.badge });
      void qc.invalidateQueries({ queryKey: activityKeys.requestFrom(requesterId) });
      void qc.invalidateQueries({ queryKey: ['profile'], refetchType: 'none' });
    },
  });
}

/** Does `userId` want to follow me? (banner on their profile, page 72). */
export function useRequestFrom(userId: string | undefined, me: string | undefined) {
  return useQuery({
    queryKey: activityKeys.requestFrom(userId ?? ''),
    enabled: !!userId && !!me && userId !== me,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('follow_requests')
        .select('requester_id', { count: 'exact', head: true })
        .eq('requester_id', userId!)
        .eq('target_id', me!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Suggestions (page 73)
// ---------------------------------------------------------------------------------------------

const DISCOVER_PAGE = 30;

export function useDiscoverPeople() {
  return useInfiniteQuery({
    queryKey: activityKeys.discover,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('suggested_accounts', {
        max_count: DISCOVER_PAGE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as SuggestedAccount[];
    },
    getNextPageParam: (last, all) =>
      last.length < DISCOVER_PAGE || all.length >= 4 ? undefined : all.length * DISCOVER_PAGE,
  });
}

/** ✕ on a suggestion: stored server-side so every strip skips the account. */
export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase
        .from('suggestion_dismissals')
        .upsert(
          { target_id: targetId },
          { onConflict: 'user_id,target_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onMutate: (targetId) => {
      qc.setQueryData<SuggestedAccount[]>(followKeys.suggestions, (d) =>
        d?.filter((s) => s.id !== targetId),
      );
      qc.setQueryData<InfiniteData<SuggestedAccount[]>>(activityKeys.discover, (d) =>
        d ? { ...d, pages: d.pages.map((p) => p.filter((s) => s.id !== targetId)) } : d,
      );
    },
  });
}

/** Grey reason line under a suggestion. */
export function suggestionReason(s: SuggestedAccount): string {
  switch (s.reason) {
    case 'follows_you':
      return 'Follows you';
    case 'contact':
      return 'From your contacts';
    case 'mutual':
      return s.mutual_count > 1
        ? `Followed by ${s.mutual_username} + ${s.mutual_count - 1} more`
        : `Followed by ${s.mutual_username}`;
    case 'new':
      return 'New to Humans';
    default:
      return 'Suggested for you';
  }
}

// ---------------------------------------------------------------------------------------------
// Inline actions on rows
// ---------------------------------------------------------------------------------------------

/** ♡ on a comment row (page 71). */
export function useLikeCommentInline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ group, like }: { group: ActivityGroup; like: boolean }) => {
      const id = group.comment!.id;
      const { error } = like
        ? await supabase.from('comment_likes').insert({ comment_id: id })
        : await supabase.from('comment_likes').delete().eq('comment_id', id);
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ group, like }) =>
      patchActivityGroup(qc, group.group_key, (g) =>
        g.comment ? { ...g, comment: { ...g.comment, liked: like } } : g,
      ),
    onError: (_e, { group, like }) =>
      patchActivityGroup(qc, group.group_key, (g) =>
        g.comment ? { ...g, comment: { ...g.comment, liked: !like } } : g,
      ),
    onSettled: (_d, _e, { group }) => {
      if (group.post) void qc.invalidateQueries({ queryKey: ['feed', 'comments', group.post.id] });
    },
  });
}

/** Accept / Decline a collaboration invite from its row. */
export function useAnswerCollabInline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ group, accept }: { group: ActivityGroup; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_collab_invite', {
        p_post: group.post!.id,
        p_accept: accept,
      });
      if (error) throw error;
    },
    onMutate: ({ group, accept }) =>
      patchActivityGroup(qc, group.group_key, (g) => ({
        ...g,
        collab_status: accept ? 'accepted' : null,
      })),
    onError: (_e, { group }) =>
      patchActivityGroup(qc, group.group_key, (g) => ({ ...g, collab_status: 'pending' })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['posts'], refetchType: 'none' }),
  });
}
