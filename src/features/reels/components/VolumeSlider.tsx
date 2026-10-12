import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components';
import { useTheme } from '@/theme';

/** Labelled 0–100% slider (audio mixer, page 60). Tap or drag along the track. */
export function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(1);
  const set = (x: number) => onChange(Math.round(Math.min(1, Math.max(0, x / width)) * 100) / 100);
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(set, e.x))
    .onUpdate((e) => scheduleOnRN(set, e.x));
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
        <Text color="textSecondary">{Math.round(value * 100)}%</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
          style={{ height: 28, justifyContent: 'center' }}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            onChange(
              Math.min(
                1,
                Math.max(0, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)),
              ),
            )
          }
        >
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.backgroundSecondary }}>
            <View
              style={{
                width: `${value * 100}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              left: value * width - 10,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.background,
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
