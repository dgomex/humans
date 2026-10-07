import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Avatar, type AvatarRing } from './Avatar';
import { Text } from './Text';

export type UserRowProps = {
  username: string;
  /** Second line (full name, "In your contacts", …). */
  subtitle?: string | null;
  /** Optional third line in tertiary color. */
  detail?: string | null;
  avatarUri?: string | null;
  avatarSize?: number;
  ring?: AvatarRing;
  trailing?: ReactNode;
  onPress?: () => void;
};

/** Avatar + username + subtitle + trailing control (follow lists, suggestions, switcher). */
export function UserRow({
  username,
  subtitle,
  detail,
  avatarUri,
  avatarSize = 44,
  ring = 'none',
  trailing,
  onPress,
}: UserRowProps) {
  const { spacing, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
        },
      ]}
    >
      <Avatar uri={avatarUri} size={avatarSize} ring={ring} />
      <View style={styles.text}>
        <Text variant="bodyBold" numberOfLines={1}>
          {username}
        </Text>
        {subtitle ? (
          <Text color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, minWidth: 0 },
});
