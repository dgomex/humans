import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { exploreKeys, useExploreGrid } from '@/features/explore/api';
import { ExploreGrid } from '@/features/explore/components/ExploreGrid';
import { openTile } from '@/features/explore/format';
import { SuggestedStrip } from '@/features/profile/components/SuggestedStrip';
import { useTheme } from '@/theme';

/**
 * Page 65 — Explore: search field (opens Search, pages 66/67) over the ranked grid with tall
 * reel tiles. Pull to refresh reshuffles; tapping the tab again scrolls to the top.
 */
export default function ExploreScreen() {
  const { colors, spacing } = useTheme();
  const qc = useQueryClient();
  const grid = useExploreGrid();
  const [refreshing, setRefreshing] = useState(false);
  const tiles = useMemo(() => (grid.data?.pages ?? []).flatMap((p) => p.tiles), [grid.data]);

  async function refresh() {
    setRefreshing(true);
    // New snapshot = new ranking + shuffle.
    await qc.resetQueries({ queryKey: exploreKeys.grid });
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          accessibilityLabel="Search"
          style={[styles.search, { backgroundColor: colors.backgroundSecondary, gap: spacing.sm }]}
        >
          <Icon name="search" size={18} color={colors.textSecondary} />
          <Text color="textSecondary">Search</Text>
        </Pressable>
      </View>
      {grid.isPending ? (
        <Skeleton />
      ) : (
        <ExploreGrid
          tiles={tiles}
          complete={!grid.hasNextPage}
          onPressTile={(t) => openTile(t)}
          onEndReached={() => {
            if (grid.hasNextPage && !grid.isFetchingNextPage) void grid.fetchNextPage();
          }}
          loadingMore={grid.isFetchingNextPage}
          refreshing={refreshing}
          onRefresh={refresh}
          empty={
            grid.isError ? (
              <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
                <Text color="textSecondary">Couldn&apos;t load Explore.</Text>
                <Button title="Try again" variant="secondary" size="sm" onPress={refresh} />
              </View>
            ) : (
              <View>
                <View style={[styles.center, { padding: spacing.xl, gap: spacing.sm }]}>
                  <Icon name="search" size={48} />
                  <Text variant="headline">Nothing to explore yet</Text>
                  <Text color="textSecondary" style={{ textAlign: 'center' }}>
                    When people share public posts and reels, you&apos;ll find them here.
                  </Text>
                </View>
                <SuggestedStrip />
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

/** Grey tiles in the Explore block pattern while the first page loads. */
function Skeleton() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const size = (width - 2) / 3;
  const cell = { width: size, height: size, backgroundColor: colors.skeleton };
  return (
    <View style={{ gap: 1 }}>
      {[0, 1].map((b) => (
        <View key={b} style={[styles.row, { gap: 1 }, b === 1 && { flexDirection: 'row-reverse' }]}>
          <View style={{ width: size * 2 + 1, gap: 1 }}>
            <View style={[styles.row, { gap: 1 }]}>
              <View style={cell} />
              <View style={cell} />
            </View>
            <View style={[styles.row, { gap: 1 }]}>
              <View style={cell} />
              <View style={cell} />
            </View>
          </View>
          <View style={[cell, { height: size * 2 + 1 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 36,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row' },
});
