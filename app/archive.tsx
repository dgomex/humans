import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionGroup, ActionRow, BottomSheet, Icon, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfilePosts } from '@/features/posts/api';
import { ProfileGrid } from '@/features/profile/components/ProfileTabs';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { useStoryArchive, type ArchiveEntry } from '@/features/stories/api';
import { ArchiveCalendar, ArchiveGrid } from '@/features/stories/components/ArchiveGrid';
import { useTheme } from '@/theme';

type Kind = 'stories' | 'posts';

/**
 * Page 28 — Archive. ▾ switches Stories archive (Phase 5: grid with date badges or calendar, tap
 * to replay, Create highlight, archive settings) and Posts archive (Phase 3). Live: Phase 10.
 */
export default function ArchiveScreen() {
  const { colors, spacing } = useTheme();
  const [kind, setKind] = useState<Kind>('stories');
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const stories = useStoryArchive(kind === 'stories');
  const loadMore = () => {
    if (kind === 'stories' && stories.hasNextPage && !stories.isFetchingNextPage) {
      void stories.fetchNextPage();
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={
          <Pressable
            onPress={() => setMenu(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Choose archive"
          >
            <Text variant="subhead">
              {kind === 'stories' ? 'Stories archive' : 'Posts archive'}
            </Text>
            <Icon name="down" size={16} />
          </Pressable>
        }
        center
        right={
          kind === 'stories' ? (
            <TopBarButton icon="more" label="More options" onPress={() => setMore(true)} />
          ) : undefined
        }
      />
      {kind === 'stories' ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            {(
              [
                ['grid', 'grid'],
                ['calendar', 'calendar'],
              ] as const
            ).map(([v, icon]) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === v }}
                accessibilityLabel={v === 'grid' ? 'Grid' : 'Calendar'}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderBottomWidth: view === v ? 1 : 0,
                  borderColor: colors.text,
                }}
              >
                <Icon
                  name={icon}
                  size={22}
                  color={view === v ? colors.text : colors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
          <StoriesArchive view={view} archive={stories} onEndReached={loadMore} />
        </>
      ) : (
        <PostsArchive />
      )}

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <ActionGroup>
          <ActionRow
            icon="history"
            label="Stories archive"
            trailing={kind === 'stories' ? <Icon name="check" size={20} /> : undefined}
            onPress={() => {
              setKind('stories');
              setMenu(false);
            }}
          />
          <ActionRow
            icon="grid"
            label="Posts archive"
            trailing={kind === 'posts' ? <Icon name="check" size={20} /> : undefined}
            onPress={() => {
              setKind('posts');
              setMenu(false);
            }}
          />
        </ActionGroup>
      </BottomSheet>
      <BottomSheet visible={more} onClose={() => setMore(false)}>
        <ActionGroup>
          <ActionRow
            icon="addCircle"
            label="Create highlight"
            onPress={() => {
              setMore(false);
              router.push('/highlights/new');
            }}
          />
          <ActionRow
            icon="settings"
            label="Archive settings"
            detail="Save story to archive"
            onPress={() => {
              setMore(false);
              router.push('/story-settings');
            }}
          />
        </ActionGroup>
      </BottomSheet>
    </SafeAreaView>
  );
}

function StoriesArchive({
  view,
  archive,
  onEndReached,
}: {
  view: 'grid' | 'calendar';
  archive: ReturnType<typeof useStoryArchive>;
  onEndReached: () => void;
}) {
  const { spacing } = useTheme();
  const entries = archive.data?.pages.flat() ?? [];
  const play = (list: ArchiveEntry[], start: string) =>
    router.push({
      pathname: '/stories/view',
      params: { ids: list.map((e) => e.id).join(','), start },
    });

  return (
    <ScrollView
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (layoutMeasurement.height + contentOffset.y > contentSize.height - 400) onEndReached();
      }}
      scrollEventThrottle={200}
    >
      {archive.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {!archive.isPending && entries.length === 0 ? (
        <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
          <Icon name="history" size={48} />
          <Text variant="headline">Stories archive</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            Keep your stories in your archive after they disappear, so you can look back on your
            memories. Only you can see what&apos;s in your archive.
          </Text>
        </View>
      ) : null}
      {view === 'grid' ? (
        // Oldest first within the loaded window, so a tap plays forward in time.
        <ArchiveGrid entries={entries} onPress={(e) => play(entries.slice().reverse(), e.id)} />
      ) : (
        <ArchiveCalendar entries={entries} onOpenDay={(day) => play(day, day[0].id)} />
      )}
    </ScrollView>
  );
}

function PostsArchive() {
  const { spacing } = useTheme();
  const { profile } = useAuth();
  const archived = useProfilePosts(profile?.id, 'archived');
  const items = (archived.data?.pages.flat() ?? []).map((p) => ({
    id: p.id,
    uri: p.coverUrl,
    kind: p.media_count > 1 ? ('carousel' as const) : undefined,
  }));

  return (
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
  );
}
