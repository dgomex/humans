import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, AppState, FlatList, View, type ViewToken } from 'react-native';

import { useTheme } from '@/theme';

import { ReelView } from './ReelView';

export type PagerItem = { key: string; postId: string };

/**
 * Vertical, snapping pager of full-screen reels (page 58). Only the focused reel plays; its
 * neighbours mount paused so a swipe shows the next frame immediately, the rest render covers.
 * Pauses when the screen loses focus or the app goes to the background — except while a route
 * opened from the reel (comments, likes) is on top, where Instagram keeps playing.
 */
export function ReelPager({
  items,
  width,
  height,
  bottomInset = 0,
  initialIndex = 0,
  onEndReached,
  loadingMore = false,
  ListEmptyComponent,
  onRefresh,
  refreshing = false,
  listRef,
}: {
  items: PagerItem[];
  width: number;
  height: number;
  bottomInset?: number;
  initialIndex?: number;
  onEndReached?: () => void;
  loadingMore?: boolean;
  ListEmptyComponent?: ReactElement | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  listRef?: React.RefObject<FlatList<PagerItem> | null>;
}) {
  const { colors } = useTheme();
  const [current, setCurrent] = useState(initialIndex);
  const focused = useIsFocused();
  const [overlay, setOverlay] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  // Back from comments / likes: normal focus rules again.
  useFocusEffect(
    useCallback(() => {
      setOverlay(false);
    }, []),
  );

  const playing = (focused || overlay) && appActive;

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index !== null && first?.index !== undefined) setCurrent(first.index);
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(i) => i.key}
      renderItem={({ item, index }) => (
        <ReelView
          postId={item.postId}
          width={width}
          height={height}
          active={playing && index === current}
          mounted={Math.abs(index - current) <= 1}
          bottomInset={bottomInset}
          onOverlayRoute={() => setOverlay(true)}
        />
      )}
      pagingEnabled
      snapToInterval={height}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      showsVerticalScrollIndicator={false}
      initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
      getItemLayout={(_d, index) => ({ length: height, offset: height * index, index })}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      windowSize={3}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      removeClippedSubviews
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={
        loadingMore ? (
          <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.onMedia} />
          </View>
        ) : null
      }
      style={{ backgroundColor: colors.mediaBackground }}
    />
  );
}
