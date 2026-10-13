import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useIsFocused, useScrollToTop } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Icon } from '@/components';
import { usePostCard } from '@/features/feed/api';
import { LoopingVideo } from '@/features/posts/components/LoopingVideo';
import { useTheme } from '@/theme';

import type { ExploreTile } from '../api';
import { TilePreview, type PreviewAction } from './TilePreview';

const GAP = 1;
const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

type Block =
  | { type: 'tall'; key: string; tall: ExploreTile; small: ExploreTile[]; side: 'left' | 'right' }
  | { type: 'row'; key: string; tiles: ExploreTile[] };

/**
 * Explore layout: blocks of 2 rows × 3 columns where one reel takes a tall tile (alternating
 * left / right) and four squares fill the rest; blocks without a reel are two plain rows.
 * Without `pattern` it's a plain 3-column square grid. An incomplete trailing block waits for
 * the next page unless `complete`.
 */
export function layoutBlocks(tiles: ExploreTile[], pattern: boolean, complete: boolean): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  let tall = 0;
  const pushRows = (list: ExploreTile[]) => {
    for (let r = 0; r < list.length; r += 3) {
      const row = list.slice(r, r + 3);
      blocks.push({ type: 'row', key: `r:${row[0].id}`, tiles: row });
    }
  };
  while (i < tiles.length) {
    const rest = tiles.length - i;
    if (!pattern) {
      if (rest < 3 && !complete) break;
      pushRows(tiles.slice(i, i + 3));
      i += 3;
      continue;
    }
    if (rest < 6 && !complete) break;
    const window = tiles.slice(i, i + 5);
    const reelAt = window.findIndex((t) => t.kind === 'reel');
    if (reelAt >= 0 && window.length === 5) {
      const small = window.filter((_, k) => k !== reelAt);
      blocks.push({
        type: 'tall',
        key: `t:${window[reelAt].id}`,
        tall: window[reelAt],
        small,
        side: tall % 2 === 0 ? 'right' : 'left',
      });
      tall += 1;
      i += 5;
    } else {
      pushRows(tiles.slice(i, i + 6));
      i += 6;
    }
  }
  return blocks;
}

