import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Icon, Text, UserRow, useToast } from '@/components';
import { CroppedImage } from '@/features/create/components/CroppedImage';
import type { ComposerTag, Crop } from '@/features/create/types';
import { useTheme } from '@/theme';

import { PersonSearchSheet } from './PersonSearchSheet';

export type TagSlide = {
  key: string;
  uri: string;
  type: 'image' | 'video';
  /** null = the image already has the post's shape (published media). */
  crop: Crop | null;
};

export const MAX_TAGS = 20;
const FULL: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** Tap point inside the pressed view. Web reports page coordinates only, so measure the frame. */
function pressPoint(e: GestureResponderEvent) {
  const n = e.nativeEvent;
  if (Platform.OS === 'web') {
    const frame = e.currentTarget as unknown as { getBoundingClientRect?: () => DOMRect };
    const rect = frame.getBoundingClientRect?.();
    if (rect)
      return { x: n.pageX - rect.left - window.scrollX, y: n.pageY - rect.top - window.scrollY };
  }
  return { x: n.locationX, y: n.locationY };
}

/**
 * Page 37 — tap a photo to tag someone there; drag a bubble to move it, ✕ to remove. Tags are per
 * slide; video slides get a list instead of positions. Up to 20 people per post.
 */
export function TagEditor({
  slides,
  ratio,
  tags,
  onChange,
}: {
  slides: TagSlide[];
  ratio: number;
  tags: Record<string, ComposerTag[]>;
  onChange: (slideKey: string, next: ComposerTag[]) => void;
}) {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const height = width / ratio;
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<{
    slide: string;
    x: number | null;
    y: number | null;
  } | null>(null);

  const people = new Set(Object.values(tags).flatMap((t) => t.map((x) => x.userId)));
  const slide = slides[page];
  const slideTags = slide ? (tags[slide.key] ?? []) : [];

  function startTag(slideKey: string, x: number | null, y: number | null) {
    if (people.size >= MAX_TAGS) {
      toast.show(`You can tag up to ${MAX_TAGS} people.`);
      return;
    }
    setPending({ slide: slideKey, x, y });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flexGrow: 0 }}
      >
        {slides.map((s) => (
          <View key={s.key} style={{ width, height, backgroundColor: colors.mediaBackground }}>
            {s.type === 'image' ? (
              <>
                <Pressable
                  onPress={(e) => {
                    const { x, y } = pressPoint(e);
                    startTag(
                      s.key,
                      Math.min(1, Math.max(0, x / width)),
                      Math.min(1, Math.max(0, y / height)),
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Tap to tag someone"
                >
                  <CroppedImage uri={s.uri} crop={s.crop ?? FULL} width={width} height={height} />
                </Pressable>
                {(tags[s.key] ?? []).map((t) => (
                  <TagBubble
                    key={t.userId}
                    tag={t}
                    frame={{ width, height }}
                    onMove={(x, y) =>
                      onChange(
                        s.key,
                        (tags[s.key] ?? []).map((o) =>
                          o.userId === t.userId ? { ...o, x, y } : o,
                        ),
                      )
                    }
                    onRemove={() =>
                      onChange(
                        s.key,
                        (tags[s.key] ?? []).filter((o) => o.userId !== t.userId),
                      )
                    }
                  />
                ))}
              </>
            ) : (
              <Image source={{ uri: s.uri }} style={{ width, height }} contentFit="cover" />
            )}
          </View>
        ))}
      </ScrollView>

      {slides.length > 1 ? (
        <Text variant="caption" color="textSecondary" style={styles.center}>
          {page + 1} / {slides.length}
        </Text>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {slide?.type === 'video' ? (
          <>
            <Text variant="bodyBold">Tagged people</Text>
            {slideTags.map((t) => (
              <UserRow
                key={t.userId}
                username={t.username}
                trailing={
                  <Pressable
                    onPress={() =>
                      onChange(
                        slide.key,
                        slideTags.filter((o) => o.userId !== t.userId),
                      )
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${t.username}`}
                  >
                    <Icon name="close" size={20} />
                  </Pressable>
                }
              />
            ))}
            <Button
              title="Add tag"
              variant="secondary"
              onPress={() => startTag(slide.key, null, null)}
            />
          </>
        ) : (
          <Text color="textSecondary" style={styles.center}>
            {slideTags.length === 0
              ? 'Tap photo to tag people.'
              : 'Drag to move, or tap ✕ to remove a tag.'}
          </Text>
        )}
      </ScrollView>

      <PersonSearchSheet
        visible={!!pending}
        onClose={() => setPending(null)}
        exclude={pending ? (tags[pending.slide] ?? []).map((t) => t.userId) : []}
        onPick={(p) => {
          if (!pending) return;
          onChange(pending.slide, [
            ...(tags[pending.slide] ?? []),
            { userId: p.id, username: p.username, x: pending.x, y: pending.y },
          ]);
          setPending(null);
        }}
      />
    </View>
  );
}

function TagBubble({
  tag,
  frame,
  onMove,
  onRemove,
}: {
  tag: ComposerTag;
  frame: { width: number; height: number };
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  // Measured so the bubble is centered under the tag point.
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const left = (tag.x ?? 0.5) * frame.width;
  const top = (tag.y ?? 0.5) * frame.height;

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      dx.set(e.translationX);
      dy.set(e.translationY);
    })
    .onEnd((e) => {
      const x = Math.min(1, Math.max(0, (left + e.translationX) / frame.width));
      const y = Math.min(1, Math.max(0, (top + e.translationY) / frame.height));
      dx.set(0);
      dy.set(0);
      scheduleOnRN(onMove, x, y);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        onLayout={(e) => setBubbleWidth(e.nativeEvent.layout.width)}
        style={[styles.bubbleWrap, { left: left - bubbleWidth / 2, top }, style]}
      >
        <View style={[styles.arrow, { borderBottomColor: colors.mediaScrim }]} />
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.mediaScrim,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              gap: spacing.xs,
            },
          ]}
        >
          <Text variant="captionBold" style={{ color: colors.onMedia }}>
            {tag.username}
          </Text>
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${tag.username}`}
          >
            <Icon name="close" size={14} color={colors.onMedia} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', marginTop: 8 },
  bubbleWrap: { position: 'absolute', alignItems: 'center' },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
});
