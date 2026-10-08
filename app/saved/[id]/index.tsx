import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, BottomSheet, Icon, Text, useToast } from '@/components';
import { ProfileGrid } from '@/features/profile/components/ProfileTabs';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { ALL_POSTS, useCollection, useDeleteCollection, useSavedPosts } from '@/features/saved/api';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** Page 027 — Saved collection detail (or All posts): 3-column grid (saved_posts); ⋯ edit / delete. */
export default function CollectionScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAll = id === ALL_POSTS;
  const collection = useCollection(id);
  const posts = useSavedPosts(id);
  const items = (posts.data?.pages.flat() ?? []).map((p) => ({
    id: p.id,
    uri: p.coverUrl,
    kind:
      p.media_count > 1
        ? ('carousel' as const)
        : p.cover_type === 'video'
          ? ('video' as const)
          : undefined,
  }));
  const remove = useDeleteCollection();
  const [menu, setMenu] = useState(false);
  const title = isAll ? 'All posts' : (collection.data?.name ?? '');

  function confirmDelete() {
    setMenu(false);
    showDialog(
      'Delete collection?',
      'When you delete this collection, the photos and videos will still be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(id, {
              onSuccess: () => goBack(),
              onError: () => toast.show("Couldn't delete collection."),
            }),
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={title}
        center
        right={
          isAll ? null : (
            <TopBarButton icon="more" label="Collection options" onPress={() => setMenu(true)} />
          )
        }
      />
      <ScrollView
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y > contentSize.height - 400) {
            if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
          }
        }}
        scrollEventThrottle={64}
      >
        {posts.isPending ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : (
          <ProfileGrid
            items={items}
            scroller={{ source: 'saved', owner: id, title }}
            empty={
              <View
                style={{
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: spacing.xl,
                  marginTop: spacing.xxl,
                }}
              >
                <Icon name="bookmark" size={48} />
                <Text variant="headline">Start saving</Text>
                <Text color="textSecondary" style={{ textAlign: 'center' }}>
                  {isAll
                    ? 'Save photos and videos that you want to see again.'
                    : 'Save photos and videos to this collection.'}
                </Text>
              </View>
            }
          />
        )}
      </ScrollView>
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <ActionRow
          label="Edit collection"
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/saved/[id]/edit', params: { id } });
          }}
        />
        <ActionRow label="Delete collection" destructive onPress={confirmDelete} />
      </BottomSheet>
    </SafeAreaView>
  );
}
