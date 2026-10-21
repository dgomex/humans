import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text, UserRow } from '@/components';
import { UploadBanner } from '@/features/create/components/UploadBanner';
import { feedKeys, useHomeFeed } from '@/features/feed/api';
import { FeedList } from '@/features/feed/components/FeedList';
import { ActivityHeart } from '@/features/activity/components/ActivityHeart';
import { DirectIcon } from '@/features/direct/components/DirectIcon';
import { useSuggestedAccounts } from '@/features/follows/api';
import { storyKeys } from '@/features/stories/api';
import { StoriesTray } from '@/features/stories/components/StoriesTray';
import { FollowButton } from '@/features/follows/FollowButton';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import type { FollowStatus } from '@/features/profile/api';
import { useTheme } from '@/theme';

/** Page 43 — Home: header, stories tray, ranked feed, "You're all caught up", suggested posts. */
export default function HomeScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const feed = useHomeFeed();
  const [refreshing, setRefreshing] = useState(false);

  const all = useMemo(() => {
    // A post shows once: e.g. a suggestion already shown as a repost from someone you follow.
    const seen = new Set<string>();
    return (feed.data?.pages ?? [])
      .flatMap((p) => p.entries)
      .filter((e) => {
        const id = e.type === 'post' ? e.postId : e.key;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }, [feed.data]);
  // Nothing from followed accounts yet: "Welcome" + people to follow instead of "caught up".
  const welcome =
    !feed.isPending &&
    !feed.isError &&
    all.some((e) => e.type === 'caught-up') &&
    !all.some((e) => e.type === 'post' && e.reason !== 'suggested');
  const entries = welcome ? all.filter((e) => e.type !== 'caught-up') : all;

  async function refresh() {
    setRefreshing(true);
    // New snapshot: re-rank from the top (the feed keeps a stable order while scrolling).
    void qc.invalidateQueries({ queryKey: storyKeys.tray });
    await qc.resetQueries({ queryKey: feedKeys.home });
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <HomeHeader />
      <FeedList
        entries={feed.isPending ? [] : entries}
        inFeed
        header={
          <View>
            <UploadBanner />
            <StoriesTray />
            {welcome ? <Welcome /> : null}
          </View>
        }
        empty={
          feed.isPending ? <Skeletons /> : feed.isError ? <ErrorState onRetry={refresh} /> : null
        }
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        loadingMore={feed.isFetchingNextPage}
      />
    </SafeAreaView>
  );
}

function HomeHeader() {
  const { colors, spacing, hairline } = useTheme();
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: spacing.md,
          borderBottomWidth: hairline,
          borderColor: colors.separator,
        },
      ]}
    >
      <Pressable
        onPress={() => setMenu(true)}
        style={[styles.row, { gap: 4 }]}
        accessibilityRole="button"
        accessibilityLabel="Choose feed"
      >
        <Text style={styles.wordmark}>Humans</Text>
        <Icon name="down" size={18} />
      </Pressable>
      <View style={[styles.row, { gap: spacing.xl }]}>
        <ActivityHeart />
        <DirectIcon />
      </View>

      {/* Wordmark ▾ → Following / Favorites (page 51). */}
      <Modal transparent visible={menu} animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)}>
          <View
            style={[
              styles.menu,
              {
                top: insets.top + 48,
                left: spacing.md,
                backgroundColor: colors.backgroundElevated,
                borderColor: colors.separator,
              },
            ]}
          >
            {(
              [
                { kind: 'following', label: 'Following', icon: 'people' },
                { kind: 'favorites', label: 'Favorites', icon: 'starOutline' },
              ] as const
            ).map((o) => (
              <Pressable
                key={o.kind}
                onPress={() => {
                  setMenu(false);
                  router.push({ pathname: '/feed/[kind]', params: { kind: o.kind } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.menuRow,
                  {
                    paddingHorizontal: spacing.lg,
                    backgroundColor: pressed ? colors.backgroundPressed : 'transparent',
                  },
                ]}
              >
                <Text variant="bodyBold" style={{ flex: 1 }}>
                  {o.label}
                </Text>
                <Icon name={o.icon} size={22} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Skeletons() {
  const { colors, spacing } = useTheme();
  return (
    <View>
      {[0, 1].map((i) => (
        <View key={i} style={{ marginBottom: spacing.lg }}>
          <View style={[styles.row, { padding: spacing.md, gap: spacing.sm }]}>
            <View style={[styles.skelAvatar, { backgroundColor: colors.skeleton }]} />
            <View style={[styles.skelLine, { backgroundColor: colors.skeleton }]} />
          </View>
          <View style={{ aspectRatio: 0.8, backgroundColor: colors.skeleton }} />
        </View>
      ))}
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
      <Icon name="alert" size={40} />
      <Text color="textSecondary" style={{ textAlign: 'center' }}>
        Couldn&apos;t refresh feed. Check your connection and try again.
      </Text>
      <Button title="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** New account / nobody followed yet: "Welcome" + accounts to follow. */
function Welcome() {
  const { spacing } = useTheme();
  const suggestions = useSuggestedAccounts();
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  return (
    <View style={{ paddingVertical: spacing.xl, gap: spacing.sm }}>
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl }}>
        <Text variant="headline">Welcome to Humans</Text>
        <Text color="textSecondary" style={{ textAlign: 'center' }}>
          Follow people to start seeing the photos and videos they share.
        </Text>
      </View>
      {(suggestions.data ?? []).slice(0, 10).map((a) => (
        <UserRow
          key={a.id}
          username={a.username}
          subtitle={a.full_name}
          avatarUri={avatarUrl(a.avatar_path)}
          onPress={() => openProfile(a.username)}
          trailing={
            <FollowButton
              userId={a.id}
              username={a.username}
              isPrivate={a.is_private}
              status={status[a.id] ?? 'none'}
              onChange={(s) => setStatus((m) => ({ ...m, [a.id]: s }))}
            />
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontSize: 26, lineHeight: 32, fontWeight: '700', fontStyle: 'italic' },
  menu: {
    position: 'absolute',
    width: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', height: 48 },
  skelAvatar: { width: 32, height: 32, borderRadius: 16 },
  skelLine: { width: 120, height: 12, borderRadius: 6 },
});
