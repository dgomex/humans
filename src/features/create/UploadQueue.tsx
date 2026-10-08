import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  BUCKETS,
  localFileSize,
  removeFiles,
  storagePaths,
  uploadFileWithProgress,
} from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { deleteDrafts, draftKeys, saveDraft } from './drafts';
import { extensionOf, keepFile, readJson, removeDir, writeJson } from './localFiles';
import { renderPhoto, videoContentType, videoExtension, videoPoster } from './media';
import type { ComposerState, ComposerTag } from './types';

/**
 * Page 40 — posting state. Sharing creates a job that survives restarts (JSON + media copies in
 * app storage, per account). Every step is idempotent (client-generated ids, upserted files), so
 * a retry or a resumed job continues where it stopped:
 *   prepare (crop/compress, posters) → insert post (uploading) → upload files → media rows →
 *   tags + collaborators → publish_post (server checks every file) → done.
 */

type UploadFile = { localUri: string; contentType: string; path: string; uploaded: boolean };

type UploadSlide = {
  mediaId: string;
  type: 'image' | 'video';
  width: number;
  height: number;
  durationMs: number | null;
  altText: string;
  tags: ComposerTag[];
  file: UploadFile;
  thumb: UploadFile | null;
};

export type UploadStage = 'preparing' | 'uploading' | 'publishing' | 'done' | 'failed';

export type UploadJob = {
  postId: string;
  userId: string;
  createdAt: string;
  /** Local image for the banner / grid placeholder. */
  coverUri: string;
  stage: UploadStage;
  progress: number;
  error: string | null;
  /** The failure looked like a lost connection: retried automatically. */
  offline: boolean;
  attempts: number;
  prepared: boolean;
  postCreated: boolean;
  mediaCreated: boolean;
  extrasCreated: boolean;
  slides: UploadSlide[];
  /** What the user shared (kept to "Save draft" a failed post). */
  composer: ComposerState;
};

type UploadQueueValue = {
  jobs: UploadJob[];
  enqueue: (state: ComposerState) => Promise<void>;
  retry: (postId: string) => void;
  discard: (postId: string) => Promise<void>;
  saveAsDraft: (postId: string) => Promise<void>;
};

const UploadQueueContext = createContext<UploadQueueValue | null>(null);

const folder = (userId: string) => ['uploads', userId];
const QUEUE = 'queue.json';
const RETRY_DELAYS = [3_000, 10_000, 30_000, 60_000];
const DONE_VISIBLE_MS = 3_000;

const isDuplicate = (e: { code?: string } | null) => e?.code === '23505';

