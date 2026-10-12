import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components';
import { useTheme } from '@/theme';

import { secondsLabel } from '../types';

const HANDLE = 22;

/**
 * Two-handle range over 0…`max` ms (trim a clip, time a text, trim the remix original).
 * Drag either handle; the window keeps at least `minGap`.
 */
export function RangeSlider({
  max,
  start,
  end,
  onChange,
  minGap = 300,
  label,
}: {
  max: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  minGap?: number;
  label?: string;
}) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(1);
  const startAt = useSharedValue(0);
  const span = Math.max(1, max);
  const toX = (ms: number) => (ms / span) * width;

  const move = (which: 'start' | 'end', from: number, dx: number) => {
    const ms = from + (dx / width) * span;
    if (which === 'start') onChange(Math.round(Math.min(Math.max(0, ms), end - minGap)), end);
    else onChange(start, Math.round(Math.max(Math.min(span, ms), start + minGap)));
  };

  const handle = (which: 'start' | 'end') =>
    Gesture.Pan()
      .minDistance(0)
      .onBegin(() => {
        startAt.set(which === 'start' ? start : end);
      })
      .onUpdate((e) => scheduleOnRN(move, which, startAt.get(), e.translationX));

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="bodyBold">{label}</Text>
          <Text color="textSecondary">
            {secondsLabel(start)} – {secondsLabel(end)} · {secondsLabel(end - start)}
          </Text>
        </View>
      ) : null}
      <View
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        style={{ height: 36, justifyContent: 'center', marginHorizontal: HANDLE / 2 }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.backgroundSecondary }} />
        <View
          style={{
            position: 'absolute',
            left: toX(start),
            width: Math.max(2, toX(end) - toX(start)),
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
          }}
        />
        {(['start', 'end'] as const).map((which) => (
          <GestureDetector key={which} gesture={handle(which)}>
            <View
              hitSlop={12}
              accessibilityRole="adjustable"
              accessibilityLabel={which === 'start' ? 'Start' : 'End'}
              style={{
                position: 'absolute',
                left: toX(which === 'start' ? start : end) - HANDLE / 2,
                width: HANDLE,
                height: HANDLE + 8,
                borderRadius: 6,
                backgroundColor: colors.background,
                borderWidth: 2,
                borderColor: colors.primary,
              }}
            />
          </GestureDetector>
        ))}
      </View>
    </View>
  );
}
