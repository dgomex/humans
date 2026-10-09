import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ComposerMusic } from '@/features/create/types';

import { defaultMediaTransform } from './components/StoryCanvas';
import { MEDIA_BACKDROP } from './style';
import {
  emptyContent,
  type LayoutGrid,
  type StoryAudience,
  type StoryContent,
  type StoryElement,
  type StoryKind,
} from './types';

/** A local image / video picked or captured for a story. */
export type LocalMedia = {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  durationMs?: number;
  mimeType?: string;
};

/** One story being edited (page 54). Photo stickers keep their local URI in `path` until upload. */
export type DraftStory = {
  key: string;
  kind: StoryKind;
  media: LocalMedia | null;
  /** Layout cells (local URIs), boomerang frames. */
  cells: (LocalMedia | null)[];
  grid: LayoutGrid | null;
  frames: LocalMedia[];
  content: StoryContent;
  /** Quiz answers stay out of `content` (viewers can read content). stickerId → option. */
  quizAnswers: Record<string, number>;
  music: ComposerMusic | null;
  /** Add yours: the chain this story answers. */
  chainId: string | null;
  resharedPostId: string | null;
  muted: boolean;
};

export type StoryComposerState = {
  items: DraftStory[];
  index: number;
  audience: StoryAudience;
};

type Value = StoryComposerState & {
  current: DraftStory | null;
  setItems: (items: DraftStory[]) => void;
  setIndex: (i: number) => void;
  updateCurrent: (patch: Partial<DraftStory> | ((d: DraftStory) => Partial<DraftStory>)) => void;
  setElements: (fn: (els: StoryElement[]) => StoryElement[]) => void;
  setAudience: (a: StoryAudience) => void;
  reset: () => void;
};

const Ctx = createContext<Value | null>(null);

export function newDraft(kind: StoryKind, init: Partial<DraftStory> = {}): DraftStory {
  const media = init.media ?? null;
  const content = init.content ?? emptyContent(MEDIA_BACKDROP);
  return {
    key: Crypto.randomUUID(),
    kind,
    media,
    cells: [],
    grid: null,
    frames: [],
    quizAnswers: {},
    music: null,
    chainId: null,
    resharedPostId: null,
    muted: false,
    ...init,
    content: media ? { ...content, media: content.media ?? defaultMediaTransform(media) } : content,
  };
}

/** Story camera + editor + share flow state (the `/story` modal). */
export function StoryComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoryComposerState>({
    items: [],
    index: 0,
    audience: 'everyone',
  });

  const setItems = useCallback(
    (items: DraftStory[]) => setState((s) => ({ ...s, items, index: 0 })),
    [],
  );
  const setIndex = useCallback((index: number) => setState((s) => ({ ...s, index })), []);
  const updateCurrent = useCallback(
    (patch: Partial<DraftStory> | ((d: DraftStory) => Partial<DraftStory>)) =>
      setState((s) => ({
        ...s,
        items: s.items.map((d, i) =>
          i === s.index ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d,
        ),
      })),
    [],
  );
  const setElements = useCallback(
    (fn: (els: StoryElement[]) => StoryElement[]) =>
      updateCurrent((d) => ({ content: { ...d.content, elements: fn(d.content.elements) } })),
    [updateCurrent],
  );
  const setAudience = useCallback(
    (audience: StoryAudience) => setState((s) => ({ ...s, audience })),
    [],
  );
  const reset = useCallback(() => setState({ items: [], index: 0, audience: 'everyone' }), []);

  const value = useMemo(
    () => ({
      ...state,
      current: state.items[state.index] ?? null,
      setItems,
      setIndex,
      updateCurrent,
      setElements,
      setAudience,
      reset,
    }),
    [state, setItems, setIndex, updateCurrent, setElements, setAudience, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoryComposer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStoryComposer must be used inside <StoryComposerProvider>');
  return ctx;
}
