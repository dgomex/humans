import { router } from 'expo-router';

import { PUBLIC_WEB_ORIGIN } from '@/features/profile/format';
import type { ReelScrollerSource } from '@/features/reels/api';

import type { ExploreSource, ExploreTile, HashtagTab } from './api';

/**
 * Open a grid tile: reels go to the reel viewer (of the grid's reels when it has a reel source,
 * otherwise followed by suggested reels); posts open the Explore post scroller (page 70).
 */
export function openTile(
  tile: ExploreTile,
  ctx: { source: ExploreSource; owner?: string; tab?: HashtagTab; title?: string } = {
    source: 'explore',
  },
) {
  if (tile.kind === 'reel') {
    const reelSource: ReelScrollerSource | undefined =
      ctx.source === 'tag' && ctx.tab === 'reels' ? 'tag' : undefined;
    router.push({
      pathname: '/reel/[id]',
      params:
        reelSource && ctx.owner
          ? { id: tile.id, source: reelSource, owner: ctx.owner }
          : { id: tile.id },
    });
    return;
  }
  router.push({
    pathname: '/explore-feed',
    params: {
      id: tile.id,
      source: ctx.source,
      ...(ctx.owner ? { owner: ctx.owner } : {}),
      ...(ctx.tab ? { tab: ctx.tab } : {}),
      ...(ctx.title ? { title: ctx.title } : {}),
    },
  });
}

export function openHashtag(name: string) {
  router.push({ pathname: '/tags/[tag]', params: { tag: name.replace(/^#+/, '').toLowerCase() } });
}

export const hashtagUrl = (name: string) => `${PUBLIC_WEB_ORIGIN}/explore/tags/${name}`;
