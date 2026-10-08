import { router, useScrollToTop } from 'expo-router';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type FlatListProps,
  type ViewToken,
} from 'react-native';

import { Button, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import { markSeen, type FeedEntry } from '../api';
import { PostCard } from './PostCard';

const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 300 };

/**
 * Vertical list of post cards (Home, Following / Favorites, post scroller). Tracks the focused
 * card (only it plays video) and reports impressions for ranking.
 */
export function FeedList({
  entries,
  inFeed = false,
  expandedId,
  header,
  empty,
  footer,
  refreshing = false,
  onRefresh,
  onEndReached,
  loadingMore = false,
  onScroll,
  contentInsetTop = 0,
  maintainPosition = false,
}: {
  entries: FeedEntry[];
  inFeed?: boolean;
  /** Post detail: this card's caption starts expanded. */
  expandedId?: string;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  footer?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  onScroll?: FlatListProps<FeedEntry>['onScroll'];
  contentInsetTop?: number;
  /** Keep the visible card in place when entries are prepended (post scroller). */
  maintainPosition?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedEntry>>(null);
  // Tapping the current tab again scrolls to the top.
  useScrollToTop(listRef);

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedEntry>[] }) => {
    const posts = viewableItems.filter((v) => v.item.type === 'post');
    for (const v of posts) if (v.item.type === 'post') markSeen(v.item.postId);
    setActiveKey(posts[0]?.key ?? null);
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={entries}
      keyExtractor={(e) => e.key}
      renderItem={({ item }) =>
        item.type === 'post' ? (
          <PostCard
            postId={item.postId}
            reason={item.reason}
            repostedBy={item.repostedBy}
            active={item.key === activeKey}
            inFeed={inFeed}
            expanded={item.postId === expandedId}
          />
        ) : item.type === 'caught-up' ? (
          <CaughtUp />
        ) : (
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
            <Text variant="subhead">Suggested posts</Text>
          </View>
        )
      }
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={{ margin: spacing.lg }} /> : (footer ?? null)
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={1.5}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={VIEWABILITY}
      onScroll={onScroll}
      scrollEventThrottle={16}
      maintainVisibleContentPosition={maintainPosition ? { minIndexForVisible: 0 } : undefined}
      contentContainerStyle={{ paddingTop: contentInsetTop }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={contentInsetTop}
            tintColor={colors.textSecondary}
          />
        ) : undefined
      }
      windowSize={7}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
    />
  );
}

/** "You're all caught up" between followed posts and suggestions (page 43). */
function CaughtUp() {
  const { colors, spacing, hairline } = useTheme();
  return (
    <View
      style={[
        styles.caught,
        {
          gap: spacing.sm,
          paddingVertical: spacing.xl,
          marginHorizontal: spacing.md,
          borderTopWidth: hairline,
          borderBottomWidth: hairline,
          borderColor: colors.separator,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={[styles.check, { borderColor: colors.success }]}>
        <Icon name="check" size={36} color={colors.success} />
      </View>
      <Text variant="subhead">You&apos;re all caught up</Text>
      <Text color="textSecondary">You&apos;ve seen all new posts from the past 3 days.</Text>
      <Button
        title="View older posts"
        variant="text"
        onPress={() => router.push({ pathname: '/feed/[kind]', params: { kind: 'following' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caught: { alignItems: 'center' },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
