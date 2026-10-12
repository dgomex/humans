import { router, useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { useReelsFeed } from '@/features/reels/api';
import { ReelPager, type PagerItem } from '@/features/reels/components/ReelPager';
import { useTheme } from '@/theme';

/**
 * Page 58 — Reels tab: full-screen vertical feed of ranked reels (people you follow + recommended
 * public reels; seen ones sink), sound on, with "Reels" and the 📷 camera (page 59) on top.
 * Tapping the tab again scrolls back to the first reel.
 */
export default function ReelsScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const feed = useReelsFeed();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const listRef = useRef<FlatList<PagerItem>>(null);
  useScrollToTop(listRef);

  const items: PagerItem[] =
    feed.data?.pages.flatMap((p) => p.entries.map((e) => ({ key: e.key, postId: e.postId }))) ?? [];

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.mediaBackground }}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {size && feed.isSuccess ? (
        <ReelPager
          listRef={listRef}
          items={items}
          width={size.width}
          height={size.height}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          loadingMore={feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          ListEmptyComponent={
            <View style={[styles.center, { height: size.height, gap: spacing.md }]}>
              <Icon name="reels" size={56} color={colors.onMedia} />
              <Text variant="headline" style={{ color: colors.onMedia }}>
                No reels yet
              </Text>
              <Text style={{ color: colors.onMedia, opacity: 0.8, textAlign: 'center' }}>
                Reels from people you follow and suggested reels will show up here.
              </Text>
              <Button
                title="Create your first reel"
                onPress={() => router.push('/compose/reel/camera')}
              />
            </View>
          }
        />
      ) : feed.isError ? (
        <Pressable
          onPress={() => void feed.refetch()}
          style={[StyleSheet.absoluteFill, styles.center, { gap: spacing.sm }]}
          accessibilityRole="button"
        >
          <Icon name="alert" size={36} color={colors.onMedia} />
          <Text style={{ color: colors.onMedia }}>Couldn&apos;t load reels. Tap to retry.</Text>
        </Pressable>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color={colors.onMedia} />
        </View>
      )}

      {/* Header over the reels */}
      <View
        pointerEvents="box-none"
        style={[styles.header, { top: insets.top + spacing.xs, paddingHorizontal: spacing.lg }]}
      >
        <Text variant="title" style={{ color: colors.onMedia }}>
          Reels
        </Text>
        <Pressable
          onPress={() => router.push('/compose/reel/camera')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Create a reel"
        >
          <Icon name="camera" size={28} color={colors.onMedia} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
