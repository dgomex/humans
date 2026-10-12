import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { ALL_POSTS, useCollections } from '@/features/saved/api';
import { CollectionTile } from '@/features/saved/CollectionTile';
import { useTheme } from '@/theme';

/** Page 026 — Saved: All posts, Audio (Phase 6) + your collections (private to you). */
export default function SavedScreen() {
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const collections = useCollections();
  const tile = (width - spacing.lg * 2 - spacing.md) / 2;
  const open = (id: string) => router.push({ pathname: '/saved/[id]', params: { id } });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Saved"
        center
        right={
          <TopBarButton
            icon="add"
            label="New collection"
            onPress={() => router.push('/saved/new')}
          />
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <CollectionTile
            id={ALL_POSTS}
            name="All posts"
            width={tile}
            onPress={() => open(ALL_POSTS)}
          />
          <Pressable
            onPress={() => router.push('/saved/audio')}
            accessibilityRole="button"
            accessibilityLabel="Saved audio"
            style={{ width: tile, gap: spacing.xs }}
          >
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: radius.md,
                backgroundColor: colors.backgroundSecondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="music" size={48} color={colors.textSecondary} />
            </View>
            <Text variant="bodyBold">Audio</Text>
          </Pressable>
          {(collections.data ?? []).map((c) => (
            <CollectionTile
              key={c.id}
              id={c.id}
              name={c.name}
              width={tile}
              onPress={() => open(c.id)}
            />
          ))}
        </View>
        {collections.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
        {collections.data?.length === 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl }}>
            <Text variant="headline">Save</Text>
            <Text color="textSecondary" style={{ textAlign: 'center' }}>
              Save photos and videos that you want to see again. No one is notified, and only you
              can see what you&apos;ve saved.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
