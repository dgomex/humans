import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionGroup, ActionRow, Avatar, BottomSheet, Icon, Text, useToast } from '@/components';
import {
  activityKeys,
  patchActivityGroup,
  useActivityFeed,
  useAnswerCollabInline,
  useDeleteNotification,
  useFollowRequestSummary,
  useLikeCommentInline,
  type ActivityGroup,
  type ActivitySection,
} from '@/features/activity/api';
import { NotificationRow } from '@/features/activity/components/NotificationRow';
import { SuggestionsSection } from '@/features/activity/components/Suggestions';
import { SECTION_TITLES } from '@/features/activity/format';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { ringOf, storyKeys, type StoryRing } from '@/features/stories/api';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

type Item =
  | { kind: 'section'; key: string; section: ActivitySection }
  | { kind: 'row'; key: string; group: ActivityGroup };

/** Page 71 — Notifications (Activity). */
export default function ActivityScreen() {
  const { colors, spacing } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const feed = useActivityFeed();
  const requests = useFollowRequestSummary();
  const remove = useDeleteNotification();
  const likeComment = useLikeCommentInline();
  const answerCollab = useAnswerCollabInline();
  const [menuFor, setMenuFor] = useState<ActivityGroup | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const groups = useMemo(() => feed.data?.pages.flatMap((p) => p.groups) ?? [], [feed.data]);

  const items = useMemo(() => {
    const out: Item[] = [];
    let last: ActivitySection | null = null;
    for (const g of groups) {
      if (g.section !== last) {
        out.push({ kind: 'section', key: `s:${g.section}`, section: g.section });
        last = g.section;
      }
      out.push({ kind: 'row', key: g.group_key, group: g });
    }
    return out;
  }, [groups]);

  // Story rings on single-actor avatars (tap opens their story).
  const actorIds = useMemo(
    () =>
      [...new Set(groups.filter((g) => g.actor_count === 1).map((g) => g.actors[0]?.id))]
        .filter((x): x is string => !!x)
        .sort(),
    [groups],
  );
  const rings = useQuery({
    queryKey: storyKeys.rings(actorIds),
    enabled: actorIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('story_rings', { p_users: actorIds });
      if (error) throw error;
      return new Map((data ?? []).map((r: StoryRing) => [r.user_id, r]));
    },
  });

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.resetQueries({ queryKey: activityKeys.feed }),
        requests.refetch(),
        qc.invalidateQueries({ queryKey: activityKeys.badge }),
      ]);
    } catch {
      toast.show("Couldn't refresh feed");
    } finally {
      setRefreshing(false);
    }
  }

  const requestCount = requests.data?.total ?? 0;
  const header =
    requestCount > 0 ? (
      <FollowRequestsRow total={requestCount} latest={requests.data?.latest ?? []} />
    ) : null;

  const empty = feed.isPending ? (
    <SkeletonRows />
  ) : feed.isError ? (
    <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
      <Text color="textSecondary">{"Couldn't load activity."}</Text>
      <Pressable onPress={() => feed.refetch()} accessibilityRole="button">
        <Text variant="bodyBold" color="primary">
          Try again
        </Text>
      </Pressable>
    </View>
  ) : (
    <View style={[styles.center, { padding: spacing.xl, gap: spacing.sm }]}>
      <View style={[styles.emptyIcon, { borderColor: colors.text }]}>
        <Icon name="heart" size={44} />
      </View>
      <Text variant="headline" style={{ textAlign: 'center' }}>
        Activity On Your Posts
      </Text>
      <Text color="textSecondary" style={{ textAlign: 'center' }}>
        {"When someone likes or comments on one of your posts, you'll see it here."}
      </Text>
      <Pressable onPress={() => router.push('/compose')} accessibilityRole="button">
        <Text variant="bodyBold" color="primary">
          Share your first photo or video
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Notifications" />
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          <>
            {feed.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
            {!feed.hasNextPage && !feed.isPending ? <SuggestionsSection /> : null}
          </>
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) =>
          item.kind === 'section' ? (
            <Text
              variant="bodyBold"
              style={{
                fontSize: 16,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.xs,
              }}
            >
              {SECTION_TITLES[item.section]}
            </Text>
          ) : (
            <NotificationRow
              group={item.group}
              ring={
                item.group.actor_count === 1
                  ? ringOf(rings.data?.get(item.group.actors[0]?.id ?? ''))
                  : 'none'
              }
              onLongPress={() => setMenuFor(item.group)}
              onFollowChange={(s) =>
                patchActivityGroup(qc, item.group.group_key, (g) =>
                  g.actor_follow
                    ? {
                        ...g,
                        actor_follow: {
                          ...g.actor_follow,
                          i_follow: s === 'following',
                          requested: s === 'requested',
                        },
                      }
                    : g,
                )
              }
              onLikeComment={(like) => likeComment.mutate({ group: item.group, like })}
              onAnswerCollab={(accept) =>
                answerCollab.mutate(
                  { group: item.group, accept },
                  { onError: () => toast.show("Couldn't update the invite.") },
                )
              }
            />
          )
        }
      />

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        <ActionGroup>
          <ActionRow
            icon="trash"
            label="Delete notification"
            destructive
            onPress={() => {
              const g = menuFor;
              setMenuFor(null);
              if (g)
                remove.mutate(g, { onError: () => toast.show("Couldn't delete notification.") });
            }}
          />
        </ActionGroup>
      </BottomSheet>
    </SafeAreaView>
  );
}

function FollowRequestsRow({
  total,
  latest,
}: {
  total: number;
  latest: { id: string; username: string; avatar_path: string | null }[];
}) {
  const { colors, spacing } = useTheme();
  const [first, second] = latest;
  return (
    <Pressable
      onPress={() => router.push('/activity/requests')}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.requests,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
        },
      ]}
    >
      <View style={{ width: 44, height: 44 }}>
        {second ? (
          <>
            <View style={{ position: 'absolute', top: 0, right: 0 }}>
              <Avatar uri={avatarUrl(second.avatar_path)} size={32} />
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                left: -2,
                borderWidth: 2,
                borderRadius: 18,
                borderColor: colors.background,
              }}
            >
              <Avatar uri={avatarUrl(first?.avatar_path)} size={32} />
            </View>
          </>
        ) : (
          <Avatar uri={avatarUrl(first?.avatar_path)} size={44} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">Follow requests</Text>
        <Text color="textSecondary" numberOfLines={1}>
          {first ? first.username : ''}
          {total > 1 ? ` + ${total - 1} ${total - 1 === 1 ? 'other' : 'others'}` : ''}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      <Icon name="forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function SkeletonRows() {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={[styles.requests, { gap: spacing.md }]}>
          <View style={[styles.skelAvatar, { backgroundColor: colors.skeleton }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.skelLine, { backgroundColor: colors.skeleton, width: '80%' }]} />
            <View style={[styles.skelLine, { backgroundColor: colors.skeleton, width: '45%' }]} />
          </View>
          <View style={[styles.skelThumb, { backgroundColor: colors.skeleton }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  requests: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  skelAvatar: { width: 44, height: 44, borderRadius: 22 },
  skelLine: { height: 10, borderRadius: 5 },
  skelThumb: { width: 44, height: 44, borderRadius: 4 },
});
