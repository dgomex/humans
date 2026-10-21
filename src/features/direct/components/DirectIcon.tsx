import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import { useDirectBadge } from '../api';

/** Home header ✈ (page 74 entry) with the unread-chats count. */
export function DirectIcon() {
  const { colors } = useTheme();
  const badge = useDirectBadge();
  const n = badge.data?.unread ?? 0;
  return (
    <Pressable
      onPress={() => router.push('/direct')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={n > 0 ? `Messages, ${n} unread` : 'Messages'}
    >
      <Icon name="messenger" size={26} />
      {n > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: colors.like, borderColor: colors.background }]}
        >
          <Text variant="tiny" style={{ color: colors.onPrimary, fontWeight: '700' }}>
            {n > 9 ? '9+' : n}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
