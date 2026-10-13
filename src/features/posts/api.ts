import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { BUCKETS, getPublicUrl, getSignedUrls, removeFiles, SIGNED_URL_TTL } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Fn = Database['public']['Functions'];

export type GridPost = Fn['profile_posts']['Returns'][number] & { coverUrl: string | null };
export type GridKind = 'grid' | 'reels' | 'tagged' | 'archived' | 'reposts';
export type SearchedProfile = Fn['search_profiles']['Returns'][number];
export type AudioTrack = Database['public']['Tables']['audio_tracks']['Row'];

const PAGE = 30;
/** Signed URLs are cached a little less than their lifetime. */
const URL_STALE_MS = (SIGNED_URL_TTL - 5 * 60) * 1000;

export const postKeys = {
  all: ['posts'] as const,
  grid: (userId: string, kind: GridKind) => ['posts', 'grid', userId, kind] as const,
  detail: (id: string) => ['posts', 'detail', id] as const,
  search: (q: string) => ['posts', 'search-profiles', q] as const,
  hashtags: (q: string) => ['posts', 'hashtags', q] as const,
  tracks: (q: string, saved: boolean) => ['posts', 'tracks', q, saved] as const,
};

export function invalidatePosts(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: postKeys.all });
  void qc.invalidateQueries({ queryKey: ['profile'] });
  // Phase 4 feed cards / feeds show the same posts.
  void qc.invalidateQueries({ queryKey: ['feed'] });
}

// ---------------------------------------------------------------------------------------------
// Profile grids (Grid · Tagged) and the posts archive
// ---------------------------------------------------------------------------------------------

export function useProfilePosts(userId: string | undefined, kind: GridKind, enabled = true) {
  return useInfiniteQuery({
    queryKey: postKeys.grid(userId ?? '', kind),
    enabled: !!userId && enabled,
    initialPageParam: 0,
    staleTime: URL_STALE_MS / 4,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('profile_posts', {
        p_user: userId!,
        p_kind: kind,
        p_offset: pageParam,
        p_limit: PAGE,
      });
      if (error) throw error;
      const urls = await getSignedUrls(
        BUCKETS.posts,
        data.map((p) => p.cover_path).filter((p): p is string => !!p),
      );
      return data.map((p) => ({
        ...p,
        coverUrl: p.cover_path ? (urls[p.cover_path] ?? null) : null,
      }));
    },
    getNextPageParam: (last, pages) =>
      last.length < PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
}

// ---------------------------------------------------------------------------------------------
// One post (viewer stub of page 44, edit page 41)
// ---------------------------------------------------------------------------------------------

const POST_SELECT = `
  id, author_id, caption, aspect_ratio, status, audience, hide_like_counts, comments_disabled,
  archived_at, pinned_at, published_at, edited_at, audio_start_ms,
  author:profiles!posts_author_id_fkey ( id, username, full_name, avatar_path ),
  audio:audio_tracks ( id, title, artist, audio_path, duration_ms ),
  media:post_media ( id, position, type, path, thumb_path, width, height, duration_ms, alt_text ),
  tags:post_tags ( id, media_id, x, y, user:profiles ( id, username ) ),
  collaborators:post_collaborators ( user_id, status, user:profiles ( id, username, avatar_path ) )
`;

async function fetchPost(id: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const media = [...data.media].sort((a, b) => a.position - b.position);
  const paths = media.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path]));
  const urls = await getSignedUrls(BUCKETS.posts, paths);
  return {
    ...data,
    media: media.map((m) => ({
      ...m,
      url: urls[m.path] ?? null,
      thumbUrl: m.thumb_path ? (urls[m.thumb_path] ?? null) : null,
    })),
    audioUrl: data.audio?.audio_path ? getPublicUrl(BUCKETS.audio, data.audio.audio_path) : null,
  };
}

export type PostDetail = NonNullable<Awaited<ReturnType<typeof fetchPost>>>;
export type PostMediaItem = PostDetail['media'][number];
export type PostTag = PostDetail['tags'][number];

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: postKeys.detail(id ?? ''),
    enabled: !!id,
    staleTime: URL_STALE_MS / 4,
    queryFn: () => fetchPost(id!),
  });
}

/** Own-post toggles from the ⋯ menu (archive, pin, hide like count, commenting). */
export type PostFlags = {
  archived_at?: string | null;
  pinned_at?: string | null;
  hide_like_counts?: boolean;
  comments_disabled?: boolean;
  /** Reels (Phase 6). */
  allow_remix?: boolean;
  allow_download?: boolean;
};

export function useUpdatePostFlags(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flags: PostFlags) => {
      const { error } = await supabase.from('posts').update(flags).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePosts(qc),
  });
}

/** Delete immediately (decision: no Recently deleted) — row first, then its files. */
export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: {
      id: string;
      media: { path: string; thumb_path: string | null }[];
    }) => {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      const files = post.media.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path]));
      await removeFiles(BUCKETS.posts, files).catch(() => {});
    },
    onSuccess: () => invalidatePosts(qc),
  });
}

export type EditedSlide = {
  id: string;
  altText: string;
  tags: { userId: string; x: number | null; y: number | null }[];
};