function looksOffline(message: string) {
  return /network|fetch|timed? ?out|offline|connection|socket|unreachable/i.test(message);
}

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const qc = useQueryClient();
  const [jobs, setJobsState] = useState<UploadJob[]>([]);
  const jobsRef = useRef<UploadJob[]>([]);
  const running = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = useRef<string | null>(null);
  const retryOfflineRef = useRef<() => void>(() => {});

  const commit = useCallback((next: UploadJob[]) => {
    jobsRef.current = next;
    setJobsState(next);
    const owner = loadedFor.current;
    if (owner) {
      writeJson(
        folder(owner),
        QUEUE,
        next.filter((j) => j.stage !== 'done'),
      );
    }
  }, []);

  const patch = useCallback(
    (postId: string, change: Partial<UploadJob>) => {
      commit(jobsRef.current.map((j) => (j.postId === postId ? { ...j, ...change } : j)));
    },
    [commit],
  );

  const removeJob = useCallback(
    (postId: string) => {
      commit(jobsRef.current.filter((j) => j.postId !== postId));
      if (loadedFor.current) removeDir([...folder(loadedFor.current), postId]);
    },
    [commit],
  );

  const prepare = useCallback(async (job: UploadJob): Promise<UploadJob> => {
    const { composer } = job;
    const dir = [...folder(job.userId), job.postId];
    const slides: UploadSlide[] = [];
    for (const item of composer.items) {
      const mediaId = Crypto.randomUUID();
      if (item.type === 'image') {
        const out = await renderPhoto(item, composer.ratio);
        const localUri = await keepFile(out.uri, dir, `${mediaId}.jpg`);
        slides.push({
          mediaId,
          type: 'image',
          width: out.width,
          height: out.height,
          durationMs: null,
          altText: item.altText.trim(),
          tags: item.tags,
          file: {
            localUri,
            contentType: 'image/jpeg',
            path: storagePaths.postMedia(job.userId, job.postId, mediaId, 'jpg'),
            uploaded: false,
          },
          thumb: null,
        });
      } else {
        const contentType = videoContentType(item);
        const ext = videoExtension(contentType);
        const localUri = await keepFile(item.uri, dir, `${mediaId}.${ext}`);
        const poster = await videoPoster(item.uri).catch(() => null);
        const thumbUri = poster ? await keepFile(poster.uri, dir, `${mediaId}-thumb.jpg`) : null;
        slides.push({
          mediaId,
          type: 'video',
          width: item.width,
          height: item.height,
          durationMs: item.durationMs ? Math.round(item.durationMs) : null,
          altText: item.altText.trim(),
          tags: item.tags.map((t) => ({ ...t, x: null, y: null })),
          file: {
            localUri,
            contentType,
            path: storagePaths.postMedia(job.userId, job.postId, mediaId, ext),
            uploaded: false,
          },
          thumb: thumbUri
            ? {
                localUri: thumbUri,
                contentType: 'image/jpeg',
                path: storagePaths.postMedia(job.userId, job.postId, `${mediaId}-thumb`, 'jpg'),
                uploaded: false,
              }
            : null,
        });
      }
    }
    const cover = slides[0];
    return {
      ...job,
      slides,
      prepared: true,
      coverUri: cover ? (cover.thumb?.localUri ?? cover.file.localUri) : job.coverUri,
    };
  }, []);

  const runJob = useCallback(
    async (start: UploadJob) => {
      let job = start;
      const set = (change: Partial<UploadJob>) => {
        job = { ...job, ...change };
        patch(job.postId, change);
      };
      set({ stage: job.prepared ? 'uploading' : 'preparing', error: null, offline: false });

      if (!job.prepared) {
        const prepared = await prepare(job);
        set({ ...prepared, stage: 'uploading', progress: 0.05 });
      }

      const c = job.composer;
      if (!job.postCreated) {
        const { error } = await supabase.from('posts').insert({
          id: job.postId,
          caption: c.caption.trim(),
          aspect_ratio: Math.round(c.ratio * 10000) / 10000,
          audience: c.audience,
          hide_like_counts: c.hideLikeCounts,
          comments_disabled: c.commentsDisabled,
          audio_track_id: c.music?.trackId ?? null,
          audio_start_ms: c.music?.startMs ?? 0,
        });
        if (error && !isDuplicate(error)) throw error;
        set({ postCreated: true });
      }

      // Byte-weighted progress across all files (5% prepare … 95% uploaded … 100% published).
      const files = job.slides.flatMap((s) => (s.thumb ? [s.file, s.thumb] : [s.file]));
      const sizes = files.map((f) => Math.max(1, localFileSize(f.localUri)));
      const total = sizes.reduce((a, b) => a + b, 0);
      let done = files.reduce((sum, f, i) => sum + (f.uploaded ? sizes[i] : 0), 0);
      for (const [i, f] of files.entries()) {
        if (f.uploaded) continue;
        await uploadFileWithProgress(BUCKETS.posts, f.path, f.localUri, f.contentType, (sent) => {
          const p = 0.05 + 0.9 * ((done + Math.min(sent, sizes[i])) / total);
          job = { ...job, progress: p };
          // Progress isn't persisted on every tick; state only.
          jobsRef.current = jobsRef.current.map((j) =>
            j.postId === job.postId ? { ...j, progress: p } : j,
          );
          setJobsState(jobsRef.current);
        });
        f.uploaded = true;
        done += sizes[i];
        set({ slides: [...job.slides], progress: 0.05 + 0.9 * (done / total) });
      }

      if (!job.mediaCreated) {
        for (const [position, s] of job.slides.entries()) {
          const { error } = await supabase.from('post_media').insert({
            id: s.mediaId,
            post_id: job.postId,
            position,
            type: s.type,
            path: s.file.path,
            thumb_path: s.thumb?.path ?? null,
            width: s.width,
            height: s.height,
            duration_ms: s.durationMs,
            alt_text: s.altText || null,
          });
          if (error && !isDuplicate(error)) throw error;
        }
        set({ mediaCreated: true });
      }

      if (!job.extrasCreated) {
        const tags = job.slides.flatMap((s) =>
          s.tags.map((t) => ({
            post_id: job.postId,
            media_id: s.mediaId,
            tagged_user_id: t.userId,
            x: t.x,
            y: t.y,
          })),
        );
        for (const t of tags) {
          const { error } = await supabase.from('post_tags').insert(t);
          if (error && !isDuplicate(error)) throw error;
        }
        for (const person of c.collaborators) {
          const { error } = await supabase
            .from('post_collaborators')
            .insert({ post_id: job.postId, user_id: person.id });
          if (error && !isDuplicate(error)) throw error;
        }
        set({ extrasCreated: true });
      }

      set({ stage: 'publishing', progress: 0.97 });
      const { error } = await supabase.rpc('publish_post', { p_post: job.postId });
      if (error) throw error;

      set({ stage: 'done', progress: 1 });
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['posts'] });
      if (c.draftId) {
        // Posting a draft removes it, like Instagram.
        await deleteDrafts(job.userId, [c.draftId]).catch(() => {});
        void qc.invalidateQueries({ queryKey: draftKeys.list(job.userId) });
      }
      removeDir([...folder(job.userId), job.postId]);
      setTimeout(() => {
        commit(jobsRef.current.filter((j) => j.postId !== job.postId));
      }, DONE_VISIBLE_MS);
    },
    [commit, patch, prepare, qc],
  );

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = jobsRef.current.find(
          (j) => j.stage === 'preparing' || j.stage === 'uploading' || j.stage === 'publishing',
        );
        if (!next) break;
        try {
          await runJob(next);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          let offline = looksOffline(message);
          if (!offline && Platform.OS !== 'web') {
            const net = await Network.getNetworkStateAsync().catch(() => null);
            offline = net?.isInternetReachable === false || net?.isConnected === false;
          }
          const attempts = next.attempts + 1;
          patch(next.postId, { stage: 'failed', error: message, offline, attempts });
          if (offline) {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            const delay = RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)];
            retryTimer.current = setTimeout(() => retryOfflineRef.current(), delay);
          }
        }
      }
    } finally {
      running.current = false;
    }
  }, [patch, runJob]);

  /** Re-queue jobs that failed because the connection dropped. */
  const retryOffline = useCallback(() => {
    const failed = jobsRef.current.filter((j) => j.stage === 'failed' && j.offline);
    if (failed.length === 0) return;
    commit(
      jobsRef.current.map((j) =>
        j.stage === 'failed' && j.offline ? { ...j, stage: 'uploading' as const } : j,
      ),
    );
    void pump();
  }, [commit, pump]);

  useEffect(() => {
    retryOfflineRef.current = retryOffline;
  }, [retryOffline]);

  // Load this account's queue (resume after a restart or account switch).
  useEffect(() => {
    if (!userId || loadedFor.current === userId) return;
    let cancelled = false;
    void readJson<UploadJob[]>(folder(userId), QUEUE, []).then((saved) => {
      if (cancelled) return;
      loadedFor.current = userId;
      // Interrupted jobs resume; failed ones wait for Retry (offline ones retry on reconnect).
      commit(
        saved.map((j) =>
          j.stage === 'failed' ? j : { ...j, stage: j.prepared ? 'uploading' : 'preparing' },
        ),
      );
      void pump();
    });
    return () => {
      cancelled = true;
    };
  }, [userId, commit, pump]);

  // Back online / back in the foreground → retry offline failures.
  useEffect(() => {
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') retryOffline();
    });
    const netSub =
      Platform.OS === 'web'
        ? null
        : Network.addNetworkStateListener((s) => {
            if (s.isConnected && s.isInternetReachable !== false) retryOffline();
          });
    return () => {
      appSub.remove();
      netSub?.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [retryOffline]);

  const enqueue = useCallback(
    async (state: ComposerState) => {
      if (!userId) throw new Error('not_authenticated');
      const postId = Crypto.randomUUID();
      const dir = [...folder(userId), postId];
      // Copy the originals first so a restart before "prepare" finishes can still resume.
      const items = [];
      for (const [i, item] of state.items.entries()) {
        const ext = extensionOf(item.uri, item.type === 'video' ? 'mp4' : 'jpg');
        items.push({ ...item, uri: await keepFile(item.uri, dir, `source-${i}.${ext}`) });
      }
      const job: UploadJob = {
        postId,
        userId,
        createdAt: new Date().toISOString(),
        coverUri: items[0]?.uri ?? '',
        stage: 'preparing',
        progress: 0,
        error: null,
        offline: false,
        attempts: 0,
        prepared: false,
        postCreated: false,
        mediaCreated: false,
        extrasCreated: false,
        slides: [],
        composer: { ...state, items },
      };
      commit([job, ...jobsRef.current]);
      void pump();
    },
    [userId, commit, pump],
  );

  const retry = useCallback(
    (postId: string) => {
      patch(postId, { stage: 'uploading', error: null, offline: false });
      void pump();
    },
    [patch, pump],
  );

  const discard = useCallback(
    async (postId: string) => {
      const job = jobsRef.current.find((j) => j.postId === postId);
      if (!job) return;
      removeJob(postId);
      if (job.postCreated) await supabase.from('posts').delete().eq('id', postId);
      const uploaded = job.slides
        .flatMap((s) => (s.thumb ? [s.file, s.thumb] : [s.file]))
        .filter((f) => f.uploaded)
        .map((f) => f.path);
      await removeFiles(BUCKETS.posts, uploaded).catch(() => {});
    },
    [removeJob],
  );

  const saveAsDraft = useCallback(
    async (postId: string) => {
      const job = jobsRef.current.find((j) => j.postId === postId);
      if (!job) return;
      await saveDraft(job.userId, job.composer);
      void qc.invalidateQueries({ queryKey: draftKeys.list(job.userId) });
      await discard(postId);
    },
    [discard, qc],
  );

  const value = useMemo(
    () => ({
      jobs: jobs.filter((j) => j.userId === userId),
      enqueue,
      retry,
      discard,
      saveAsDraft,
    }),
    [jobs, userId, enqueue, retry, discard, saveAsDraft],
  );

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error('useUploadQueue must be used inside <UploadQueueProvider>');
  return ctx;
}
