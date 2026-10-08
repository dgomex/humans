import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { useTheme } from '@/theme';

/** Temporary body for shell routes until their page is built. */
export function PlaceholderScreen({
  title,
  note,
  children,
  header,
}: {
  title: string;
  note: string;
  children?: ReactNode;
  /** Shown above the placeholder (e.g. the Home upload banner). */
  header?: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]}>
        <Text variant="headline">{title}</Text>
        <Text color="textSecondary" style={styles.centerText}>
          {note}
        </Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
});
