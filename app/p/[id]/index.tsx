import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, Avatar, BottomSheet, Button, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { MUSIC_CLIP_MS } from '@/features/create/types';
import {
  useDeletePost,
  usePost,
  useRemoveMyTag,
  useRespondCollab,
  useUpdatePostFlags,
  type PostDetail,
} from '@/features/posts/api';
import { CaptionText } from '@/features/posts/components/CaptionText';
import { MediaCarousel } from '@/features/posts/components/MediaCarousel';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { openProfile } from '@/features/profile/format';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * STUB of page 44 (Phase 4 builds the real post detail with likes and comments). Phase 3 needs it
 * so grid tiles open something: media + tags, music, caption, and the own-post ⋯ menu
 * (Edit · Archive · Pin · Hide like count · Turn off commenting · Delete).
 */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const post = usePost(id);
  const [menu, setMenu] = useState(false);

  if (post.isPending) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (!post.data) {
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

  const p = post.data;
  const isOwn = p.author_id === profile?.id;
  const accepted = p.collaborators.filter((c) => c.status === 'accepted');
  const myInvite = p.collaborators.find((c) => c.user_id === profile?.id && c.status === 'pending');
  const published = p.published_at ? new Date(p.published_at) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={p.archived_at ? 'Archived post' : 'Post'}
        center
        right={<TopBarButton icon="more" label="More options" onPress={() => setMenu(true)} />}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {myInvite ? <CollabInvite post={p} /> : null}
        <View style={[styles.header, { gap: spacing.sm, padding: spacing.md }]}>
          <Avatar
            uri={avatarUrl(p.author?.avatar_path)}
            size={32}
            onPress={() => p.author && openProfile(p.author.username)}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" numberOfLines={1}>
              {p.author?.username}
              {accepted.length > 0 ? (
                <Text variant="bodyBold">
                  {' and '}
                  {accepted.length === 1 ? accepted[0].user?.username : `${accepted.length} others`}
                </Text>
              ) : null}
            </Text>
            {p.audio ? <MusicLine post={p} /> : null}
          </View>
          {p.audience === 'close_friends' ? (
            <Icon name="closeFriends" size={20} color={colors.closeFriends} />
          ) : null}
          {p.pinned_at ? <Icon name="pin" size={18} /> : null}
        </View>

        <MediaCarousel media={p.media} tags={p.tags} ratio={Number(p.aspect_ratio)} />

        <View style={{ padding: spacing.md, gap: spacing.xs }}>
          {p.caption && p.author ? (
            <CaptionText username={p.author.username} caption={p.caption} />
          ) : null}
          <Text variant="caption" color="textSecondary">
            {published?.toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            {p.edited_at ? ' · Edited' : ''}
            {p.comments_disabled ? ' · Commenting off' : ''}
          </Text>
          <Text variant="caption" color="textTertiary">
            Likes and comments arrive with the Home feed (Phase 4).
          </Text>
        </View>
      </ScrollView>

      <PostMenu
        post={p}
        isOwn={isOwn}
        tagged={p.tags.some((t) => t.user?.id === profile?.id)}
        visible={menu}
        onClose={() => setMenu(false)}
      />
    </SafeAreaView>
  );
}

