import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { feedKeys, useChronoFeed, type ChronoKind, type FeedEntry } from '@/features/feed/api';
import { FeedList } from '@/features/feed/components/FeedList';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Page 51 — chronological Following / Favorites feeds (no suggestions). */
export default function ChronoFeedScreen() {
  const { kind: raw } = useLocalSearchParams<{ kind: string }>();
  const kind: ChronoKind = raw === 'favorites' ? 'favorites' : 'following';
  const { colors, spacing } = useTheme();
  const qc = useQueryClient();
  const feed = useChronoFeed(kind);
  const [refreshing, setRefreshing] = useState(false);

  const entries = useMemo<FeedEntry[]>(
    () =>
      (feed.data?.pages ?? []).flatMap((p) =>
        p.ids.map((id) => ({
          type: 'post' as const,
          key: id,
          postId: id,
          reason: kind === 'favorites' ? ('favorite' as const) : ('following' as const),
        })),
      ),
    [feed.data, kind],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="subhead">{kind === 'favorites' ? 'Favorites' : 'Following'}</Text>
            {kind === 'favorites' ? <Icon name="star" size={16} color={colors.primary} /> : null}
          </View>
        }
        onBack={() => goBack('/')}
        right={
          kind === 'favorites' ? (
            <TopBarButton
              icon="edit"
              label="Manage favorites"
              onPress={() => router.push('/favorites')}
            />
          ) : null
        }
      />
      <FeedList
        entries={entries}
        inFeed
        empty={
          feed.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
              <Icon name={kind === 'favorites' ? 'starOutline' : 'people'} size={48} />
              <Text variant="headline" style={{ textAlign: 'center' }}>
                {kind === 'favorites' ? 'Add accounts to Favorites' : 'No posts yet'}
              </Text>
              <Text color="textSecondary" style={{ textAlign: 'center' }}>
                {kind === 'favorites'
                  ? 'Posts from your favorites appear here, newest first.'
                  : "When people you follow post, you'll see them here."}
              </Text>
              {kind === 'favorites' ? (
                <Button title="Add favorites" onPress={() => router.push('/favorites')} />
              ) : null}
            </View>
          )
        }
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await qc.resetQueries({ queryKey: feedKeys.chrono(kind) });
          setRefreshing(false);
        }}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        loadingMore={feed.isFetchingNextPage}
      />
    </SafeAreaView>
  );
}
