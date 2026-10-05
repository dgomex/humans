import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max height as a fraction of the window (content sizes itself up to this). Default 0.9. */
  maxHeightRatio?: number;
};

const OPEN_MS = 260;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

/**
 * Modal bottom sheet with grabber, backdrop tap/back-button dismiss and drag-down to dismiss
 * (drag starts on the grabber/title area so inner scroll views keep working).
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.9,
}: BottomSheetProps) {
  const { colors, radius, spacing, hairline } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(windowHeight);

  // Mount synchronously when opened; unmount only after the close animation finishes.
  if (visible && !mounted) setMounted(true);

  const finishClose = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      translateY.set(windowHeight);
      translateY.set(withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }));
    } else {
      translateY.set(
        withTiming(windowHeight, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(finishClose);
        }),
      );
    }
  }, [visible, windowHeight, translateY, finishClose]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withSpring(0, { damping: 20, stiffness: 220 }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.get(), [0, windowHeight * 0.5], [1, 0], 'clamp'),
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: windowHeight * maxHeightRatio,
              backgroundColor: colors.backgroundElevated,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: insets.bottom + spacing.sm,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ paddingTop: spacing.sm }}>
              <View style={[styles.grabber, { backgroundColor: colors.textTertiary }]} />
              {title ? (
                <View
                  style={[
                    styles.header,
                    { borderBottomWidth: hairline, borderBottomColor: colors.separator },
                  ]}
                >
                  <Text variant="subhead">{title}</Text>
                </View>
              ) : (
                <View style={{ height: spacing.md }} />
              )}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  header: { alignItems: 'center', paddingVertical: 12 },
});
