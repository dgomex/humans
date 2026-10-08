import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components';
import { useTheme } from '@/theme';

export type StripItem = { key: string; uri: string; type: 'image' | 'video' };

const SIZE = 56;
const GAP = 6;
const STEP = SIZE + GAP;

/**
 * Carousel thumbnails (pages 35 and 41): tap to select, long-press and drag to reorder (haptic on
 * pick-up), ✕ on the selected thumbnail removes it, optional + tile to add more.
 */
export function SortableStrip({
  items,
  selectedKey,
  onSelect,
  onMove,
  onRemove,
  onAdd,
}: {
  items: StripItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove?: (key: string) => void;
  onAdd?: () => void;
}) {
  const { spacing } = useTheme();
  const count = items.length + (onAdd ? 1 : 0);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
    >
      <View style={{ width: count * STEP - GAP, height: SIZE }}>
        {items.map((item, index) => (
          <Thumb
            key={item.key}
            item={item}
            index={index}
            count={items.length}
            selected={item.key === selectedKey}
            onSelect={onSelect}
            onMove={onMove}
            onRemove={items.length > 1 ? onRemove : undefined}
          />
        ))}
        {onAdd ? <AddTile left={items.length * STEP} onPress={onAdd} /> : null}
      </View>
    </ScrollView>
  );
}

function Thumb({
  item,
  index,
  count,
  selected,
  onSelect,
  onMove,
  onRemove,
}: {
  item: StripItem;
  index: number;
  count: number;
  selected: boolean;
  onSelect: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove?: (key: string) => void;
}) {
  const { colors, radius } = useTheme();
  const x = useSharedValue(index * STEP);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (!dragging.get()) x.set(withTiming(index * STEP, { duration: 180 }));
  }, [index, x, dragging]);

  const lift = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      dragging.set(true);
      scheduleOnRN(lift);
    })
    .onUpdate((e) => {
      x.set(Math.min((count - 1) * STEP, Math.max(0, index * STEP + e.translationX)));
    })
    .onEnd(() => {
      const to = Math.round(x.get() / STEP);
      dragging.set(false);
      x.set(withSpring(to * STEP, { damping: 18, stiffness: 220 }));
      if (to !== index) scheduleOnRN(onMove, index, to);
    })
    .onFinalize(() => {
      dragging.set(false);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { scale: dragging.get() ? 1.1 : 1 }],
    zIndex: dragging.get() ? 10 : 1,
    opacity: dragging.get() ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.thumb, style]}>
        <Pressable
          onPress={() => onSelect(item.key)}
          accessibilityRole="button"
          accessibilityLabel={`Slide ${index + 1}`}
          accessibilityHint="Long press and drag to reorder"
          accessibilityState={{ selected }}
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: radius.sm,
            overflow: 'hidden',
            borderWidth: selected ? 2 : 0,
            borderColor: colors.text,
            backgroundColor: colors.skeleton,
          }}
        >
          <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {item.type === 'video' ? (
            <View style={styles.videoBadge}>
              <Icon name="video" size={12} color={colors.onMedia} />
            </View>
          ) : null}
        </Pressable>
        {selected && onRemove ? (
          <Pressable
            onPress={() => onRemove(item.key)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove slide ${index + 1}`}
            style={[styles.remove, { backgroundColor: colors.mediaScrim }]}
          >
            <Icon name="close" size={12} color={colors.onMedia} />
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function AddTile({ left, onPress }: { left: number; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add photos or videos"
      style={[
        styles.thumb,
        {
          left,
          width: SIZE,
          height: SIZE,
          borderRadius: radius.sm,
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Icon name="add" size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: { position: 'absolute', top: 0, left: 0 },
  videoBadge: { position: 'absolute', right: 3, bottom: 3 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
