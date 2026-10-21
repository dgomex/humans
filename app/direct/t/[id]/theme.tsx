import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, useToast } from '@/components';
import { directError, useThreadInfo, useThreadRpc, type ThemeKey } from '@/features/direct/api';
import { THEMES } from '@/features/direct/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Page 79 → Theme: everyone in the chat sees the new bubble colours. */
export default function ThemeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const info = useThreadInfo(id);
  const rpc = useThreadRpc();
  const current = info.data?.theme ?? 'default';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Theme" center />
      <ScrollView contentContainerStyle={[styles.grid, { padding: spacing.lg, gap: spacing.lg }]}>
        {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
          const th = THEMES[key];
          const on = key === current;
          return (
            <Pressable
              key={key}
              onPress={() =>
                rpc.mutate(
                  { fn: 'set_thread_theme', args: { p_thread: id, p_theme: key }, threadId: id },
                  {
                    onSuccess: () => goBack('/direct'),
                    onError: (e) => toast.show(directError(e)),
                  },
                )
              }
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={th.label}
              style={[styles.cell, { gap: spacing.xs }]}
            >
              <View
                style={[
                  styles.ring,
                  { borderColor: on ? colors.primary : 'transparent', borderRadius: radius.xl },
                ]}
              >
                <LinearGradient
                  colors={th.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.swatch, { borderRadius: radius.lg }]}
                >
                  {on ? <Icon name="check" size={24} color={colors.onPrimary} /> : null}
                </LinearGradient>
              </View>
              <Text variant="caption">{th.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '30%', alignItems: 'center' },
  ring: { borderWidth: 2, padding: 3 },
  swatch: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
});
