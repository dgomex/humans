/**
 * Story overlay document (stories.content, v1) — what the editor (page 54) produces and the viewer
 * (page 52) renders. Everything is laid out on a fixed 1080 × 1920 canvas ("units"); screens scale
 * it to their width, so a story looks the same on every device.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export type StoryKind = 'photo' | 'video' | 'text' | 'boomerang' | 'layout';
export type StoryAudience = 'everyone' | 'close_friends';

/** Center offset (units), scale, rotation (degrees). */
export type Transform = { x: number; y: number; scale: number; rotation: number };

export type FontId = 'classic' | 'modern' | 'neon' | 'typewriter' | 'strong';
export type TextBackground = 'none' | 'solid' | 'soft';
export type TextAlign = 'left' | 'center' | 'right';
export type Brush = 'pen' | 'marker' | 'neon' | 'eraser';

export type LayoutGrid = 'split-v' | 'split-h' | 'thirds' | 'quad' | 'six';

export type MentionRef = { id: string; username: string };

export type TextElement = Transform & {
  id: string;
  type: 'text';
  text: string;
  font: FontId;
  color: string;
  background: TextBackground;
  align: TextAlign;
  /** Font size in units at scale 1. */
  size: number;
  mentions?: MentionRef[];
};

export type Stroke = { brush: Exclude<Brush, 'eraser'>; color: string; width: number; d: string };

/** Free drawing (not movable): SVG path data in canvas units. */
export type DrawingElement = { id: string; type: 'drawing'; strokes: Stroke[] };

export type StickerData =
  | { kind: 'mention'; userId: string; username: string }
  | { kind: 'hashtag'; tag: string }
  | { kind: 'link'; url: string; label?: string }
  | { kind: 'poll'; stickerId: string; question: string; options: string[] }
  | { kind: 'quiz'; stickerId: string; question: string; options: string[] }
  | { kind: 'question'; stickerId: string; prompt: string }
  | { kind: 'slider'; stickerId: string; question: string; emoji: string }
  | { kind: 'countdown'; stickerId: string; title: string; endsAt: string }
  | { kind: 'add_yours'; stickerId: string; prompt: string }
  | { kind: 'time'; at: string }
  | { kind: 'photo'; path: string; width: number; height: number }
  | { kind: 'post'; postId: string }
  | { kind: 'music'; style: 'card' | 'compact' }
  /** A question answer shared from the viewers sheet (page 56). */
  | { kind: 'answer'; prompt: string; body: string };

export type StickerKind = StickerData['kind'];
export type InteractiveKind = 'poll' | 'quiz' | 'question' | 'slider' | 'countdown' | 'add_yours';

export type StickerElement = Transform & { id: string; type: 'sticker'; sticker: StickerData };

export type StoryElement = TextElement | DrawingElement | StickerElement;

export type StoryContent = {
  v: 1;
  /** Gradient behind the media (or the whole story for text stories), top → bottom. */
  background: [string, string];
  /** Photo / video placement over the contain-fit box. */
  media?: Transform;
  layout?: { grid: LayoutGrid; cells: (string | null)[] };
  boomerang?: { frames: string[]; fps: number };
  elements: StoryElement[];
};

export const INTERACTIVE: readonly StickerKind[] = [
  'poll',
  'quiz',
  'question',
  'slider',
  'countdown',
  'add_yours',
];

export const isInteractive = (
  s: StickerData,
): s is Extract<StickerData, { kind: InteractiveKind }> => INTERACTIVE.includes(s.kind);

/** Viewer timing (page 52): photos 5 s, 15 s with music, videos their length (≤ 60 s). */
export const PHOTO_MS = 5_000;
export const MUSIC_STORY_MS = 15_000;
export const MAX_STORY_VIDEO_MS = 60_000;
export const BOOMERANG_MS = 4_000;

/** Layout cells as fractions of the canvas (x, y, w, h). */
export const LAYOUT_CELLS: Record<LayoutGrid, [number, number, number, number][]> = {
  'split-v': [
    [0, 0, 1, 0.5],
    [0, 0.5, 1, 0.5],
  ],
  'split-h': [
    [0, 0, 0.5, 1],
    [0.5, 0, 0.5, 1],
  ],
  thirds: [
    [0, 0, 1, 1 / 3],
    [0, 1 / 3, 1, 1 / 3],
    [0, 2 / 3, 1, 1 / 3],
  ],
  quad: [
    [0, 0, 0.5, 0.5],
    [0.5, 0, 0.5, 0.5],
    [0, 0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5],
  ],
  six: [
    [0, 0, 0.5, 1 / 3],
    [0.5, 0, 0.5, 1 / 3],
    [0, 1 / 3, 0.5, 1 / 3],
    [0.5, 1 / 3, 0.5, 1 / 3],
    [0, 2 / 3, 0.5, 1 / 3],
    [0.5, 2 / 3, 0.5, 1 / 3],
  ],
};

export const emptyContent = (background: [string, string]): StoryContent => ({
  v: 1,
  background,
  elements: [],
});
