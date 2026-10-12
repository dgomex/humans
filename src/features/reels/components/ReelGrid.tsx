import { router } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon, Text } from '@/components';
import { formatCount } from '@/features/profile/format';
import { useTheme } from '@/theme';

import type { ReelScrollerSource, ReelTile } from '../api';
import { CoverImage } from './ReelPlayer';

/**
 * 3-column grid of reel covers with ▷ play counts (profile Reels tab, audio page, remixes).
 * Tiles are 9:16 on audio / remix pages and 3:4 (with the cover's grid window) on profiles.
 * Tapping opens the reel scroller of the same list.
 */
export function ReelGrid({
  tiles,
  source,
  owner,
  shape = 'tall',
  gap = 2,
  width: forcedWidth,
}: {
  tiles: ReelTile[];
  source: ReelScrollerSource;
  owner: string;
  shape?: 'tall' | 'grid';
  gap?: number;
  width?: number;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = forcedWidth ?? windowWidth;
  const tile = (width - gap * 2) / 3;
  const h = shape === 'tall' ? (tile * 16) / 9 : (tile * 4) / 3;
  return (
    <View style={[styles.grid, { gap }]}>
      {tiles.map((t) => (
        <ReelTileView
          key={t.id}
          tile={t}
          width={tile}
          height={h}
          offset={shape === 'grid' ? t.cover_offset : 0.5}
          onPress={() =>
            router.push({ pathname: '/reel/[id]', params: { id: t.id, source, owner } })
          }
        />
      ))}
    </View>
  );
}

export function ReelTileView({
  tile,
  width,
  height,
  offset,
  onPress,
}: {
  tile: ReelTile;
  width: number;
  height: number;
  offset: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open reel">
      <CoverImage uri={tile.coverUrl} offset={offset} style={{ width, height }}>
        {tile.is_origin ? (
          <View style={[styles.badge, { backgroundColor: colors.mediaScrim }]}>
            <Text variant="captionBold" style={{ color: colors.onMedia }}>
              Original
            </Text>
          </View>
        ) : null}
        {tile.play_count !== null ? (
          <View style={styles.plays}>
            <Icon name="playCount" size={14} color={colors.onMedia} />
            <Text variant="captionBold" style={{ color: colors.onMedia }}>
              {formatCount(tile.play_count)}
            </Text>
          </View>
        ) : null}
      </CoverImage>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plays: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
