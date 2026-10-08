import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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

import { BottomSheet, Icon, Text, UserRow } from '@/components';
import { LoopingVideo } from '@/features/posts/components/LoopingVideo';
import { openProfile } from '@/features/profile/format';
import { useTheme } from '@/theme';

import type { CardMedia, CardTag } from '../api';
import { setFeedMuted, useFeedMuted } from '../format';
import { useZoom } from './ZoomOverlay';

const MAX_ZOOM = 4;
const COUNTER_IDLE_MS = 3000;

/**
 * Page 45 — post media: swipeable carousel (1/N counter that fades when idle, dots), pinch to
 * zoom (lifts into the root ZoomOverlay), double-tap to like with a heart pop, single tap shows
 * tags on photos / toggles sound on videos. Videos play only while `active`.
 */
export function PostMedia({
  media,
  tags,
  ratio,
  active = true,
  onDoubleTap,
}: {
  media: CardMedia[];
  tags: CardTag[];
  ratio: number;
  /** The card is the focused one in its list (plays video). */
  active?: boolean;
  onDoubleTap?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const height = width / ratio;
  const [page, setPage] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [videoTags, setVideoTags] = useState(false);
  const muted = useFeedMuted();

  const counter = useSharedValue(1);
  const heart = useSharedValue(0);

  // 1/N fades after a few idle seconds; reappears on every swipe.
  useEffect(() => {
    if (media.length < 2) return;
    counter.set(1);
    counter.set(withDelay(COUNTER_IDLE_MS, withTiming(0, { duration: 300 })));
  }, [page, media.length, counter]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
    setShowTags(false);
  }

  const current = media[page];
  const slideTags = tags.filter((t) => t.media_id === current?.id);

  function onSingleTap() {
    if (!current) return;
    if (current.type === 'video') setFeedMuted(!muted);
    else setShowTags((v) => !v);
  }

  function onDouble() {
    heart.set(
      withSequence(
        withSpring(1, { damping: 8, stiffness: 220 }),
        withDelay(450, withTiming(0, { duration: 200 })),
      ),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDoubleTap?.();
  }

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.get() > 0.01 ? 1 : 0,
    transform: [{ scale: 0.4 + heart.get() * 0.6 }],
  }));
  const counterStyle = useAnimatedStyle(() => ({ opacity: counter.get() }));

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={() => counter.set(withTiming(1, { duration: 120 }))}
        scrollEnabled={media.length > 1}
        style={{ height }}
      >
        {media.map((m, i) => (
          <Slide
            key={m.id}
            media={m}
            index={i}
            total={media.length}
            width={width}
            height={height}
            playing={active && i === page}
            muted={muted}
            onSingleTap={onSingleTap}
            onDoubleTap={onDouble}
          />
        ))}
      </ScrollView>

      {showTags
        ? slideTags
            .filter((t) => t.x !== null && t.y !== null)
            .map((t) => (
              <Pressable
                key={t.id}
                onPress={() => openProfile(t.user.username)}
                accessibilityRole="button"
                accessibilityLabel={`Tagged: ${t.user.username}`}
                style={[
                  styles.tag,
                  {
                    left: Math.min(Math.max((t.x ?? 0) * width - 50, 4), width - 104),
                    top: Math.min((t.y ?? 0) * height, height - 34),
                    backgroundColor: colors.mediaScrim,
                  },
                ]}
              >
                <Text variant="captionBold" numberOfLines={1} style={{ color: colors.onMedia }}>
                  {t.user.username}
                </Text>
              </Pressable>
            ))
        : null}

      <Animated.View style={[styles.heart, { top: height / 2 - 48 }, heartStyle]}>
        <Icon name="heartFilled" size={96} color={colors.onMedia} />
      </Animated.View>

      {slideTags.length > 0 ? (
        <Pressable
          onPress={() => (current?.type === 'video' ? setVideoTags(true) : setShowTags((v) => !v))}
          accessibilityRole="button"
          accessibilityLabel="Tagged people"
          style={[
            styles.corner,
            styles.left,
            { top: height - 40, backgroundColor: colors.mediaScrim },
          ]}
        >
          <Icon name="tagPersonFilled" size={16} color={colors.onMedia} />
        </Pressable>
      ) : null}
      {current?.type === 'video' ? (
        <Pressable
          onPress={() => setFeedMuted(!muted)}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
          style={[
            styles.corner,
            styles.right,
            { top: height - 40, backgroundColor: colors.mediaScrim },
          ]}
        >
          <Icon name={muted ? 'volumeOff' : 'volumeOn'} size={16} color={colors.onMedia} />
        </Pressable>
      ) : null}

      {media.length > 1 ? (
        <>
          <Animated.View
            style={[styles.counter, { backgroundColor: colors.mediaScrim }, counterStyle]}
          >
            <Text variant="captionBold" style={{ color: colors.onMedia }}>
              {page + 1}/{media.length}
            </Text>
          </Animated.View>
          <Dots count={media.length} page={page} paddingTop={spacing.sm} />
        </>
      ) : null}

      <BottomSheet visible={videoTags} onClose={() => setVideoTags(false)} title="In this video">
        {slideTags.map((t) => (
          <UserRow
            key={t.id}
            username={t.user.username}
            onPress={() => {
              setVideoTags(false);
              openProfile(t.user.username);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

/** Instagram shows at most ~5 dots; the ones at the edges shrink as the window slides. */
function Dots({ count, page, paddingTop }: { count: number; page: number; paddingTop: number }) {
  const { colors } = useTheme();
  const WINDOW = 5;
  const start = Math.min(Math.max(page - 2, 0), Math.max(count - WINDOW, 0));
  const visible = Array.from({ length: Math.min(count, WINDOW) }, (_, k) => start + k);
  return (
    <View style={[styles.dots, { paddingTop }]}>
      {visible.map((i) => {
        const edge =
          (i === start && start > 0) || (i === start + WINDOW - 1 && start + WINDOW < count);
        const size = edge ? 4 : 6;
        return (
          <View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: i === page ? colors.primary : colors.textTertiary,
            }}
          />
        );
      })}
    </View>
  );
}

function Slide({
  media: m,
  index,
  total,
  width,
  height,
  playing,
  muted,
  onSingleTap,
  onDoubleTap,
}: {
  media: CardMedia;
  index: number;
  total: number;
  width: number;
  height: number;
  playing: boolean;
  muted: boolean;
  onSingleTap: () => void;
  onDoubleTap: () => void;
}) {
  const { colors } = useTheme();
  const zoom = useZoom();
  // Callback ref in state: the pinch handler measures it (refs can't be read from gestures).
  const [node, setNode] = useState<View | null>(null);
  const [zooming, setZooming] = useState(false);
  const [failed, setFailed] = useState(false);
  const still = m.type === 'video' ? m.thumbUrl : m.url;
  const focalStartX = useSharedValue(0);
  const focalStartY = useSharedValue(0);

  // Lift the slide into the root zoom layer at its on-screen position.
  const startZoom = () => {
    if (!still) return;
    node?.measureInWindow((x, y, w, h) => {
      // Some renderers report 0×0 mid-gesture: the slide's size is known anyway.
      const rect = { x, y, width: w || width, height: h || height };
      zoom.rect.set(rect);
      setZooming(true);
      zoom.setTarget({ uri: still, ...rect });
    });
  };
  const endZoom = () => {
    setZooming(false);
    zoom.setTarget(null);
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      zoom.translateX.set(0);
      zoom.translateY.set(0);
      zoom.scale.set(1);
      // Remember the focal point so a two-finger drag moves the image.
      focalStartX.set(e.focalX);
      focalStartY.set(e.focalY);
      scheduleOnRN(startZoom);
    })
    .onUpdate((e) => {
      zoom.scale.set(Math.min(Math.max(e.scale, 1), MAX_ZOOM));
      zoom.translateX.set(e.focalX - focalStartX.get());
      zoom.translateY.set(e.focalY - focalStartY.get());
    })
    .onFinalize(() => {
      zoom.translateX.set(withSpring(0, { damping: 18 }));
      zoom.translateY.set(withSpring(0, { damping: 18 }));
      zoom.scale.set(
        withSpring(1, { damping: 18 }, (done) => {
          if (done) scheduleOnRN(endZoom);
        }),
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(onDoubleTap);
    });
  const singleTap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(onSingleTap);
  });
  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, singleTap));

  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={setNode}
        collapsable={false}
        accessible
        accessibilityLabel={m.alt_text ?? `Photo ${index + 1} of ${total}`}
        style={{ width, height, backgroundColor: colors.mediaBackground, opacity: zooming ? 0 : 1 }}
      >
        {m.type === 'video' && m.url ? (
          <LoopingVideo uri={m.url} muted={muted} playing={playing} style={{ width, height }} />
        ) : m.url && !failed ? (
          <Image
            source={{ uri: m.url }}
            style={{ width, height }}
            contentFit="cover"
            transition={150}
            recyclingKey={m.id}
            onError={() => setFailed(true)}
          />
        ) : (
          <Pressable
            onPress={() => setFailed(false)}
            style={[styles.failed, { width, height, backgroundColor: colors.skeleton }]}
            accessibilityRole="button"
            accessibilityLabel="Couldn't load. Tap to retry."
          >
            <Icon name="image" size={36} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              Couldn&apos;t load
            </Text>
          </Pressable>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    width: 100,
    alignItems: 'center',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  heart: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: { left: 12 },
  right: { right: 12 },
  counter: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    pointerEvents: 'none',
  },
  failed: { alignItems: 'center', justifyContent: 'center', gap: 6 },
});
