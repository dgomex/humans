import { useSyncExternalStore } from 'react';

import { PUBLIC_WEB_ORIGIN } from '@/features/profile/format';

/** Feed timestamp under a post: "Just now", "5 minutes ago", "3 hours ago", "2 days ago", "March 4". */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const date = new Date(iso);
  const s = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (s < 60) return 'Just now';
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (s < 3600) return unit(Math.floor(s / 60), 'minute');
  if (s < 86_400) return unit(Math.floor(s / 3600), 'hour');
  if (s < 7 * 86_400) return unit(Math.floor(s / 86_400), 'day');
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Compact age used in comments: "now", "5m", "3h", "2d", "4w", then "52w". */
export function shortAge(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return `${Math.floor(s / (7 * 86_400))}w`;
}

export function postUrl(postId: string) {
  return `${PUBLIC_WEB_ORIGIN}/p/${postId}`;
}

// Feed videos share one mute switch, like Instagram (unmute one → the next plays with sound).
let muted = true;
const listeners = new Set<() => void>();

export function setFeedMuted(next: boolean) {
  muted = next;
  listeners.forEach((l) => l());
}

export function useFeedMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}
