import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { clampRatio, originalRatio } from './media';
import { MAX_REEL_CLIPS } from '@/features/reels/types';

import { emptyComposer, MAX_ITEMS, type ComposerItem, type ComposerState } from './types';

/** Posts take 20 items; reels up to 50 clips. */
const limitOf = (s: ComposerState) => (s.reel ? MAX_REEL_CLIPS : MAX_ITEMS);

type ComposerContextValue = {
  state: ComposerState;
  /** Replace the whole state (opening a draft, starting over). */
  reset: (next?: ComposerState) => void;
  /** New selection from the picker / camera; the ratio follows the first item. */
  setItems: (items: ComposerItem[]) => void;
  /** Add more items after the current ones (+ tile on the edit strip). */
  appendItems: (items: ComposerItem[]) => void;
  updateItem: (key: string, patch: Partial<ComposerItem>) => void;
  removeItem: (key: string) => void;
  moveItem: (from: number, to: number) => void;
  /** ⤢: toggle between 1:1 and the first item's original ratio. Resets crops. */
  toggleRatio: () => void;
  update: (patch: Partial<ComposerState>) => void;
  /** Patch computed from the latest state (reel edits made in quick succession). */
  updateWith: (fn: (s: ComposerState) => Partial<ComposerState>) => void;
  /** True once the user has something worth saving as a draft. */
  dirty: boolean;
  /** Call before closing the flow on purpose (shared / saved) so the "Save draft?" guard stays quiet. */
  allowExit: () => void;
  isExitAllowed: () => boolean;
};

const ComposerContext = createContext<ComposerContextValue | null>(null);

/** Shared state of the creation flow (`app/compose/*`). Lives as long as the flow is open. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComposerState>(emptyComposer);
  const exitAllowed = useRef(false);
  const allowExit = useCallback(() => {
    exitAllowed.current = true;
  }, []);
  const isExitAllowed = useCallback(() => exitAllowed.current, []);

  const reset = useCallback((next?: ComposerState) => {
    exitAllowed.current = false;
    setState(next ?? emptyComposer());
  }, []);

  const setItems = useCallback((items: ComposerItem[]) => {
    setState((s) => ({
      ...s,
      items: items.slice(0, limitOf(s)),
      // Instagram opens the first photo square; ⤢ switches to its original shape.
      ratio: 1,
    }));
  }, []);

  const appendItems = useCallback((items: ComposerItem[]) => {
    setState((s) => ({ ...s, items: [...s.items, ...items].slice(0, limitOf(s)) }));
  }, []);

  const updateItem = useCallback((key: string, patch: Partial<ComposerItem>) => {
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    }));
  }, []);

  const removeItem = useCallback((key: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) }));
  }, []);

  const moveItem = useCallback((from: number, to: number) => {
    setState((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.items.length || to >= s.items.length) {
        return s;
      }
      const items = [...s.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...s, items };
    });
  }, []);

  const toggleRatio = useCallback(() => {
    setState((s) => {
      const first = s.items[0];
      if (!first) return s;
      const original = originalRatio(first);
      const next = Math.abs(s.ratio - 1) < 0.01 && Math.abs(original - 1) > 0.01 ? original : 1;
      return {
        ...s,
        ratio: clampRatio(next),
        items: s.items.map((i) => ({ ...i, crop: null })),
      };
    });
  }, []);

  const update = useCallback((patch: Partial<ComposerState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const updateWith = useCallback((fn: (s: ComposerState) => Partial<ComposerState>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);

  const value = useMemo<ComposerContextValue>(
    () => ({
      state,
      reset,
      setItems,
      appendItems,
      updateItem,
      removeItem,
      moveItem,
      toggleRatio,
      update,
      updateWith,
      dirty: state.items.length > 0,
      allowExit,
      isExitAllowed,
    }),
    [
      state,
      reset,
      setItems,
      appendItems,
      updateItem,
      removeItem,
      moveItem,
      toggleRatio,
      update,
      updateWith,
      allowExit,
      isExitAllowed,
    ],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used inside <ComposerProvider>');
  return ctx;
}
