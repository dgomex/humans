import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';

export type AuthStepProps = {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Pinned to the bottom (e.g. "I already have an account"). */
  footer?: ReactNode;
  /** Top-left control. Default: back arrow → router.back(). `null` hides it. */
  onBack?: (() => void) | null;
  backIcon?: 'back' | 'close';
  /** Optional element in the header row's right side. */
  headerRight?: ReactNode;
  /** Center content vertically (Welcome / Log in). */
  centered?: boolean;
};

/** Shared layout for every sign-up / recovery step: back arrow, big title, gray text, body. */
export function AuthStep({
  title,
  subtitle,
  children,
  footer,
  onBack,
  backIcon = 'back',
  headerRight,
  centered = false,
}: AuthStepProps) {
  const { colors, spacing } = useTheme();
  const back = onBack === undefined ? () => router.back() : onBack;

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
          {back ? (
            <Pressable
              onPress={back}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={backIcon === 'close' ? 'Cancel' : 'Back'}
            >
              <Icon name={backIcon} size={28} />
            </Pressable>
          ) : (
            <View />
          )}
          {headerRight}
        </View>
        <ScrollView
          contentContainerStyle={[
            { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
            centered && styles.centered,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {title ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
              {typeof subtitle === 'string' ? <Text>{subtitle}</Text> : subtitle}
            </View>
          ) : null}
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={[styles.footer, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centered: { justifyContent: 'center' },
  footer: { alignItems: 'center' },
});
