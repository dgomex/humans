import type {
  ReelOverlay,
  ReelRemixParams,
  ReelVolumes,
  RemixLayout,
} from '@/features/reels/types';

/** Client-side state of a post being created (pages 32–40). Also what a draft (42) stores. */

/** Crop window as fractions of the source image (0–1). */
export type Crop = { x: number; y: number; width: number; height: number };

/** A tag bubble on a slide (page 37). Video slides use x = y = null (listed, not placed). */
export type ComposerTag = {
  userId: string;
  username: string;
  x: number | null;
  y: number | null;
};

export type ComposerItem = {
  /** Stable key for lists / reordering. */
  key: string;
  uri: string;
  type: 'image' | 'video';
  /** Source size in pixels. */
  width: number;
  height: number;
  durationMs?: number;
  mimeType?: string;
  /** Photos only; null = centered crop for the post ratio. */
  crop: Crop | null;
  altText: string;
  tags: ComposerTag[];
};

export type ComposerPerson = { id: string; username: string; avatar_path: string | null };

export type ComposerMusic = {
  trackId: string;
  title: string;
  artist: string;
  audioPath: string;
  durationMs: number;
  startMs: number;
};

export type Audience = 'everyone' | 'close_friends';

/**
 * Phase 6 — a reel being created (pages 59–63). Its clips are the composer `items` (in play
 * order); per-clip trims / speed are keyed by item key. Turned into a `ReelDoc` when shared.
 */
export type ReelClipEdit = { inMs: number; outMs: number; speed: number };

export type ReelVoiceoverDraft = { id: string; uri: string; atMs: number; durationMs: number };

/** Cover still (a frame grabbed from a clip, or a library photo). */
export type ReelCoverDraft = {
  kind: 'frame' | 'image';
  uri: string;
  width: number;
  height: number;
  /** Frame covers: position on the reel's own timeline (to reopen the picker there). */
  atMs?: number;
};

export type ReelState = {
  clips: Record<string, ReelClipEdit>;
  voiceovers: ReelVoiceoverDraft[];
  volumes: ReelVolumes;
  overlays: ReelOverlay[];
  cover: ReelCoverDraft | null;
  /** 3:4 grid window offset inside the 9:16 cover (0 = top, 1 = bottom). */
  coverOffset: number;
  allowRemix: boolean;
  allowDownload: boolean;
  remix: ({ postId: string; layout: RemixLayout } & ReelRemixParams) | null;
  linkedReel: { id: string; coverPath: string | null } | null;
  /** "Use audio" with someone's original audio (the app plays their reel's sound). */
  borrowedAudio: { trackId: string; title: string; artist: string; originPostId: string } | null;
  /** Name for this reel's own original audio ("Rename audio", page 61). */
  audioTitle: string;
};

export type ComposerState = {
  items: ComposerItem[];
  /** width / height shared by every slide. */
  ratio: number;
  caption: string;
  audience: Audience;
  hideLikeCounts: boolean;
  commentsDisabled: boolean;
  collaborators: ComposerPerson[];
  music: ComposerMusic | null;
  /** Set when the composer was opened from a draft (re-saving replaces it). */
  draftId: string | null;
  /** Set for reels (Phase 6); null / absent for posts. */
  reel?: ReelState | null;
};

export const MAX_ITEMS = 20;
export const MAX_TAGS = 20;
export const MAX_COLLABORATORS = 5;
export const MAX_CAPTION = 2200;
export const MAX_VIDEO_MS = 60_000;
export const MAX_ALT = 1000;
/** Music clip length on photo posts. */
export const MUSIC_CLIP_MS = 15_000;

export const emptyReel = (): ReelState => ({
  clips: {},
  voiceovers: [],
  volumes: { camera: 1, music: 1, voiceover: 1, original: 1 },
  overlays: [],
  cover: null,
  coverOffset: 0.5,
  allowRemix: true,
  allowDownload: true,
  remix: null,
  linkedReel: null,
  borrowedAudio: null,
  audioTitle: '',
});

export const emptyComposer = (): ComposerState => ({
  items: [],
  ratio: 1,
  caption: '',
  audience: 'everyone',
  hideLikeCounts: false,
  commentsDisabled: false,
  collaborators: [],
  music: null,
  draftId: null,
});
