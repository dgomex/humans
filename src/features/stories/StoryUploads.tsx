import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
  extensionOf,
  keepFile,
  readJson,
  removeDir,
  writeJson,
} from '@/features/create/localFiles';
import { videoExtension, videoPoster } from '@/features/create/media';
import { BUCKETS, localFileSize, removeFiles, uploadFileWithProgress } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

import { purgeExpiredStories, storyKeys } from './api';
import type { DraftStory } from './StoryComposer';
import { MAX_STORY_VIDEO_MS, isInteractive, type StoryAudience, type StoryContent } from './types';

/**
 * Story posting (pages 54/55). Like posts (page 40) each shared story is a job that survives
 * restarts and retries idempotently: prepare (resize, posters) → insert story (uploading) +
 * stickers + mentions → upload files → publish_story (server checks every file).
 * Home's "Your story" circle shows the progress ring.
 */

type StoryFile = { localUri: string; path: string; contentType: string; uploaded: boolean };

type StickerRow = {
  id: string;
  type: string;
  data: NonNullable<Json>;
  correct_option: number | null;
  chain_id: string | null;
};

export type StoryJobStage = 'preparing' | 'uploading' | 'publishing' | 'done' | 'failed';

export type StoryJob = {
  storyId: string;
  userId: string;
  createdAt: string;
  stage: StoryJobStage;
  progress: number;
  error: string | null;
  offline: boolean;
  attempts: number;
  prepared: boolean;
  rowCreated: boolean;
  audience: StoryAudience;
  draft: DraftStory;
  coverUri: string | null;
  files: StoryFile[];
  row: Record<string, unknown> | null;
  stickers: StickerRow[];
  mentions: string[];
};

type Value = {
  jobs: StoryJob[];
  enqueue: (drafts: DraftStory[], audience: StoryAudience) => Promise<void>;
  retry: (storyId: string) => void;
  discard: (storyId: string) => Promise<void>;
};

const Ctx = createContext<Value | null>(null);
const folder = (userId: string) => ['story-uploads', userId];
const QUEUE = 'queue.json';
const RETRY_DELAYS = [3_000, 10_000, 30_000, 60_000];
const isDuplicate = (e: { code?: string } | null) => e?.code === '23505';
const looksOffline = (m: string) =>
  /network|fetch|timed? ?out|offline|connection|socket|unreachable/i.test(m);

