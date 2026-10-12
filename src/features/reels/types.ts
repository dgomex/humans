import type { StoryElement } from '@/features/stories/types';

/**
 * Reel edit document (posts.reel, v1) — decision "edit list played live": clips are uploaded as
 * recorded and this document says how to play them (order, trims, speed), plus voiceovers, the
 * audio mix, timed overlays (story text / stickers / drawing on the 1080 × 1920 canvas) and
 * remix trims. `ReelPlayer` renders it; nothing is encoded.
 */

export type ReelClip = {
  media_id: string;
  /** Trim window in the source clip (ms). Photo clips: 0 … their display time. */
  in_ms: number;
  out_ms: number;
  /** Playback speed (0.3 … 4). */
  speed: number;
};

export type ReelVoiceover = {
  id: string;
  /** posts/{author}/{post}/vo-{id}.m4a */
  path: string;
  /** Start on the reel's own timeline (ms). */
  at_ms: number;
  duration_ms: number;
};

export type ReelVolumes = { camera: number; music: number; voiceover: number; original: number };

/** Overlay elements with an optional time window (absent = whole reel). */
export type ReelOverlay = StoryElement & { start_ms?: number; end_ms?: number };

export type RemixLayout = 'side_by_side' | 'react' | 'sequence';

export type ReelRemixParams = {
  /** Sequence: the part of the original that plays first (ms on the original's timeline). */
  in_ms?: number;
  out_ms?: number;
  /** React: picture-in-picture center as fractions of the canvas. */
  pip?: { x: number; y: number };
};

export type ReelDoc = {
  v: 1;
  clips: ReelClip[];
  volumes?: Partial<ReelVolumes>;
  voiceovers?: ReelVoiceover[];
  overlays?: ReelOverlay[];
  remix?: ReelRemixParams;
};

export const DEFAULT_VOLUMES: ReelVolumes = { camera: 1, music: 1, voiceover: 1, original: 1 };

/** Recording lengths offered by the camera (page 59), max 3 minutes in the app. */
export const REEL_LENGTHS_MS = [15_000, 30_000, 60_000, 90_000, 180_000] as const;
export const MAX_REEL_MS = 180_000;
export const MAX_REEL_CLIPS = 50;
/** Photo clips show for 3 s by default (page 59 library). */
export const PHOTO_CLIP_MS = 3_000;
export const SPEEDS = [0.3, 0.5, 1, 2, 3, 4] as const;
/** Playback speeds in the ⋯ menu (page 58). */
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;
export const REEL_RATIO = 9 / 16;

export const clipLength = (c: Pick<ReelClip, 'in_ms' | 'out_ms' | 'speed'>) =>
  Math.max(0, (c.out_ms - c.in_ms) / c.speed);

export const reelLength = (clips: Pick<ReelClip, 'in_ms' | 'out_ms' | 'speed'>[]) =>
  clips.reduce((sum, c) => sum + clipLength(c), 0);

/** Whether an overlay shows at time `t` (ms on the reel's own timeline). */
export const overlayVisible = (o: ReelOverlay, t: number) =>
  (o.start_ms === undefined || t >= o.start_ms) && (o.end_ms === undefined || t < o.end_ms);

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1.2s" style label for short lengths (camera ring, clip chips). */
export const secondsLabel = (ms: number) =>
  ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
