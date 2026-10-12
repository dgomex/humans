import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { usePostCard } from '@/features/feed/api';
import { useReelScroller, useReelsFeed, type ReelScrollerSource } from '@/features/reels/api';
import { ReelPager, type PagerItem } from '@/features/reels/components/ReelPager';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * Page 58 — a reel opened from a profile's Reels tab, an audio page, remixes (scroller of that
 * list, starting at the tapped reel) or a link (that reel, then suggested reels).
 * Params: `id`, optional `source` (profile | audio | remixes) + `owner` (user / track / reel id).
 */
export default function ReelScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; source?: string; owner?: string }>();
  const source = (['profile', 'audio', 'remixes'] as const).includes(
    params.source as ReelScrollerSource,
  )
    ? (params.source as ReelScrollerSource)
    : undefined;
  const card = usePostCard(params.id);
  const scroller = useReelScroller(source, params.owner);
  const feed = useReelsFeed();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const { items, initialIndex } = useMemo(() => {
    if (source) {
      const ids = scroller.data?.pages.flatMap((p) => p.ids) ?? [];
      const at = ids.indexOf(params.id);
      // The tapped reel may be past the first page (or hidden from the list): show it first.
      const list = at >= 0 ? ids : [params.id, ...ids];
      return {
        items: list.map((id) => ({ key: id, postId: id })) as PagerItem[],
        initialIndex: Math.max(0, at),
      };
    }
    const rest = (feed.data?.pages.flatMap((p) => p.entries) ?? []).filter(
      (e) => e.postId !== params.id,
    );
    return {
      items: [
        { key: params.id, postId: params.id },
        ...rest.map((e) => ({ key: e.key, postId: e.postId })),
      ],
      initialIndex: 0,
    };
  }, [source, scroller.data, feed.data, params.id]);

  const ready = source ? scroller.isSuccess : true;
  const gone = card.isSuccess && card.data === null;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.mediaBackground }}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {gone ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { gap: spacing.sm }]}>
          <Icon name="reels" size={48} color={colors.onMedia} />
          <Text variant="headline" style={{ color: colors.onMedia }}>
            This reel isn&apos;t available
          </Text>
          <Text style={{ color: colors.onMedia, opacity: 0.8, textAlign: 'center' }}>
            It may have been deleted, or the account may be private.
          </Text>
        </View>
      ) : size && ready ? (
        <ReelPager
          // Remount when the start reel changes so initialScrollIndex applies.
          key={`${params.id}:${initialIndex}`}
          items={items}
          width={size.width}
          height={size.height}
          bottomInset={insets.bottom}
          initialIndex={initialIndex}
          onEndReached={() => {
            const q = source ? scroller : feed;
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          loadingMore={source ? scroller.isFetchingNextPage : feed.isFetchingNextPage}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color={colors.onMedia} />
        </View>
      )}
      <Pressable
        onPress={() => goBack('/reels')}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.back, { top: insets.top + spacing.xs, left: spacing.md }]}
      >
        <Icon name="back" size={28} color={colors.onMedia} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  back: { position: 'absolute' },
});
