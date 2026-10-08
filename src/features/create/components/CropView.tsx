import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

import { cropOf } from '../media';
import type { ComposerItem, Crop } from '../types';

const MAX_ZOOM = 5;

/**
 * Page 34 — pinch to zoom and drag to reposition a photo inside the post frame. The image always
 * covers the frame; the result is reported as a crop (fractions of the source) when a gesture ends.
 * Grid lines show while adjusting, like Instagram.
 */
export function CropView({
  item,
  ratio,
  width,
  onChange,
}: {
  item: ComposerItem;
  ratio: number;
  width: number;
  onChange: (crop: Crop) => void;
}) {
  const { colors } = useTheme();
  const height = width / ratio;
  // Scale that makes the source cover the frame at zoom 1.
  const base = Math.max(width / item.width, height / item.height);

  const zoom = useSharedValue(1);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const start = useSharedValue({ zoom: 1, ox: 0, oy: 0 });
  const grid = useSharedValue(0);

  // Load the item's crop whenever the item, ratio or frame changes.
  useEffect(() => {
    const c = cropOf(item, ratio);
    const z = Math.max(1, width / (item.width * base * c.width));
    zoom.set(z);
    ox.set(-c.x * item.width * base * z);
    oy.set(-c.y * item.height * base * z);
  }, [item, ratio, width, base, zoom, ox, oy]);

  function report(z: number, x: number, y: number) {
    const dw = item.width * base * z;
    const dh = item.height * base * z;
    onChange({
      x: Math.max(0, -x / dw),
      y: Math.max(0, -y / dh),
      width: Math.min(1, width / dw),
      height: Math.min(1, height / dh),
    });
  }

  const clampX = (x: number, z: number) => {
    'worklet';
    return Math.min(0, Math.max(width - item.width * base * z, x));
  };
  const clampY = (y: number, z: number) => {
    'worklet';
    return Math.min(0, Math.max(height - item.height * base * z, y));
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.set({ zoom: zoom.get(), ox: ox.get(), oy: oy.get() });
      grid.set(withTiming(1, { duration: 120 }));
    })
    .onUpdate((e) => {
      const s = start.get();
      const z = Math.min(MAX_ZOOM, Math.max(1, s.zoom * e.scale));
      const k = z / s.zoom;
      zoom.set(z);
      ox.set(clampX(e.focalX - (e.focalX - s.ox) * k, z));
      oy.set(clampY(e.focalY - (e.focalY - s.oy) * k, z));
    })
    .onEnd(() => {
      grid.set(withTiming(0, { duration: 200 }));
      scheduleOnRN(report, zoom.get(), ox.get(), oy.get());
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      start.set({ zoom: zoom.get(), ox: ox.get(), oy: oy.get() });
      grid.set(withTiming(1, { duration: 120 }));
    })
    .onUpdate((e) => {
      const s = start.get();
      ox.set(clampX(s.ox + e.translationX, zoom.get()));
      oy.set(clampY(s.oy + e.translationY, zoom.get()));
    })
    .onEnd(() => {
      grid.set(withTiming(0, { duration: 200 }));
      scheduleOnRN(report, zoom.get(), ox.get(), oy.get());
    });

  const imageStyle = useAnimatedStyle(() => ({
    width: item.width * base * zoom.get(),
    height: item.height * base * zoom.get(),
    transform: [{ translateX: ox.get() }, { translateY: oy.get() }],
  }));
  const gridStyle = useAnimatedStyle(() => ({ opacity: grid.get() }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <View style={{ width, height, overflow: 'hidden' }} accessibilityLabel="Crop photo">
        <Animated.View style={[styles.image, imageStyle]}>
          <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, gridStyle]}>
          {[1, 2].map((i) => (
            <View
              key={`v${i}`}
              style={[styles.vLine, { left: (width * i) / 3, backgroundColor: colors.mediaGrid }]}
            />
          ))}
          {[1, 2].map((i) => (
            <View
              key={`h${i}`}
              style={[styles.hLine, { top: (height * i) / 3, backgroundColor: colors.mediaGrid }]}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  image: { position: 'absolute', left: 0, top: 0 },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