export function ExploreGrid({
  tiles,
  pattern = true,
  complete,
  onPressTile,
  onEndReached,
  loadingMore = false,
  refreshing = false,
  onRefresh,
  header,
  empty,
}: {
  tiles: ExploreTile[];
  pattern?: boolean;
  /** No more pages: lay out the trailing tiles too. */
  complete: boolean;
  onPressTile: (tile: ExploreTile) => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactElement | null;
  empty?: ReactElement | null;
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const focused = useIsFocused();
  const size = (width - GAP * 2) / 3;
  const blocks = useMemo(() => layoutBlocks(tiles, pattern, complete), [tiles, pattern, complete]);
  const listRef = useRef<FlatList<Block>>(null);
  useScrollToTop(listRef);

  // Tall reel tiles autoplay (muted) while at least half visible.
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<Block>[] }) => {
    setVisible(new Set(viewableItems.map((v) => v.key)));
  }, []);

  // Long-press preview (drag onto an action and release to run it).
  const [preview, setPreview] = useState<ExploreTile | null>(null);
  const hover = useRef<PreviewAction | null>(null);
  const targets = useRef(new Map<PreviewAction, { x: number; y: number; w: number; h: number }>());
  const [hovered, setHovered] = useState<PreviewAction | null>(null);
  const runAction = useRef<((a: PreviewAction) => void) | null>(null);
  const onTarget = useCallback(
    (action: PreviewAction, rect: { x: number; y: number; w: number; h: number } | null) => {
      if (rect) targets.current.set(action, rect);
      else targets.current.delete(action);
    },
    [],
  );

  const hold = useCallback(
    (tile: ExploreTile) =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(350)
        .onStart(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          hover.current = null;
          setHovered(null);
          setPreview(tile);
        })
        .onUpdate((e) => {
          let hit: PreviewAction | null = null;
          for (const [action, r] of targets.current) {
            if (
              e.absoluteX >= r.x &&
              e.absoluteX <= r.x + r.w &&
              e.absoluteY >= r.y &&
              e.absoluteY <= r.y + r.h
            ) {
              hit = action;
            }
          }
          if (hit !== hover.current) {
            hover.current = hit;
            setHovered(hit);
            if (hit) void Haptics.selectionAsync().catch(() => {});
          }
        })
        .onEnd(() => {
          if (hover.current) runAction.current?.(hover.current);
        })
        .onFinalize(() => {
          hover.current = null;
          setHovered(null);
          setPreview(null);
        }),
    [],
  );

  const renderTile = (tile: ExploreTile, w: number, h: number, tall: boolean, active: boolean) => (
    <Tile
      key={tile.id}
      tile={tile}
      width={w}
      height={h}
      tall={tall}
      active={active && focused && !preview}
      gesture={Gesture.Exclusive(
        hold(tile),
        Gesture.Tap()
          .runOnJS(true)
          .onEnd((_e, ok) => {
            if (ok) onPressTile(tile);
          }),
      )}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={blocks}
        keyExtractor={(b) => b.key}
        ListHeaderComponent={header}
        ListEmptyComponent={tiles.length === 0 ? empty : null}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        onEndReached={onEndReached}
        onEndReachedThreshold={1.5}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ margin: 16 }} color={colors.textSecondary} />
          ) : null
        }
        renderItem={({ item }) =>
          item.type === 'row' ? (
            <View style={[styles.row, { gap: GAP, marginBottom: GAP }]}>
              {item.tiles.map((t) => renderTile(t, size, size, false, false))}
            </View>
          ) : (
            <View
              style={[
                styles.row,
                { gap: GAP, marginBottom: GAP },
                item.side === 'left' && { flexDirection: 'row-reverse' },
              ]}
            >
              <View style={{ width: size * 2 + GAP, gap: GAP }}>
                <View style={[styles.row, { gap: GAP }]}>
                  {item.small.slice(0, 2).map((t) => renderTile(t, size, size, false, false))}
                </View>
                <View style={[styles.row, { gap: GAP }]}>
                  {item.small.slice(2, 4).map((t) => renderTile(t, size, size, false, false))}
                </View>
              </View>
              {renderTile(item.tall, size, size * 2 + GAP, true, visible.has(item.key))}
            </View>
          )
        }
      />
      {preview ? (
        <TilePreview tile={preview} hovered={hovered} onTarget={onTarget} runRef={runAction} />
      ) : null}
    </View>
  );
}

function Tile({
  tile,
  width,
  height,
  tall,
  active,
  gesture,
}: {
  tile: ExploreTile;
  width: number;
  height: number;
  tall: boolean;
  active: boolean;
  gesture: ReturnType<typeof Gesture.Exclusive>;
}) {
  const { colors } = useTheme();
  const badge =
    tile.kind === 'reel'
      ? 'reels'
      : tile.media_count > 1
        ? 'carousel'
        : tile.cover_type === 'video'
          ? 'video'
          : null;
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={tile.kind === 'reel' ? 'Open reel' : 'Open post'}
        style={{ width, height, backgroundColor: colors.skeleton, overflow: 'hidden' }}
      >
        {tile.coverUrl ? (
          <Image
            source={{ uri: tile.coverUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={
              tall ? { left: '50%', top: `${Math.round(tile.cover_offset * 100)}%` } : 'center'
            }
            recyclingKey={tile.id}
          />
        ) : null}
        {tall && tile.kind === 'reel' && active ? <TallVideo postId={tile.id} /> : null}
        {badge ? (
          <View style={styles.badge} pointerEvents="none">
            <Icon name={badge} size={18} color={colors.onMedia} />
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/** Muted autoplay of a tall reel tile's first clip (fetched only once the tile is visible). */
function TallVideo({ postId }: { postId: string }) {
  const card = usePostCard(postId);
  const clip = card.data?.media.find((m) => m.type === 'video');
  if (!clip?.url) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LoopingVideo uri={clip.url} muted playing style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  badge: { position: 'absolute', top: 6, right: 6 },
});
