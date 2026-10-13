import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon, Text, type IconName } from '@/components';
import { useTheme } from '@/theme';

import { useActivityBadge } from '../api';

const BUBBLE_MS = 5000;

/**
 * Home header ♡ (page 71 entry): red dot while there's unseen activity, and a bubble with
 * likes / follows / comments counts that pops up when new activity arrives.
 */
export function ActivityHeart() {
  const { colors, spacing } = useTheme();
  const badge = useActivityBadge();
  const b = badge.data;
  const unseen = b?.unseen ?? 0;
  const [bubble, setBubble] = useState(false);
  const shownFor = useRef(0);

  useEffect(() => {
    if (unseen > shownFor.current) {
      shownFor.current = unseen;
      setBubble(true);
      const t = setTimeout(() => setBubble(false), BUBBLE_MS);
      return () => clearTimeout(t);
    }
    if (unseen === 0) shownFor.current = 0;
  }, [unseen]);

  const counts: { icon: IconName; n: number }[] = b
    ? ([
        { icon: 'heartFilled', n: b.likes },
        { icon: 'person', n: b.follows + b.requests },
        { icon: 'comment', n: b.comments },
      ].filter((c) => c.n > 0) as { icon: IconName; n: number }[])
    : [];

  return (
    <View>
      <Pressable
        onPress={() => {
          setBubble(false);
          router.push('/activity');
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={unseen > 0 ? `Notifications, ${unseen} new` : 'Notifications'}
      >
        <Icon name="heart" size={26} />
        {unseen > 0 ? (
          <View
            style={[styles.dot, { backgroundColor: colors.like, borderColor: colors.background }]}
          />
        ) : null}
      </Pressable>
      {bubble && counts.length > 0 ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={styles.bubbleWrap}
        >
          <View style={[styles.arrow, { borderBottomColor: colors.like }]} />
          <View
            style={[
              styles.bubble,
              { backgroundColor: colors.like, gap: spacing.sm, paddingHorizontal: spacing.md },
            ]}
          >
            {counts.map((c) => (
              <View key={c.icon} style={styles.count}>
                <Icon name={c.icon} size={14} color={colors.onPrimary} />
                <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                  {c.n > 99 ? '99+' : c.n}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  bubbleWrap: { position: 'absolute', top: 34, right: -14, alignItems: 'flex-end', zIndex: 10 },
  arrow: {
    width: 0,
    height: 0,
    marginRight: 22,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: 8,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