async function toJpeg(uri: string, maxWidth: number, width: number, quality = 0.85) {
  let ctx = ImageManipulator.manipulate(uri);
  if (width > maxWidth) ctx = ctx.resize({ width: maxWidth });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

async function prepareJob(job: StoryJob): Promise<StoryJob> {
  const { draft, userId, storyId } = job;
  const dir = [...folder(userId), storyId];
  const base = `${userId}/${storyId}`;
  const files: StoryFile[] = [];
  const add = async (uri: string, name: string, contentType: string) => {
    const localUri = await keepFile(uri, dir, name);
    const path = `${base}/${name}`;
    files.push({ localUri, path, contentType, uploaded: false });
    return path;
  };

  const content: StoryContent = JSON.parse(JSON.stringify(draft.content));
  let mediaPath: string | null = null;
  let thumbPath: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let durationMs: number | null = null;
  let coverUri: string | null = null;

  if (draft.kind === 'photo' && draft.media) {
    const out = await toJpeg(draft.media.uri, 1080, draft.media.width);
    mediaPath = thumbPath = await add(out.uri, 'media.jpg', 'image/jpeg');
    width = out.width;
    height = out.height;
    coverUri = out.uri;
  } else if (draft.kind === 'video' && draft.media) {
    const m = draft.media;
    const contentType = m.mimeType?.startsWith('video/')
      ? m.mimeType
      : /\.mov($|\?)/i.test(m.uri)
        ? 'video/quicktime'
        : 'video/mp4';
    mediaPath = await add(draft.media.uri, `media.${videoExtension(contentType)}`, contentType);
    const poster = await videoPoster(draft.media.uri).catch(() => null);
    if (poster) {
      thumbPath = await add(poster.uri, 'thumb.jpg', 'image/jpeg');
      coverUri = poster.uri;
    }
    width = draft.media.width;
    height = draft.media.height;
    durationMs = Math.min(
      MAX_STORY_VIDEO_MS,
      Math.round(draft.media.durationMs ?? MAX_STORY_VIDEO_MS),
    );
  } else if (draft.kind === 'layout' && draft.grid) {
    const cells: (string | null)[] = [];
    for (const [i, cell] of draft.cells.entries()) {
      if (!cell) {
        cells.push(null);
        continue;
      }
      const out = await toJpeg(cell.uri, 1080, cell.width);
      cells.push(await add(out.uri, `cell-${i}.jpg`, 'image/jpeg'));
      coverUri ??= out.uri;
    }
    content.layout = { grid: draft.grid, cells };
    thumbPath = cells.find((c) => c) ?? null;
  } else if (draft.kind === 'boomerang') {
    const frames: string[] = [];
    for (const [i, f] of draft.frames.entries()) {
      const out = await toJpeg(f.uri, 720, f.width, 0.75);
      frames.push(await add(out.uri, `frame-${i}.jpg`, 'image/jpeg'));
      if (i === 0) {
        coverUri = out.uri;
        width = out.width;
        height = out.height;
      }
    }
    content.boomerang = { frames, fps: 12 };
    thumbPath = frames[0] ?? null;
  }

  // Photo stickers: local URI → storage path.
  for (const el of content.elements) {
    if (el.type === 'sticker' && el.sticker.kind === 'photo') {
      const out = await toJpeg(el.sticker.path, 720, el.sticker.width);
      el.sticker = {
        ...el.sticker,
        path: await add(out.uri, `sticker-${el.id}.jpg`, 'image/jpeg'),
      };
    }
  }

  const stickers: StickerRow[] = [];
  const mentions = new Set<string>();
  for (const el of content.elements) {
    if (el.type === 'text') for (const m of el.mentions ?? []) mentions.add(m.id);
    if (el.type !== 'sticker') continue;
    const s = el.sticker;
    if (s.kind === 'mention') mentions.add(s.userId);
    if (!isInteractive(s)) continue;
    const { kind, stickerId, ...rest } = s as typeof s & { stickerId: string };
    stickers.push({
      id: stickerId,
      type: kind,
      data: (kind === 'countdown'
        ? { title: (rest as { title: string }).title, ends_at: (rest as { endsAt: string }).endsAt }
        : rest) as NonNullable<Json>,
      correct_option: kind === 'quiz' ? (draft.quizAnswers[stickerId] ?? 0) : null,
      chain_id: kind === 'add_yours' ? (draft.chainId ?? stickerId) : null,
    });
  }
  mentions.delete(userId);

  return {
    ...job,
    prepared: true,
    coverUri,
    files,
    stickers,
    mentions: [...mentions].slice(0, 10),
    row: {
      id: storyId,
      kind: draft.kind,
      media_path: mediaPath,
      thumb_path: thumbPath,
      files: files.map((f) => f.path),
      width,
      height,
      duration_ms: durationMs,
      content,
      audience: job.audience,
      audio_track_id: draft.music?.trackId ?? null,
      audio_start_ms: draft.music?.startMs ?? 0,
      reshared_post_id: draft.resharedPostId,
    },
  };
}

export function StoryUploadsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const qc = useQueryClient();
  const [jobs, setJobsState] = useState<StoryJob[]>([]);
  const jobsRef = useRef<StoryJob[]>([]);
  const running = useRef(false);
  const loadedFor = useRef<string | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryOfflineRef = useRef<() => void>(() => {});

  const commit = useCallback((next: StoryJob[]) => {
    jobsRef.current = next;
    setJobsState(next);
    if (loadedFor.current) {
      writeJson(
        folder(loadedFor.current),
        QUEUE,
        next.filter((j) => j.stage !== 'done'),
      );
    }
  }, []);

  const patch = useCallback(
    (storyId: string, change: Partial<StoryJob>) =>
      commit(jobsRef.current.map((j) => (j.storyId === storyId ? { ...j, ...change } : j))),
    [commit],
  );

  const runJob = useCallback(
    async (start: StoryJob) => {
      let job = start;
      const set = (change: Partial<StoryJob>) => {
        job = { ...job, ...change };
        patch(job.storyId, change);
      };
      set({ stage: job.prepared ? 'uploading' : 'preparing', error: null, offline: false });
      if (!job.prepared) {
        const prepared = await prepareJob(job);
        set({ ...prepared, stage: 'uploading', progress: 0.05 });
      }

      if (!job.rowCreated) {
        const { error } = await supabase.from('stories').insert(job.row as never);
        if (error && !isDuplicate(error)) throw error;
        for (const s of job.stickers) {
          const r = await supabase.from('story_stickers').insert({ story_id: job.storyId, ...s });
          if (r.error && !isDuplicate(r.error) && r.error.message !== 'sticker_limit')
            throw r.error;
        }
        for (const m of job.mentions) {
          const r = await supabase
            .from('story_mentions')
            .insert({ story_id: job.storyId, user_id: m });
          if (r.error && !isDuplicate(r.error)) throw r.error;
        }
        set({ rowCreated: true });
      }

      const sizes = job.files.map((f) => Math.max(1, localFileSize(f.localUri)));
      const total = sizes.reduce((a, b) => a + b, 0) || 1;
      let done = job.files.reduce((sum, f, i) => sum + (f.uploaded ? sizes[i] : 0), 0);
      for (const [i, f] of job.files.entries()) {
        if (f.uploaded) continue;
        await uploadFileWithProgress(BUCKETS.stories, f.path, f.localUri, f.contentType, (sent) => {
          const p = 0.05 + 0.9 * ((done + Math.min(sent, sizes[i])) / total);
          jobsRef.current = jobsRef.current.map((j) =>
            j.storyId === job.storyId ? { ...j, progress: p } : j,
          );
          setJobsState(jobsRef.current);
        });
        f.uploaded = true;
        done += sizes[i];
        set({ files: [...job.files], progress: 0.05 + 0.9 * (done / total) });
      }

      set({ stage: 'publishing', progress: 0.97 });
      const { error } = await supabase.rpc('publish_story', { p_story: job.storyId });
      if (error) throw error;
      set({ stage: 'done', progress: 1 });
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: storyKeys.all });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      removeDir([...folder(job.userId), job.storyId]);
      commit(jobsRef.current.filter((j) => j.storyId !== job.storyId));
    },
    [commit, patch, qc],
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
          patch(next.storyId, { stage: 'failed', error: message, offline, attempts });
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

  const retryOffline = useCallback(() => {
    if (!jobsRef.current.some((j) => j.stage === 'failed' && j.offline)) return;
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

  // Load this account's queue (resume after restart / account switch) and clean up old stories.
  useEffect(() => {
    if (!userId || loadedFor.current === userId) return;
    let cancelled = false;
    void readJson<StoryJob[]>(folder(userId), QUEUE, []).then((saved) => {
      if (cancelled) return;
      loadedFor.current = userId;
      commit(
        saved.map((j) =>
          j.stage === 'failed' ? j : { ...j, stage: j.prepared ? 'uploading' : 'preparing' },
        ),
      );
      void pump();
      void purgeExpiredStories().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [userId, commit, pump]);

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
    async (drafts: DraftStory[], audience: StoryAudience) => {
      if (!userId) throw new Error('not_authenticated');
      const created: StoryJob[] = [];
      for (const d of drafts) {
        const storyId = Crypto.randomUUID();
        const dir = [...folder(userId), storyId];
        // Copy every local file first so a restart before "prepare" can still resume.
        const keep = async <T extends { uri: string; type?: string }>(m: T, name: string) => ({
          ...m,
          uri: await keepFile(
            m.uri,
            dir,
            `${name}.${extensionOf(m.uri, m.type === 'video' ? 'mp4' : 'jpg')}`,
          ),
        });
        const media = d.media ? await keep(d.media, 'source') : null;
        const cells = [];
        for (const [i, c] of d.cells.entries())
          cells.push(c ? await keep(c, `source-cell-${i}`) : null);
        const frames = [];
        for (const [i, f] of d.frames.entries()) frames.push(await keep(f, `source-frame-${i}`));
        const elements = [];
        for (const el of d.content.elements) {
          if (el.type === 'sticker' && el.sticker.kind === 'photo') {
            const uri = await keepFile(el.sticker.path, dir, `source-sticker-${el.id}.jpg`);
            elements.push({ ...el, sticker: { ...el.sticker, path: uri } });
          } else elements.push(el);
        }
        created.push({
          storyId,
          userId,
          createdAt: new Date().toISOString(),
          stage: 'preparing',
          progress: 0,
          error: null,
          offline: false,
          attempts: 0,
          prepared: false,
          rowCreated: false,
          audience,
          draft: { ...d, media, cells, frames, content: { ...d.content, elements } },
          coverUri:
            media?.type === 'image'
              ? media.uri
              : (cells.find((c) => c)?.uri ?? frames[0]?.uri ?? null),
          files: [],
          row: null,
          stickers: [],
          mentions: [],
        });
      }
      commit([...jobsRef.current, ...created]);
      void pump();
    },
    [userId, commit, pump],
  );

  const retry = useCallback(
    (storyId: string) => {
      patch(storyId, { stage: 'uploading', error: null, offline: false });
      void pump();
    },
    [patch, pump],
  );

  const discard = useCallback(
    async (storyId: string) => {
      const job = jobsRef.current.find((j) => j.storyId === storyId);
      if (!job) return;
      commit(jobsRef.current.filter((j) => j.storyId !== storyId));
      removeDir([...folder(job.userId), storyId]);
      if (job.rowCreated) await supabase.from('stories').delete().eq('id', storyId);
      await removeFiles(
        BUCKETS.stories,
        job.files.filter((f) => f.uploaded).map((f) => f.path),
      ).catch(() => {});
    },
    [commit],
  );

  const value = useMemo(
    () => ({ jobs: jobs.filter((j) => j.userId === userId), enqueue, retry, discard }),
    [jobs, userId, enqueue, retry, discard],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoryUploads() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStoryUploads must be used inside <StoryUploadsProvider>');
  return ctx;
}