/**
 * Page 41 — save "Edit info": caption, removed slides, order, alt text, tag changes.
 * `slides` is the final list in order (removed slides are absent).
 */
export function useSavePostEdits(post: PostDetail | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ caption, slides }: { caption: string; slides: EditedSlide[] }) => {
      if (!post) return;
      const keep = new Set(slides.map((s) => s.id));
      const removed = post.media.filter((m) => !keep.has(m.id));

      if (caption.trim() !== post.caption) {
        const { error } = await supabase
          .from('posts')
          .update({ caption: caption.trim() })
          .eq('id', post.id);
        if (error) throw error;
      }
      for (const m of removed) {
        const { error } = await supabase.from('post_media').delete().eq('id', m.id);
        if (error) throw error;
      }
      const before = post.media.filter((m) => keep.has(m.id)).map((m) => m.id);
      const after = slides.map((s) => s.id);
      if (before.join() !== after.join()) {
        const { error } = await supabase.rpc('reorder_post_media', {
          p_post: post.id,
          p_media: after,
        });
        if (error) throw error;
      }
      for (const s of slides) {
        const m = post.media.find((x) => x.id === s.id);
        if (m && (m.alt_text ?? '') !== s.altText.trim()) {
          const { error } = await supabase
            .from('post_media')
            .update({ alt_text: s.altText.trim() || null })
            .eq('id', s.id);
          if (error) throw error;
        }
        const old = post.tags.filter((t) => t.media_id === s.id);
        for (const t of old) {
          const next = s.tags.find((n) => n.userId === t.user?.id);
          if (!next) {
            const { error } = await supabase.from('post_tags').delete().eq('id', t.id);
            if (error) throw error;
          } else if (next.x !== t.x || next.y !== t.y) {
            const { error } = await supabase
              .from('post_tags')
              .update({ x: next.x, y: next.y })
              .eq('id', t.id);
            if (error) throw error;
          }
        }
        for (const n of s.tags.filter((n) => !old.some((t) => t.user?.id === n.userId))) {
          const { error } = await supabase.from('post_tags').insert({
            post_id: post.id,
            media_id: s.id,
            tagged_user_id: n.userId,
            x: n.x,
            y: n.y,
          });
          if (error) throw error;
        }
      }
      const files = removed.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path]));
      await removeFiles(BUCKETS.posts, files).catch(() => {});
    },
    onSuccess: () => invalidatePosts(qc),
  });
}

/** Tagged person removes themselves (⋯ → Remove me from post, later Phase 4 menu). */
export function useRemoveMyTag(postId: string, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('post_tags')
        .delete()
        .eq('post_id', postId)
        .eq('tagged_user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => invalidatePosts(qc),
  });
}

// ---------------------------------------------------------------------------------------------
// Collaborators
// ---------------------------------------------------------------------------------------------

export function useRespondCollab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, accept }: { postId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_collab_invite', {
        p_post: postId,
        p_accept: accept,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePosts(qc),
  });
}

// ---------------------------------------------------------------------------------------------
// Search (mentions, Tag people, collaborators) and hashtag suggestions
// ---------------------------------------------------------------------------------------------

export function useSearchProfiles(query: string, enabled = true) {
  return useQuery({
    queryKey: postKeys.search(query),
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_profiles', {
        p_query: query,
        p_limit: 20,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useHashtagSuggestions(prefix: string, enabled = true) {
  return useQuery({
    queryKey: postKeys.hashtags(prefix),
    enabled: enabled && prefix.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hashtags')
        .select('name, post_count')
        .like('name', `${prefix.toLowerCase().replace(/[%_]/g, '')}%`)
        .order('post_count', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Music catalog (page 39)
// ---------------------------------------------------------------------------------------------

export const trackUrl = (t: Pick<AudioTrack, 'audio_path'>) =>
  t.audio_path ? getPublicUrl(BUCKETS.audio, t.audio_path) : '';

export function useAudioTracks(query: string, savedOnly: boolean) {
  return useQuery({
    queryKey: postKeys.tracks(query, savedOnly),
    queryFn: async () => {
      const [tracks, saved] = await Promise.all([
        (() => {
          // The picker lists the catalog; original audio is used from its audio page (page 62).
          let q = supabase
            .from('audio_tracks')
            .select('*')
            .neq('source', 'original')
            .order('title');
          const term = query.trim().replace(/[%_,()]/g, '');
          if (term) q = q.or(`title.ilike.%${term}%,artist.ilike.%${term}%`);
          return q;
        })(),
        supabase.from('saved_audio').select('track_id'),
      ]);
      if (tracks.error) throw tracks.error;
      if (saved.error) throw saved.error;
      const savedIds = new Set(saved.data.map((s) => s.track_id));
      return tracks.data
        .map((t) => ({ ...t, audio_path: t.audio_path ?? '', saved: savedIds.has(t.id) }))
        .filter((t) => !savedOnly || t.saved);
    },
  });
}

export function useToggleSavedAudio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackId, saved }: { trackId: string; saved: boolean }) => {
      const { error } = saved
        ? await supabase.from('saved_audio').delete().eq('track_id', trackId)
        : await supabase.from('saved_audio').insert({ track_id: trackId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts', 'tracks'] }),
  });
}
