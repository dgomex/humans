import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Rendered before the title (e.g. an `<Icon />`). */
  leading?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

const heights: Record<ButtonSize, number> = { sm: 32, md: 36, lg: 44 };

/**
 * Instagram-style button: primary = blue fill (Follow/Log in), secondary = grey fill
 * (Following/Edit profile/Message), outline, text (blue link), danger (red text).
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leading,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, radius, spacing, hairline } = useTheme();
  const inactive = disabled || loading;

  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.backgroundSecondary,
    outline: 'transparent',
    text: 'transparent',
    danger: 'transparent',
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.onPrimary,
    secondary: colors.text,
    outline: colors.text,
    text: colors.primary,
    danger: colors.danger,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: variant === 'text' ? 0 : spacing.lg,
          borderRadius: radius.md,
          backgroundColor:
            pressed && variant === 'primary'
              ? colors.primaryPressed
              : pressed && variant === 'secondary'
                ? colors.backgroundPressed
                : bg[variant],
          borderWidth: variant === 'outline' ? hairline * 2 : 0,
          borderColor: colors.separator,
          opacity: disabled
            ? 0.5
            : pressed && (variant === 'text' || variant === 'danger')
              ? 0.5
              : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[variant]} />
      ) : (
        <View style={[styles.row, { gap: spacing.xs }]}>
          {leading}
          <Text
            variant={size === 'sm' ? 'captionBold' : 'bodyBold'}
            style={{ color: fg[variant] }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
