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
};

export const MAX_ITEMS = 20;
export const MAX_TAGS = 20;
export const MAX_COLLABORATORS = 5;
export const MAX_CAPTION = 2200;
export const MAX_VIDEO_MS = 60_000;
export const MAX_ALT = 1000;
/** Music clip length on photo posts. */
export const MUSIC_CLIP_MS = 15_000;

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
