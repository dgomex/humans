import { useSyncExternalStore } from 'react';

import { PUBLIC_WEB_ORIGIN } from '@/features/profile/format';

/** Share / copy links for reels (`/reel/<id>`, page 64). */
export function reelUrl(postId: string) {
  return `${PUBLIC_WEB_ORIGIN}/reel/${postId}`;
}

export function audioUrl(trackId: string) {
  return `${PUBLIC_WEB_ORIGIN}/audio/${trackId}`;
}

/**
 * Reels-tab playback state shared by every reel, like Instagram: sound on by default (the Reels
 * tab unmutes; Home's mute doesn't apply) and the ⋯ playback speed stays for the session.
 */
type State = { muted: boolean; rate: number };
let state: State = { muted: false, rate: 1 };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const setReelsMuted = (muted: boolean) => set({ muted });
export const setReelsRate = (rate: number) => set({ rate });

export function useReelsMuted() {
  return useSyncExternalStore(subscribe, () => state.muted);
}

export function useReelsRate() {
  return useSyncExternalStore(subscribe, () => state.rate);
}
