import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';

import { useComposer } from '@/features/create/ComposerProvider';
import {
  emptyComposer,
  emptyReel,
  type ComposerItem,
  type ComposerState,
  type ReelClipEdit,
  type ReelState,
} from '@/features/create/types';

import { clipEditOf, composerLength } from './source';
import { MAX_REEL_MS, PHOTO_CLIP_MS } from './types';

/** A new, empty reel composer state (camera entry, "Use audio", Remix). */
export function newReelState(patch: Partial<ReelState> = {}): ComposerState {
  return { ...emptyComposer(), ratio: 9 / 16, reel: { ...emptyReel(), ...patch } };
}

/** Recorded / picked media → a clip item (photos show for 3 s). */
export function clipItem(
  media: Pick<ComposerItem, 'uri' | 'type' | 'width' | 'height'> &
    Partial<Pick<ComposerItem, 'durationMs' | 'mimeType'>>,
): ComposerItem {
  return {
    key: Crypto.randomUUID(),
    uri: media.uri,
    type: media.type,
    width: media.width,
    height: media.height,
    durationMs: media.type === 'video' ? media.durationMs : undefined,
    mimeType: media.mimeType,
    crop: null,
    altText: '',
    tags: [],
  };
}

/**
 * Reel-specific composer actions (pages 59–63) on top of the shared composer: clip trims and
 * speed, split, voiceovers, overlays, volumes, cover and share settings.
 */
export function useReelComposer() {
  const composer = useComposer();
  const { state, updateWith } = composer;
  const reel = state.reel ?? null;

  const updateReel = useCallback(
    (patch: Partial<ReelState> | ((r: ReelState) => Partial<ReelState>)) =>
      updateWith((s) => {
        const current = s.reel ?? emptyReel();
        return { reel: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) } };
      }),
    [updateWith],
  );

  const setClip = useCallback(
    (key: string, edit: Partial<ReelClipEdit>) =>
      updateWith((s) => {
        const item = s.items.find((i) => i.key === key);
        const current = s.reel ?? emptyReel();
        if (!item) return {};
        return {
          reel: {
            ...current,
            clips: { ...current.clips, [key]: { ...clipEditOf(s, item), ...edit } },
          },
        };
      }),
    [updateWith],
  );

  /** Add clips after the current ones with their recording speed. */
  const addClips = useCallback(
    (items: ComposerItem[], speed = 1) =>
      updateWith((s) => {
        const current = s.reel ?? emptyReel();
        const clips = { ...current.clips };
        for (const item of items) {
          clips[item.key] = {
            inMs: 0,
            outMs: item.type === 'video' ? Math.max(1, item.durationMs ?? 1) : PHOTO_CLIP_MS,
            speed,
          };
        }
        return { items: [...s.items, ...items], reel: { ...current, clips } };
      }),
    [updateWith],
  );

  const removeClip = useCallback(
    (key: string) =>
      updateWith((s) => {
        const current = s.reel ?? emptyReel();
        const { [key]: _removed, ...clips } = current.clips;
        return { items: s.items.filter((i) => i.key !== key), reel: { ...current, clips } };
      }),
    [updateWith],
  );

  /** Split a clip at `atMs` of its own (sped-up) length into two clips of the same file. */
  const splitClip = useCallback(
    (key: string, atMs: number) =>
      updateWith((s) => {
        const index = s.items.findIndex((i) => i.key === key);
        const item = s.items[index];
        if (!item) return {};
        const edit = clipEditOf(s, item);
        const cut = edit.inMs + atMs * edit.speed;
        if (cut - edit.inMs < 300 || edit.outMs - cut < 300) return {};
        const second = { ...item, key: Crypto.randomUUID() };
        const current = s.reel ?? emptyReel();
        const items = [...s.items];
        items.splice(index + 1, 0, second);
        return {
          items,
          reel: {
            ...current,
            clips: {
              ...current.clips,
              [key]: { ...edit, outMs: cut },
              [second.key]: { ...edit, inMs: cut },
            },
          },
        };
      }),
    [updateWith],
  );

  const length = useMemo(() => composerLength(state), [state]);

  return {
    composer,
    state,
    reel,
    updateReel,
    setClip,
    addClips,
    removeClip,
    splitClip,
    length,
    remaining: Math.max(0, MAX_REEL_MS - length),
  };
}
