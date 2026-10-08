import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfilePosts } from '@/features/posts/api';
import { ProfileGrid } from '@/features/profile/components/ProfileTabs';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/**
 * Page 28, posts part (built with Phase 3 by decision): archived posts, newest archived first.
 * Opening one shows "Show on profile" in its ⋯ menu. Stories/live archives: Phases 5 and 10.
 */
export default function ArchiveScreen() {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const archived = useProfilePosts(profile?.id, 'archived');
  const items = (archived.data?.pages.flat() ?? []).map((p) => ({
    id: p.id,
    uri: p.coverUrl,
    kind: p.media_count > 1 ? ('carousel' as const) : undefined,
  }));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Posts archive" center />
      <ScrollView
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (
            layoutMeasurement.height + contentOffset.y > contentSize.height - 400 &&
            archived.hasNextPage &&
            !archived.isFetchingNextPage
          ) {
            void archived.fetchNextPage();
          }
        }}
        scrollEventThrottle={200}
      >
        {archived.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
        <ProfileGrid
          items={items}
          empty={
            archived.isPending ? null : (
              <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
                <Icon name="archive" size={48} />
                <Text variant="headline">Posts archive</Text>
                <Text color="textSecondary" style={{ textAlign: 'center' }}>
                  Only you can see posts you&apos;ve archived. Archive a post from its ··· menu to
                  hide it from your profile without deleting it.
                </Text>
              </View>
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
