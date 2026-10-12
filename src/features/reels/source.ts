import type { ComposerItem, ComposerState } from '@/features/create/types';
import type { FeedPost } from '@/features/feed/api';

import {
  DEFAULT_VOLUMES,
  PHOTO_CLIP_MS,
  clipLength,
  type ReelOverlay,
  type ReelVolumes,
  type RemixLayout,
} from './types';

/**
 * What `ReelPlayer` plays: a flat list of segments on one timeline, plus the sound and overlays
 * of the reel's own part. Built from a published card (signed URLs) or from the composer (local
 * files) so the editor previews exactly what viewers will see.
 */
export type Segment = {
  key: string;
  type: 'video' | 'image' | 'gap';
  uri: string | null;
  poster: string | null;
  width: number;
  height: number;
  inMs: number;
  outMs: number;
  speed: number;
  /** Start / length on the composition timeline (ms, after speed). */
  start: number;
  dur: number;
  /** Camera audio level for this segment (own clips: camera, sequence original: original). */
  volume: number;
};

export type ReelSource = {
  id: string;
  segments: Segment[];
  total: number;
  /** Where the reel's own part starts (sequence remixes play the original first). */
  ownOffset: number;
  overlays: ReelOverlay[];
  voiceovers: { id: string; uri: string; atMs: number; durationMs: number }[];
  volumes: ReelVolumes;
  music: { uri: string; startMs: number } | null;
  /** Someone's original audio used as the soundtrack: their reel's sound plays alongside. */
  borrowed: ReelSource | null;
  remix: {
    layout: Exclude<RemixLayout, 'sequence'>;
    pip: { x: number; y: number };
    original: ReelSource | null;
  } | null;
  poster: string | null;
};

type ClipInput = {
  key: string;
  type: 'video' | 'image';
  uri: string | null;
  poster: string | null;
  width: number;
  height: number;
  inMs: number;
  outMs: number;
  speed: number;
};

function layoutSegments(clips: ClipInput[], volume: number, startAt = 0): Segment[] {
  let t = startAt;
  return clips.map((c) => {
    const dur = clipLength({ in_ms: c.inMs, out_ms: c.outMs, speed: c.speed });
    const seg: Segment = { ...c, start: t, dur, volume };
    t += dur;
    return seg;
  });
}

const sumDur = (segs: Segment[]) => segs.reduce((n, s) => n + s.dur, 0);

/** Clips of a published card (its document, or the media as-is for single-video posts). */
function cardClips(card: FeedPost): ClipInput[] {
  const media = new Map(card.media.map((m) => [m.id, m]));
  const fromDoc = card.reel?.clips?.length
    ? card.reel.clips
    : card.media.map((m) => ({
        media_id: m.id,
        in_ms: 0,
        out_ms: m.type === 'video' ? (m.duration_ms ?? 15_000) : PHOTO_CLIP_MS,
        speed: 1,
      }));
  return fromDoc.flatMap((c, i) => {
    const m = media.get(c.media_id);
    if (!m) return [];
    return [
      {
        key: `${m.id}:${i}`,
        type: m.type,
        uri: m.url,
        poster: m.type === 'video' ? m.thumbUrl : m.url,
        width: m.width,
        height: m.height,
        inMs: c.in_ms,
        outMs: c.out_ms,
        speed: c.speed,
      },
    ];
  });
}

/** Sequence remix: the trimmed window of the original's timeline, as segments. */
function trimSegments(original: Segment[], inMs: number, outMs: number, volume: number) {
  const out: ClipInput[] = [];
  for (const s of original) {
    const a = Math.max(inMs, s.start);
    const b = Math.min(outMs, s.start + s.dur);
    if (b <= a) continue;
    out.push({
      key: `orig:${s.key}`,
      type: s.type === 'gap' ? 'image' : s.type,
      uri: s.uri,
      poster: s.poster,
      width: s.width,
      height: s.height,
      inMs: s.inMs + (a - s.start) * s.speed,
      outMs: s.inMs + (b - s.start) * s.speed,
      speed: s.speed,
    });
  }
  return layoutSegments(out, volume);
}

export type RelatedCards = {
  /** The remixed original (undefined = loading, null = unavailable). */
  original?: FeedPost | null;
  /** The reel whose original audio this reel uses. */
  audioOrigin?: FeedPost | null;
};

