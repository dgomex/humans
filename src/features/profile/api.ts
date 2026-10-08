import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

type Fn = Database['public']['Functions'];
type Tables = Database['public']['Tables'];

/** One profile + the viewer's relationship to it (`get_profile` RPC). */
export type ProfileDetails = Fn['get_profile']['Returns'][number];
export type Connection = Fn['profile_connections']['Returns'][number];
export type PickerPerson = Fn['people_picker']['Returns'][number];
export type Highlight = Tables['highlights']['Row'];
export type NotificationPrefs = Tables['profile_notification_prefs']['Row'];
export type ConnectionKind = 'followers' | 'following' | 'mutual';

export type ProfileLink = { url: string; title?: string };
export type MutualPreview = { username: string; avatar_path: string | null };

/** Relationship shown by the follow button. */
export type FollowStatus = 'none' | 'following' | 'requested';

export const profileKeys = {
  all: ['profile'] as const,
  byUsername: (username: string) => ['profile', 'username', username.toLowerCase()] as const,
  byId: (id: string) => ['profile', 'id', id] as const,
  connections: (userId: string, kind: ConnectionKind, search: string) =>
    ['profile', 'connections', userId, kind, search] as const,
  highlights: (userId: string) => ['profile', 'highlights', userId] as const,
  picker: (search: string) => ['profile', 'picker', search] as const,
  bell: (targetId: string) => ['profile', 'bell', targetId] as const,
  followRequests: ['profile', 'followRequests'] as const,
};

export function parseLinks(links: Json | null | undefined): ProfileLink[] {
  return Array.isArray(links)
    ? links.filter(
        (l): l is ProfileLink =>
          !!l && typeof l === 'object' && !Array.isArray(l) && typeof l.url === 'string',
      )
    : [];
}

export function parseMutuals(value: Json | null | undefined): MutualPreview[] {
  return Array.isArray(value) ? (value as MutualPreview[]) : [];
}

export function followStatusOf(p: { i_follow: boolean; requested: boolean }): FollowStatus {
  return p.i_follow ? 'following' : p.requested ? 'requested' : 'none';
}

async function fetchProfile(args: { username?: string; userId?: string }) {
  const { data, error } = await supabase.rpc('get_profile', {
    p_username: args.username,
    p_user_id: args.userId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Profile by username (other profiles) or id (own profile). `null` = not found. */
export function useProfile(args: { username?: string; userId?: string }) {
  const key = args.userId
    ? profileKeys.byId(args.userId)
    : profileKeys.byUsername(args.username ?? '');
  return useQuery({
    queryKey: key,
    enabled: !!(args.userId || args.username),
    queryFn: () => fetchProfile(args),
  });
}

/** Refresh every cached profile/list (after follow changes, edits). */
export function invalidateProfiles(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: profileKeys.all }),
    qc.invalidateQueries({ queryKey: ['follows'] }),
  ]);
}

/** Patch the cached relationship of one profile (optimistic follow button). */
function patchCachedProfile(qc: QueryClient, userId: string, patch: Partial<ProfileDetails>) {
  qc.setQueriesData<ProfileDetails | null>({ queryKey: profileKeys.all }, (old) =>
    old && typeof old === 'object' && 'id' in old && old.id === userId ? { ...old, ...patch } : old,
  );
}

/**
 * Follow (public → following, private → requested), unfollow, or cancel a request.
 * Optimistically updates the cached profile and its follower counter.
 */
export function useFollowAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, follow }: { userId: string; follow: boolean }) => {
      if (follow) {
        const { data, error } = await supabase.rpc('follow_user', { target: userId });
        if (error) throw error;
        return data as FollowStatus;
      }
      const { error } = await supabase.rpc('unfollow_user', { target: userId });
      if (error) throw error;
      return 'none' as FollowStatus;
    },
    onSuccess: (status, { userId }) => {
      patchCachedProfile(qc, userId, {
        i_follow: status === 'following',
        requested: status === 'requested',
      });
    },
    onSettled: () => invalidateProfiles(qc),
  });
}

/** Remove someone who follows you (they aren't notified). */
export function useRemoveFollower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ me, followerId }: { me: string; followerId: string }) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', me);
      if (error) throw error;
    },
    onSettled: () => invalidateProfiles(qc),
  });
}