/** ♪ Artist · Title; tap to play/pause the post's 15-second clip. */
function MusicLine({ post }: { post: PostDetail }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(post.audioUrl ? { uri: post.audioUrl } : null);
  const status = useAudioPlayerStatus(player);
  const start = post.audio_start_ms / 1000;

  useEffect(() => {
    if (status.playing && status.currentTime >= start + MUSIC_CLIP_MS / 1000) {
      void player.seekTo(start);
    }
  }, [status.playing, status.currentTime, start, player]);

  return (
    <Pressable
      onPress={() => {
        if (status.playing) player.pause();
        else {
          void player.seekTo(start);
          player.play();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause music' : 'Play music'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <Icon name={status.playing ? 'musicFilled' : 'music'} size={12} color={colors.text} />
      <Text variant="caption" numberOfLines={1}>
        {post.audio?.artist} · {post.audio?.title}
      </Text>
    </Pressable>
  );
}

function CollabInvite({ post }: { post: PostDetail }) {
  const { colors, spacing, radius } = useTheme();
  const respond = useRespondCollab();
  const toast = useToast();
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
        <Text variant="bodyBold">{post.author?.username}</Text> invited you to collaborate on this
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

function PostMenu({
  post,
  isOwn,
  tagged,
  visible,
  onClose,
}: {
  post: PostDetail;
  isOwn: boolean;
  tagged: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const flags = useUpdatePostFlags(post.id);
  const remove = useDeletePost();
  const untag = useRemoveMyTag(post.id, profile?.id);

  const run = (change: Parameters<typeof flags.mutate>[0], message: string) => {
    onClose();
    flags.mutate(change, {
      onSuccess: () => toast.show(message),
      onError: (e) =>
        toast.show(
          e.message === 'pin_limit' ? 'You can pin up to 3 posts.' : "Couldn't update the post.",
        ),
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {isOwn ? (
        <>
          <ActionRow
            icon="edit"
            label="Edit"
            onPress={() => {
              onClose();
              router.push({ pathname: '/p/[id]/edit', params: { id: post.id } });
            }}
          />
          {post.archived_at ? (
            <ActionRow
              icon="unarchive"
              label="Show on profile"
              onPress={() => run({ archived_at: null }, 'Post shown on your profile')}
            />
          ) : (
            <>
              <ActionRow
                icon="archive"
                label="Archive"
                onPress={() => run({ archived_at: new Date().toISOString() }, 'Post archived')}
              />
              <ActionRow
                icon={post.pinned_at ? 'pinOff' : 'pin'}
                label={post.pinned_at ? 'Unpin from profile' : 'Pin to your profile'}
                onPress={() =>
                  run(
                    { pinned_at: post.pinned_at ? null : new Date().toISOString() },
                    post.pinned_at ? 'Post unpinned' : 'Post pinned to your profile',
                  )
                }
              />
            </>
          )}
          <ActionRow
            icon="heartOff"
            label={post.hide_like_counts ? 'Unhide like count' : 'Hide like count'}
            onPress={() =>
              run(
                { hide_like_counts: !post.hide_like_counts },
                post.hide_like_counts ? 'Like count visible' : 'Like count hidden',
              )
            }
          />
          <ActionRow
            icon="commentOff"
            label={post.comments_disabled ? 'Turn on commenting' : 'Turn off commenting'}
            onPress={() =>
              run(
                { comments_disabled: !post.comments_disabled },
                post.comments_disabled ? 'Commenting turned on' : 'Commenting turned off',
              )
            }
          />
          <ActionRow
            icon="trash"
            label="Delete"
            destructive
            onPress={() => {
              onClose();
              showDialog('Delete post?', "You won't be able to restore it.", [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    remove.mutate(post, {
                      onSuccess: () => {
                        toast.show('Post deleted');
                        goBack();
                      },
                      onError: () => toast.show("Couldn't delete the post."),
                    }),
                },
              ]);
            }}
          />
        </>
      ) : (
        <>
          {tagged ? (
            <ActionRow
              icon="tagPerson"
              label="Remove me from post"
              onPress={() => {
                onClose();
                untag.mutate(undefined, { onSuccess: () => toast.show('Tag removed') });
              }}
            />
          ) : null}
          <ActionRow
            icon="info"
            label="About this account"
            onPress={() => {
              onClose();
              if (post.author) {
                router.push({
                  pathname: '/[username]/about',
                  params: { username: post.author.username },
                });
              }
            }}
          />
          <ActionRow
            icon="report"
            label="Report"
            destructive
            onPress={() => {
              onClose();
              toast.show('Reporting arrives in Phase 4');
            }}
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center' },
});
