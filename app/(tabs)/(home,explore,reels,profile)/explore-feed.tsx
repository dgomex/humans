import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import {
  scrollerEntries,
  useExploreScroller,
  type ExploreSource,
  type HashtagTab,
} from '@/features/explore/api';
import { usePostCard } from '@/features/feed/api';
import { FeedList } from '@/features/feed/components/FeedList';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

const SOURCES: ExploreSource[] = ['explore', 'tag', 'search'];
const TABS: HashtagTab[] = ['top', 'recent', 'reels'];

/**
 * Page 70 — a post opened from Explore (or a hashtag / search grid): the tapped post, then the
 * rest of that grid (hashtag / search), then posts similar to it, then the rest of Explore.
 * Follow + "Not interested" on cards from accounts you don't follow.
 * Params: `id`, `source` (explore | tag | search), `owner` (hashtag / query), `tab`, `title`.
 */
export default function ExploreFeedScreen() {
  const params = useLocalSearchParams<{
    id: string;
    source?: string;
    owner?: string;
    tab?: string;
    title?: string;
  }>();
  const source = SOURCES.find((s) => s === params.source) ?? 'explore';
  const owner = source === 'explore' ? '' : (params.owner ?? '');
  const tab = TABS.find((t) => t === params.tab) ?? 'top';
  const { colors, spacing } = useTheme();
  const seed = usePostCard(params.id);
  const list = useExploreScroller(params.id, owner ? source : 'explore', owner, tab);

  const entries = useMemo(
    () => scrollerEntries(params.id, seed.data?.i_follow_author ?? false, list.data?.pages ?? []),
    [params.id, seed.data?.i_follow_author, list.data],
  );

  const title =
    source === 'explore' ? 'Explore' : source === 'tag' ? (params.title ?? 'Posts') : 'Posts';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        center
        title={
          <View style={{ alignItems: 'center' }}>
            {source === 'search' && params.title ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {params.title}
              </Text>
            ) : null}
            <Text variant="subhead" numberOfLines={1}>
              {title}
            </Text>
          </View>
        }
      />
      {seed.isPending ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : seed.data === null ? (
        <View style={[styles.center, { padding: spacing.xl, gap: spacing.sm }]}>
          <Icon name="camera" size={48} />
          <Text variant="headline">This post isn&apos;t available</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            It may have been deleted, or the account may be private.
          </Text>
        </View>
      ) : (
        <FeedList
          entries={entries}
          inFeed
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          loadingMore={list.isPending || list.isFetchingNextPage}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
});
