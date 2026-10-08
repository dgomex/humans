import { router } from 'expo-router';

/** Public web origin used for shareable profile links and QR codes. */
export const PUBLIC_WEB_ORIGIN = 'https://humans.app';

/** Instagram-style counter: 1,234 · 12.3K · 1.2M (no trailing ".0"). */
export function formatCount(n: number): string {
  if (n < 10_000) return n.toLocaleString('en-US');
  const [value, unit] = n < 1_000_000 ? [n / 1_000, 'K'] : [n / 1_000_000, 'M'];
  const rounded =
    value >= 100 ? Math.floor(value).toString() : (Math.floor(value * 10) / 10).toString();
  return `${rounded}${unit}`;
}

export function profileUrl(username: string) {
  return `${PUBLIC_WEB_ORIGIN}/${username}`;
}

/**
 * Username from a scanned/pasted profile link (`https://humans.app/alice`, `humans://alice`), or
 * null if it isn't one of ours.
 */
export function usernameFromUrl(text: string): string | null {
  const match =
    text.match(/^https?:\/\/(?:www\.)?humans\.app\/([a-z0-9._]{1,30})\/?(?:[?#].*)?$/i) ??
    text.match(/^humans:\/\/\/?([a-z0-9._]{1,30})\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

/** "https://www.example.com/path" → "example.com/path" (how Instagram prints bio links). */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

export function openProfile(username: string) {
  router.push({ pathname: '/[username]', params: { username } });
}

export function openConnections(username: string, tab: 'followers' | 'following' | 'mutual') {
  router.push({ pathname: '/[username]/connections', params: { username, tab } });
}
