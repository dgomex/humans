import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

/** Collapsed height as a share of the window (Instagram opens comments at about 3/4). */
const COLLAPSED = 0.72;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * A bottom sheet for a whole route (comments): the route is a transparent full-window modal and
 * this draws the backdrop + panel itself, so layout and keyboard math use real window
 * coordinates (native form sheets don't). Drag the handle up to expand, down to collapse or
 * close; the panel expands and sits on top of the keyboard while typing.
 */
export function ScreenSheet({
  header,
  children,
}: {
  /** Grabber area content (title); the drag gesture lives here so lists keep scrolling. */
  header: ReactNode;
  children: ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [keyboard, setKeyboard] = useState(0);

  const fullTop = insets.top + spacing.sm;
  const collapsedTop = windowHeight * (1 - COLLAPSED);
  const open = expanded || keyboard > 0;

  const top = useSharedValue(collapsedTop);
  const bottom = useSharedValue(0);
  const drag = useSharedValue(windowHeight);

  // Slide in on mount.
  useEffect(() => {
    drag.set(withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [drag]);

  useEffect(() => {
    top.set(withTiming(open ? fullTop : collapsedTop, { duration: 220 }));
  }, [open, fullTop, collapsedTop, top]);

  useEffect(() => {
    bottom.set(withTiming(keyboard, { duration: Platform.OS === 'ios' ? 250 : 120 }));
  }, [keyboard, bottom]);

  // How much the keyboard covers the window bottom. On Android the window may already have been
  // resized for it, in which case nothing is covered.
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const windowBottom = Dimensions.get('window').height;
      setKeyboard(Math.max(0, windowBottom - e.endCoordinates.screenY));
    };
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow,
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboard(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    Keyboard.dismiss();
    drag.set(withTiming(windowHeight, { duration: 200 }));
    // Leave on a timer, not the animation callback: it never fires if frames are paused.
    setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, 200);
  }, [closing, drag, windowHeight]);

  // Plain JS helpers for the gesture: worklets can't capture native modules like Keyboard.
  const collapse = () => {
    setExpanded(false);
    Keyboard.dismiss();
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Down drags the panel; up is handled on release (expand).
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY < -40 || e.velocityY < -DISMISS_VELOCITY) {
        drag.set(withTiming(0, { duration: 150 }));
        scheduleOnRN(setExpanded, true);
      } else if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        if (expanded) {
          drag.set(withTiming(0, { duration: 150 }));
          scheduleOnRN(collapse);
        } else {
          scheduleOnRN(close);
        }
      } else {
        drag.set(withTiming(0, { duration: 150 }));
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    top: top.get(),
    bottom: bottom.get(),
    transform: [{ translateY: drag.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.get(), [0, windowHeight * 0.6], [1, 0], 'clamp'),
  }));

  return (
    <View style={styles.fill}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.backgroundElevated,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
          },
          panelStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={{ paddingTop: spacing.sm }}>
            <View style={[styles.grabber, { backgroundColor: colors.textTertiary }]} />
            {header}
          </View>
        </GestureDetector>
        {/* Composer sits above the keyboard; otherwise above the home indicator. */}
        <View style={[styles.fill, { paddingBottom: keyboard > 0 ? 0 : insets.bottom }]}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  panel: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
});