/** Source for a published reel. `related` supplies the remix original / borrowed audio reel. */
export function sourceFromCard(card: FeedPost, related: RelatedCards = {}, depth = 0): ReelSource {
  const doc = card.reel;
  const volumes = { ...DEFAULT_VOLUMES, ...doc?.volumes };
  let segments = layoutSegments(cardClips(card), volumes.camera);
  let ownOffset = 0;
  let remix: ReelSource['remix'] = null;

  if (card.remix) {
    const original =
      related.original && depth === 0 ? sourceFromCard(related.original, {}, depth + 1) : null;
    if (card.remix.layout === 'sequence') {
      const inMs = doc?.remix?.in_ms ?? 0;
      const outMs = doc?.remix?.out_ms ?? original?.total ?? 0;
      const prefix = original
        ? trimSegments(original.segments, inMs, outMs, volumes.original)
        : // Original gone / not visible: a "Content unavailable" card for its length.
          layoutSegments(
            [
              {
                key: 'orig:gap',
                type: 'image',
                uri: null,
                poster: null,
                width: 1080,
                height: 1920,
                inMs: 0,
                outMs: Math.max(1000, outMs - inMs || 3000),
                speed: 1,
              },
            ],
            0,
            // Still loading: a black hold (the list restarts once the original arrives).
          ).map((s) => ({
            ...s,
            key: `${s.key}:${related.original === undefined ? 'wait' : 'gone'}`,
            type: related.original === undefined ? ('image' as const) : ('gap' as const),
          }));
      ownOffset = sumDur(prefix);
      segments = [...prefix, ...layoutSegments(cardClips(card), volumes.camera, ownOffset)];
    } else {
      remix = {
        layout: card.remix.layout,
        pip: doc?.remix?.pip ?? { x: 0.75, y: 0.22 },
        original,
      };
    }
  }

  const borrowed =
    depth === 0 &&
    card.audio?.source === 'original' &&
    card.audio.origin_post_id &&
    card.audio.origin_post_id !== card.id &&
    related.audioOrigin
      ? sourceFromCard(related.audioOrigin, {}, depth + 1)
      : null;

  return {
    id: card.id,
    segments,
    total: sumDur(segments),
    ownOffset,
    overlays: doc?.overlays ?? [],
    voiceovers: (doc?.voiceovers ?? []).flatMap((v) =>
      card.voiceoverUrls[v.path]
        ? [{ id: v.id, uri: card.voiceoverUrls[v.path], atMs: v.at_ms, durationMs: v.duration_ms }]
        : [],
    ),
    volumes,
    music:
      card.audioUrl && card.audio?.source !== 'original'
        ? { uri: card.audioUrl, startMs: card.audio_start_ms }
        : null,
    borrowed,
    remix,
    poster: card.coverUrl ?? segments.find((s) => s.poster)?.poster ?? null,
  };
}

/** Clip edits for an item (defaults: whole clip, normal speed; photos 3 s). */
export function clipEditOf(state: ComposerState, item: ComposerItem) {
  return (
    state.reel?.clips[item.key] ?? {
      inMs: 0,
      outMs: item.type === 'video' ? Math.max(1, item.durationMs ?? PHOTO_CLIP_MS) : PHOTO_CLIP_MS,
      speed: 1,
    }
  );
}

/** Own length of a composer reel (ms). */
export function composerLength(state: ComposerState) {
  return state.items.reduce((n, item) => {
    const e = clipEditOf(state, item);
    return n + clipLength({ in_ms: e.inMs, out_ms: e.outMs, speed: e.speed });
  }, 0);
}

/** Source for the reel being edited (local files). `original` = the remix original's card. */
export function sourceFromComposer(
  state: ComposerState,
  related: RelatedCards & { musicUrl?: string | null } = {},
): ReelSource {
  const reel = state.reel;
  const volumes = { ...DEFAULT_VOLUMES, ...reel?.volumes };
  const clips: ClipInput[] = state.items.map((item) => {
    const e = clipEditOf(state, item);
    return {
      key: item.key,
      type: item.type,
      uri: item.uri,
      poster: item.type === 'image' ? item.uri : null,
      width: item.width,
      height: item.height,
      inMs: e.inMs,
      outMs: e.outMs,
      speed: e.speed,
    };
  });
  let segments = layoutSegments(clips, volumes.camera);
  let ownOffset = 0;
  let remix: ReelSource['remix'] = null;
  if (reel?.remix) {
    const original = related.original ? sourceFromCard(related.original, {}, 1) : null;
    if (reel.remix.layout === 'sequence' && original) {
      const prefix = trimSegments(
        original.segments,
        reel.remix.in_ms ?? 0,
        reel.remix.out_ms ?? original.total,
        volumes.original,
      );
      ownOffset = sumDur(prefix);
      segments = [...prefix, ...layoutSegments(clips, volumes.camera, ownOffset)];
    } else if (reel.remix.layout !== 'sequence') {
      remix = {
        layout: reel.remix.layout,
        pip: reel.remix.pip ?? { x: 0.75, y: 0.22 },
        original,
      };
    }
  }
  return {
    id: 'draft',
    segments,
    total: sumDur(segments),
    ownOffset,
    overlays: reel?.overlays ?? [],
    voiceovers: (reel?.voiceovers ?? []).map((v) => ({
      id: v.id,
      uri: v.uri,
      atMs: v.atMs,
      durationMs: v.durationMs,
    })),
    volumes,
    music:
      state.music && related.musicUrl
        ? { uri: related.musicUrl, startMs: state.music.startMs }
        : null,
    borrowed: related.audioOrigin ? sourceFromCard(related.audioOrigin, {}, 1) : null,
    remix,
    poster: segments.find((s) => s.poster)?.poster ?? null,
  };
}

/** Segment at composition time `t` (clamped), with the offset inside it. */
export function segmentAt(segments: Segment[], t: number) {
  if (segments.length === 0) return { index: 0, offset: 0 };
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (t < s.start + s.dur) return { index: i, offset: Math.max(0, t - s.start) };
  }
  return { index: segments.length - 1, offset: segments[segments.length - 1].dur };
}

/** Canvas fit: media close to 9:16 fills the canvas, other shapes are letterboxed. */
export const fitFor = (w: number, h: number): 'cover' | 'contain' => {
  const r = w / h;
  return r >= 0.5 && r <= 0.68 ? 'cover' : 'contain';
};
