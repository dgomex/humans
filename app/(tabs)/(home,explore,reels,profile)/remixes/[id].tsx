import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { TopBar } from '@/features/profile/components/TopBar';
import { useRemixes } from '@/features/reels/api';
import { ReelGrid } from '@/features/reels/components/ReelGrid';
import { useTheme } from '@/theme';

/** Page 63 — "View remixes": every visible remix of a reel, newest first. */
export default function RemixesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const remixes = useRemixes(id);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Remixes" center />
      {remixes.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      <ScrollView>
        {remixes.data?.length === 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }}>
            <Icon name="remix" size={40} />
            <Text variant="headline">No remixes yet</Text>
          </View>
        ) : (
          <ReelGrid tiles={remixes.data ?? []} source="remixes" owner={id} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
