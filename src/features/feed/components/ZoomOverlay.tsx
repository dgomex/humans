import { Image } from 'expo-image';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** What's being zoomed and where it sits on screen (window coordinates). */
export type ZoomTarget = { uri: string; x: number; y: number; width: number; height: number };

type ZoomContextValue = {
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  /** Window rect of the media when the pinch started (worklet-written). */
  rect: SharedValue<{ x: number; y: number; width: number; height: number }>;
  setTarget: (target: ZoomTarget | null) => void;
};

const ZoomContext = createContext<ZoomContextValue | null>(null);

/**
 * Page 45 — pinch-to-zoom host. The pinched media lifts into this root-level layer (above the
 * feed list and tab bar) over a dimmed backdrop, follows the fingers and springs back on release.
 * Mount once around the navigator.
 */
export function ZoomProvider({ children }: { children: ReactNode }) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rect = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const [target, setTarget] = useState<ZoomTarget | null>(null);

  const value = useMemo(
    () => ({ scale, translateX, translateY, rect, setTarget }),
    [scale, translateX, translateY, rect],
  );

  return (
    <ZoomContext.Provider value={value}>
      <View style={styles.fill}>{children}</View>
      {target ? <ZoomLayer target={target} /> : null}
    </ZoomContext.Provider>
  );
}

function ZoomLayer({ target }: { target: ZoomTarget }) {
  const { colors } = useTheme();
  const { scale, translateX, translateY } = useZoom();

  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(scale.get(), [1, 2], [0, 0.85], 'clamp'),
  }));
  // Position/size are plain layout from the measured rect; only the transform animates
  // (animating layout props from a shared value is unreliable on the native renderer).
  const media = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.below,
          { backgroundColor: colors.mediaBackground },
          backdrop,
        ]}
      />
      <Animated.View
        style={[
          styles.media,
          { left: target.x, top: target.y, width: target.width, height: target.height },
          media,
        ]}
      >
        <Image
          source={{ uri: target.uri }}
          style={styles.fill}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </View>
  );
}

export function useZoom() {
  const ctx = useContext(ZoomContext);
  if (!ctx) throw new Error('useZoom must be used inside ZoomProvider');
  return ctx;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  media: { position: 'absolute', zIndex: 2, elevation: 2 },
  below: { zIndex: 1 },
  passThrough: { pointerEvents: 'none' },
});