export type ProfileEdit = Partial<
  Pick<Tables['profiles']['Update'], 'username' | 'full_name' | 'bio' | 'links' | 'is_private'>
>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProfileEdit }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidateProfiles(qc),
  });
}

const PAGE = 30;

export function useConnections(userId: string | undefined, kind: ConnectionKind, search: string) {
  return useInfiniteQuery({
    queryKey: profileKeys.connections(userId ?? '', kind, search),
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('profile_connections', {
        p_user_id: userId!,
        p_kind: kind,
        p_search: search,
        p_offset: pageParam,
        p_limit: PAGE,
      });
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last, pages) =>
      last.length < PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

export function useHighlights(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.highlights(userId ?? ''),
    enabled: !!userId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('owner_id', userId!)
        .order('position')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Close Friends / Favorites (pages 30/31)
// ---------------------------------------------------------------------------------------------

export function usePeoplePicker(search: string) {
  return useQuery({
    queryKey: profileKeys.picker(search),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('people_picker', { p_search: search });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ListKind = 'close_friends' | 'favorites';

const listFlag = { close_friends: 'is_close_friend', favorites: 'is_favorite' } as const;

/** Add/remove a person on Close Friends or Favorites, optimistically. */
export function useToggleList(kind: ListKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, on }: { userId: string; on: boolean }) => {
      if (on) {
        const { error } =
          kind === 'close_friends'
            ? await supabase.from('close_friends').insert({ friend_id: userId })
            : await supabase.from('favorites').insert({ favorite_id: userId });
        if (error && error.code !== '23505') throw error; // already on the list is fine
      } else {
        const { error } =
          kind === 'close_friends'
            ? await supabase.from('close_friends').delete().eq('friend_id', userId)
            : await supabase.from('favorites').delete().eq('favorite_id', userId);
        if (error) throw error;
      }
    },
    onMutate: ({ userId, on }) => {
      const flag = listFlag[kind];
      qc.setQueriesData<PickerPerson[]>({ queryKey: ['profile', 'picker'] }, (old) =>
        old?.map((p) => (p.id === userId ? { ...p, [flag]: on } : p)),
      );
      patchCachedProfile(qc, userId, { [flag]: on });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

/** Clear the whole Close Friends list ("Remove all"). */
export function useClearCloseFriends() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (me: string) => {
      const { error } = await supabase.from('close_friends').delete().eq('owner_id', me);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

// ---------------------------------------------------------------------------------------------
// Notification bell (page 17)
// ---------------------------------------------------------------------------------------------

export type BellKey = 'posts' | 'stories' | 'reels' | 'live';

export function useBellPrefs(targetId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.bell(targetId ?? ''),
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_notification_prefs')
        .select('*')
        .eq('target_id', targetId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSetBellPref(me: string | undefined, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Record<BellKey, boolean>>) => {
      if (!me) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profile_notification_prefs')
        .upsert({ owner_id: me, target_id: targetId, ...patch });
      if (error) throw error;
    },
    onMutate: (patch) => {
      qc.setQueryData<NotificationPrefs | null>(profileKeys.bell(targetId), (old) => ({
        owner_id: me ?? '',
        target_id: targetId,
        posts: false,
        stories: false,
        reels: false,
        live: false,
        updated_at: new Date().toISOString(),
        ...old,
        ...patch,
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: profileKeys.bell(targetId) }),
  });
}

// ---------------------------------------------------------------------------------------------
// Follow requests — minimal stub for private accounts (page 72 owns the real screen, Phase 8)
// ---------------------------------------------------------------------------------------------

export function useFollowRequests(me: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.followRequests,
    enabled: !!me && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_requests')
        .select(
          'created_at, requester:profiles!follow_requests_requester_id_fkey(id, username, full_name, avatar_path)',
        )
        .eq('target_id', me!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.flatMap((r) => (r.requester ? [r.requester] : []));
    },
  });
}

export function useAnswerFollowRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      me,
      requesterId,
      approve,
    }: {
      me: string;
      requesterId: string;
      approve: boolean;
    }) => {
      if (approve) {
        const { error } = await supabase.rpc('approve_follow_request', { requester: requesterId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follow_requests')
          .delete()
          .eq('requester_id', requesterId)
          .eq('target_id', me);
        if (error) throw error;
      }
    },
    onSettled: () => invalidateProfiles(qc),
  });
}
