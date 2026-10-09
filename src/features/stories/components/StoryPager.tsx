import { useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

import type { StoryCard } from '../api';
import { ViewersSheet } from './ViewersSheet';

export type PageControls = {
  active: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onNextReel: () => void;
  onPrevReel: () => void;
  onClose: () => void;
  onSwipeEnd: (dx: number, vx: number) => void;
  onOpenViewers: (story: StoryCard, reel: StoryCard[]) => void;
  externalPause: boolean;
};

/**
 * Horizontal pager of reels with Instagram's cube transition (each reel turns around its edge)
 * and swipe-down-to-close. Neighbours stay mounted (paused) so the next reel shows instantly.
 */
export function StoryPager({
  keys,
  initialKey,
  renderPage,
  onClose,
}: {
  keys: string[];
  initialKey: string;
  renderPage: (key: string, controls: PageControls) => ReactNode;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(() => Math.max(0, keys.indexOf(initialKey)));
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // The page on screen, on the UI thread. Faces are placed from it (not from React's `index`),
  // so ending a transition swaps page and offset in the same frame — React catches up after,
  // without the old page flashing back for a frame.
  const current = useSharedValue(index);
  const [viewers, setViewers] = useState<{
    story: StoryCard;
    reel: StoryCard[];
    openedAt: number;
  } | null>(null);

  const go = (dir: 1 | -1) => {
    const to = index + dir;
    if (to < 0) {
      dragX.set(withTiming(0, { duration: 180 }));
      return;
    }
    if (to >= keys.length) {
      onClose();
      return;
    }
    dragX.set(
      withTiming(-dir * width, { duration: 260 }, (done) => {
        if (!done) return;
        current.set(to);
        dragX.set(0);
        scheduleOnRN(setIndex, to);
      }),
    );
  };

  const onSwipeEnd = (dx: number, vx: number) => {
    if (dx < -width / 3 || vx < -600) go(1);
    else if (dx > width / 3 || vx > 600) go(-1);
    else dragX.set(withTiming(0, { duration: 180 }));
  };

  const closeStyle = useAnimatedStyle(() => {
    const y = dragY.get();
    return {
      transform: [{ translateY: y }, { scale: interpolate(y, [0, height], [1, 0.8], 'clamp') }],
      borderRadius: y > 0 ? 16 : 0,
    };
  });

  const visible = [index - 1, index, index + 1].filter((i) => i >= 0 && i < keys.length);

  return (
    <View style={[styles.fill, { backgroundColor: colors.mediaBackground }]}>
      <Animated.View style={[styles.fill, { overflow: 'hidden' }, closeStyle]}>
        {visible.map((i) => (
          <CubeFace
            key={keys[i]}
            index={i}
            current={current}
            focused={i === index}
            dragX={dragX}
            width={width}
          >
            {renderPage(keys[i], {
              active: i === index,
              dragX,
              dragY,
              onNextReel: () => go(1),
              onPrevReel: () => go(-1),
              onClose,
              onSwipeEnd,
              onOpenViewers: (story, reel) => setViewers({ story, reel, openedAt: Date.now() }),
              externalPause: viewers !== null,
            })}
          </CubeFace>
        ))}
      </Animated.View>
      <ViewersSheet
        visible={viewers !== null}
        initialStory={viewers?.story ?? null}
        reel={viewers?.reel ?? []}
        openedAt={viewers?.openedAt ?? 0}
        onClose={() => setViewers(null)}
      />
    </View>
  );
}

function CubeFace({
  index,
  current,
  focused,
  dragX,
  width,
  children,
}: {
  index: number;
  current: SharedValue<number>;
  focused: boolean;
  dragX: SharedValue<number>;
  width: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const p = (index - current.get()) * width + dragX.get();
    const angle = interpolate(p, [-width, 0, width], [-90, 0, 90], 'clamp');
    return {
      transformOrigin: p >= 0 ? 'left' : 'right',
      transform: [{ perspective: width * 2 }, { translateX: p }, { rotateY: `${angle}deg` }],
      // Faces beyond 90° are hidden (backface).
      opacity: Math.abs(p) >= width ? 0 : 1,
    };
  });
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={focused ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
