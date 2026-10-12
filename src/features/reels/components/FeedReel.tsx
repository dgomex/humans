import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components';
import type { FeedPost } from '@/features/feed/api';
import { setFeedMuted, useFeedMuted } from '@/features/feed/format';
import { useTheme } from '@/theme';

import { useReelSource } from '../api';
import { ReelPlayer } from './ReelPlayer';

/**
 * A reel inside a feed card (Home, post scroller): 4:5 window of the 9:16 reel playing muted with
 * the shared feed mute. Tap opens the Reels viewer (page 58), double-tap likes.
 */
export function FeedReel({
  post,
  active,
  onDoubleTap,
}: {
  post: FeedPost;
  active: boolean;
  onDoubleTap: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const height = width * 1.25;
  const muted = useFeedMuted();
  const source = useReelSource(post);
  const heart = useSharedValue(0);

  const open = () => router.push({ pathname: '/reel/[id]', params: { id: post.id } });
  const like = () => {
    heart.set(
      withSequence(
        withSpring(1, { damping: 8, stiffness: 220 }),
        withDelay(450, withTiming(0, { duration: 200 })),
      ),
    );
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDoubleTap();
  };
  const single = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(open);
  });
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(like);
    });
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.get() > 0.01 ? 1 : 0,
    transform: [{ scale: 0.4 + heart.get() * 0.6 }],
  }));

  return (
    <View style={{ width, height, backgroundColor: colors.mediaBackground }}>
      <GestureDetector gesture={Gesture.Exclusive(double, single)}>
        <View
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Open reel"
        >
          {source ? (
            <ReelPlayer
              source={source}
              width={width}
              height={height}
              active={active}
              muted={muted}
            />
          ) : null}
        </View>
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[styles.heart, { top: height / 2 - 48 }, heartStyle]}
      >
        <Icon name="heartFilled" size={96} color={colors.onMedia} />
      </Animated.View>
      <View pointerEvents="none" style={[styles.badge, { backgroundColor: colors.mediaScrim }]}>
        <Icon name="reels" size={14} color={colors.onMedia} />
      </View>
      <Pressable
        onPress={() => setFeedMuted(!muted)}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
        style={[styles.corner, { backgroundColor: colors.mediaScrim }]}
      >
        <Icon name={muted ? 'volumeOff' : 'volumeOn'} size={16} color={colors.onMedia} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  heart: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
