import { router, type Href } from 'expo-router';

/** Back if there's history (deep links / reloads may have none), else go to `fallback`. */
export function goBack(fallback: Href = '/profile') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
