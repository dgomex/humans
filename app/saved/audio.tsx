import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { TopBar } from '@/features/profile/components/TopBar';
import { useSavedAudio } from '@/features/reels/api';
import { formatDuration } from '@/features/reels/types';
import { useTheme } from '@/theme';

/** Page 26 → Audio (Phase 6): sounds saved from audio pages / the music picker. */
export default function SavedAudioScreen() {
  const { colors, spacing, radius } = useTheme();
  const saved = useSavedAudio();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Audio" center />
      {saved.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      <FlatList
        data={saved.data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingVertical: spacing.sm }}
        ListEmptyComponent={
          saved.isSuccess ? (
            <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }}>
              <Icon name="music" size={40} />
              <Text variant="headline">No saved audio</Text>
              <Text color="textSecondary" style={{ textAlign: 'center' }}>
                Save sounds from a reel&apos;s audio page to use them later.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/audio/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: pressed ? colors.backgroundPressed : 'transparent',
            })}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.sm,
                backgroundColor: item.cover_color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="musicFilled" size={22} color={colors.onMedia} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.source === 'original' ? `${item.artist} · Original audio` : item.artist}
                {' · '}
                {formatDuration(item.duration_ms)}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
