import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';

/**
 * Supabase Storage helpers (our "S3"). Bucket layout + access rules: docs/ARCHITECTURE.md.
 * The first path segment is always the owner id (or thread id for `messages`) — storage RLS
 * policies check it, so always build paths with `storagePaths`.
 */
export const BUCKETS = {
  avatars: 'avatars',
  posts: 'posts',
  reels: 'reels',
  stories: 'stories',
  messages: 'messages',
  highlightCovers: 'highlights-covers',
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Buckets served by public URL; everything else needs a signed URL. */
export const PUBLIC_BUCKETS: readonly Bucket[] = [BUCKETS.avatars, BUCKETS.highlightCovers];

/** Default lifetime for signed URLs (seconds). */
export const SIGNED_URL_TTL = 60 * 60;

export const storagePaths = {
  avatar: (userId: string, ext = 'jpg') => `${userId}/${Crypto.randomUUID()}.${ext}`,
  postMedia: (userId: string, postId: string, index: number, ext: string) =>
    `${userId}/${postId}/${index}.${ext}`,
  reelVideo: (userId: string, reelId: string) => `${userId}/${reelId}/video.mp4`,
  reelCover: (userId: string, reelId: string) => `${userId}/${reelId}/cover.jpg`,
  story: (userId: string, storyId: string, ext: string) => `${userId}/${storyId}.${ext}`,
  message: (threadId: string, messageId: string, ext: string) => `${threadId}/${messageId}.${ext}`,
  highlightCover: (userId: string, highlightId: string) => `${userId}/${highlightId}.jpg`,
};

export type UploadOptions = {
  contentType: string;
  /** Overwrite an existing object at the same path. Default false. */
  upsert?: boolean;
};

/** Upload a local file (`file://…` from the camera / image picker) and return its storage path. */
export async function uploadFile(
  bucket: Bucket,
  path: string,
  localUri: string,
  { contentType, upsert = false }: UploadOptions,
): Promise<string> {
  const body = await new File(localUri).arrayBuffer();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert });
  if (error) throw error;
  return data.path;
}

/** Public URL for objects in public buckets (avatars, highlight covers). */
export function getPublicUrl(bucket: Bucket, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Signed URL for a private object. RLS decides whether the caller may read it. */
export async function getSignedUrl(
  bucket: Bucket,
  path: string,
  expiresIn = SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Batch-sign many paths in one request (feeds/grids). Returns path → URL; unreadable paths are omitted. */
export async function getSignedUrls(
  bucket: Bucket,
  paths: string[],
  expiresIn = SIGNED_URL_TTL,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  }
  return out;
}

/** Resolve a display URL for any bucket (public URL or signed URL). */
export async function getMediaUrl(bucket: Bucket, path: string): Promise<string> {
  return PUBLIC_BUCKETS.includes(bucket) ? getPublicUrl(bucket, path) : getSignedUrl(bucket, path);
}

export async function removeFiles(bucket: Bucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}
