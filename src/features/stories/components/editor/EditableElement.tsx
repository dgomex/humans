import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CANVAS_W, type Transform } from '../../types';

/**
 * Page 54 — one movable item: drag, pinch to scale, two-finger rotate, tap to edit. While it
 * moves, `onDrag` reports whether the finger is over the bin (bottom of the screen); releasing
 * there deletes it.
 */
export function EditableElement({
  el,
  k,
  binTop,
  onChange,
  onTap,
  onDrag,
  onDelete,
  children,
}: {
  el: Transform & { id: string };
  k: number;
  /** Window Y where the bin zone starts. */
  binTop: number;
  onChange: (t: Transform) => void;
  onTap?: () => void;
  onDrag: (state: { active: boolean; overBin: boolean }) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const scale = useSharedValue(el.scale);
  const rotation = useSharedValue(el.rotation);
  const scaleStart = useSharedValue(el.scale);
  const rotStart = useSharedValue(el.rotation);
  const overBin = useSharedValue(false);

  // A committed change (or undo) resets the live values.
  useEffect(() => {
    dx.set(0);
    dy.set(0);
    scale.set(el.scale);
    rotation.set(el.rotation);
  }, [el.x, el.y, el.scale, el.rotation, dx, dy, scale, rotation]);

  const commit = (tx: number, ty: number, s: number, r: number, deleteIt: boolean) => {
    onDrag({ active: false, overBin: false });
    if (deleteIt) {
      onDelete();
      return;
    }
    onChange({ x: el.x + tx / k, y: el.y + ty / k, scale: s, rotation: r });
  };
  const report = (over: boolean) => {
    if (over && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDrag({ active: true, overBin: over });
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => scheduleOnRN(report, false))
    .onUpdate((e) => {
      dx.set(e.translationX);
      dy.set(e.translationY);
      const over = e.absoluteY > binTop;
      if (over !== overBin.get()) {
        overBin.set(over);
        scheduleOnRN(report, over);
      }
    })
    .onEnd(() => {
      scheduleOnRN(commit, dx.get(), dy.get(), scale.get(), rotation.get(), overBin.get());
      overBin.set(false);
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      scaleStart.set(scale.get());
    })
    .onUpdate((e) => {
      scale.set(Math.min(8, Math.max(0.2, scaleStart.get() * e.scale)));
    });
  const rotate = Gesture.Rotation()
    .onStart(() => {
      rotStart.set(rotation.get());
    })
    .onUpdate((e) => {
      rotation.set(rotStart.get() + (e.rotation * 180) / Math.PI);
    });
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok && onTap) scheduleOnRN(onTap);
  });
  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pan, pinch, rotate), tap);

  const span = CANVAS_W * 2 * k;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.get() },
      { translateY: dy.get() },
      { scale: scale.get() * (overBin.get() ? 0.6 : 1) },
      { rotate: `${rotation.get()}deg` },
    ],
    opacity: overBin.get() ? 0.6 : 1,
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.span,
        { left: el.x * k - span / 2, top: el.y * k - span / 2, width: span, height: span },
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={style}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  span: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
