import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ActionRowProps = {
  label: string;
  icon?: IconName;
  /** Secondary line under the label. */
  detail?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** Right side (switch, check, value text). Defaults to nothing. */
  trailing?: ReactNode;
  onPress?: () => void;
};

/** One row of a menu sheet / settings list (icon · label · trailing). */
export function ActionRow({
  label,
  icon,
  detail,
  destructive,
  disabled,
  trailing,
  onPress,
}: ActionRowProps) {
  const { colors, spacing } = useTheme();
  const tint = destructive ? colors.danger : disabled ? colors.textTertiary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.backgroundPressed : 'transparent',
        },
      ]}
    >
      {icon ? <Icon name={icon} size={24} color={tint} /> : null}
      <View style={styles.text}>
        <Text style={{ color: tint, fontSize: 15 }}>{label}</Text>
        {detail ? (
          <Text variant="caption" color="textSecondary">
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/** Rounded group of rows with hairline separators (Instagram's grouped sheet sections). */
export function ActionGroup({ children }: { children: ReactNode }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  text: { flex: 1 },
});
