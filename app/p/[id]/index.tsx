import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  usePostCard,
  usePostScroller,
  type FeedEntry,
  type FeedPost,
  type ScrollerSource,
} from '@/features/feed/api';
import { FeedList } from '@/features/feed/components/FeedList';
import { useProfilePosts, useRespondCollab } from '@/features/posts/api';
import { ProfileGrid } from '@/features/profile/components/ProfileTabs';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

const SOURCES: ScrollerSource[] = ['grid', 'tagged', 'reposts', 'saved'];

/**
 * Page 44 — post detail. From a profile grid / tagged / reposts / saved grid (`source` + `owner`
 * params) it's a vertical scroller of that grid starting at the tapped post; from a link it's
 * the single post plus "More posts from <user>".
 */
export default function PostScreen() {
  const params = useLocalSearchParams<{
    id: string;
    source?: string;
    owner?: string;
    title?: string;
  }>();
  const source = SOURCES.find((s) => s === params.source);
  return source && params.owner ? (
    <Scroller id={params.id} source={source} owner={params.owner} title={params.title} />
  ) : (
    <SinglePost id={params.id} />
  );
}

function Scroller({
  id,
  source,
  owner,
  title,
}: {
  id: string;
  source: ScrollerSource;
  owner: string;
  title?: string;
}) {
  const { colors } = useTheme();
  const list = usePostScroller(source, owner);
  const ids = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.ids), [list.data]);
  const index = ids.indexOf(id);
  // Render from the tapped post first, then reveal the earlier ones above it.
  const [showEarlier, setShowEarlier] = useState(false);

  // The tapped post may sit in a later page.
  useEffect(() => {
    if (index === -1 && list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  }, [index, list]);
  useEffect(() => {
    if (index > 0 && !showEarlier) {
      const t = setTimeout(() => setShowEarlier(true), 400);
      return () => clearTimeout(t);
    }
  }, [index, showEarlier]);

  const entries = useMemo<FeedEntry[]>(() => {
    if (index === -1) return [];
    return ids
      .slice(showEarlier ? 0 : index)
      .map((postId) => ({
        type: 'post' as const,
        key: postId,
        postId,
        reason: 'following' as const,
      }));
  }, [ids, index, showEarlier]);

  // Not in the grid any more (deleted / archived meanwhile): fall back to the single post.
  if (!list.isPending && index === -1 && !list.hasNextPage) return <SinglePost id={id} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        center
        title={
          <View style={{ alignItems: 'center' }}>
            {title ? (
              <Text variant="caption" color="textSecondary">
                {title}
              </Text>
            ) : null}
            <Text variant="subhead">{source === 'saved' ? 'Saved' : 'Posts'}</Text>
          </View>
        }
      />
      {entries.length === 0 ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FeedList
          entries={entries}
          maintainPosition
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          loadingMore={list.isFetchingNextPage}
        />
      )}
    </SafeAreaView>
  );
}

function SinglePost({ id }: { id: string }) {
  const { colors, spacing } = useTheme();
  const card = usePostCard(id);
  const post = card.data;

  if (card.isPending) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <TopBar title="Post" center />
        <View style={[styles.center, { gap: spacing.sm, padding: spacing.xl }]}>
          <Text variant="headline">Post isn&apos;t available</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            The link may be broken, or the post may have been removed.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title={post.archived_at ? 'Archived post' : 'Post'} center />
      <FeedList
        entries={[{ type: 'post', key: post.id, postId: post.id, reason: 'following' }]}
        expandedId={post.id}
        header={<CollabInvite post={post} />}
        footer={<MorePosts post={post} />}
      />
    </SafeAreaView>
  );
}

/** "More posts from <username>" under a single opened post. */
function MorePosts({ post }: { post: FeedPost }) {
  const { spacing } = useTheme();
  const grid = useProfilePosts(post.author_id, 'grid', !post.archived_at);
  const items = (grid.data?.pages[0] ?? [])
    .filter((p) => p.id !== post.id)
    .slice(0, 9)
    .map((p) => ({
      id: p.id,
      uri: p.coverUrl,
      kind:
        p.media_count > 1
          ? ('carousel' as const)
          : p.cover_type === 'video'
            ? ('video' as const)
            : undefined,
    }));
  if (items.length === 0) return null;
  return (
    <View style={{ paddingBottom: spacing.xxl }}>
      <Text variant="bodyBold" style={{ padding: spacing.md }}>
        More posts from <Text variant="bodyBold">{post.author.username}</Text>
      </Text>
      <ProfileGrid items={items} empty={null} />
    </View>
  );
}

/** Pending collaboration invite for me (page 36): accept / decline. */
function CollabInvite({ post }: { post: FeedPost }) {
  const { colors, spacing, radius } = useTheme();
  const { profile } = useAuth();
  const respond = useRespondCollab();
  const toast = useToast();
  const invited = post.collaborators.some(
    (c) => c.user_id === profile?.id && c.status === 'pending',
  );
  if (!invited) return null;
  return (
    <View
      style={{
        margin: spacing.md,
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      <Text>
        <Text variant="bodyBold">{post.author.username}</Text> invited you to collaborate on this
        post. If you accept, it will be shared with your followers and appear on your profile.
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Accept"
          style={{ flex: 1 }}
          loading={respond.isPending}
          onPress={() =>
            respond.mutate(
              { postId: post.id, accept: true },
              { onSuccess: () => toast.show('You are now a collaborator') },
            )
          }
        />
        <Button
          title="Decline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => respond.mutate({ postId: post.id, accept: false })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { marginTop: 48 },
});
