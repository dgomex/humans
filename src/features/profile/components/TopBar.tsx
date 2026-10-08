import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** 48pt header used by profile-area screens: optional back, title, right-side icons. */
export function TopBar({
  title,
  back = true,
  onBack,
  left,
  right,
  center = false,
}: {
  title?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  /** Center the title (list screens) instead of left-aligning it (profiles). */
  center?: boolean;
}) {
  const { colors, spacing, hairline } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          backgroundColor: colors.background,
          borderBottomWidth: center ? hairline : 0,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      {back ? <TopBarButton icon="back" label="Back" onPress={onBack ?? (() => goBack())} /> : null}
      {left}
      <View style={[styles.title, center && styles.centered]}>
        {typeof title === 'string' ? (
          <Text variant="subhead" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
      </View>
      <View style={[styles.right, { gap: spacing.lg, minWidth: center ? 28 : undefined }]}>
        {right}
      </View>
    </View>
  );
}

export function TopBarButton({
  icon,
  label,
  onPress,
  size = 26,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { height: 48, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  centered: { justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
});
