import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Icon, Text, type AvatarRing } from '@/components';
import { shortAge } from '@/features/feed/format';
import { FollowButton } from '@/features/follows/FollowButton';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { BUCKETS } from '@/lib/storage';
import { useMediaUrl } from '@/lib/useMediaUrl';
import { useTheme } from '@/theme';

import type { ActivityGroup } from '../api';
import { actionText, openGroup, othersSuffix } from '../format';

const AVATAR = 44;
const THUMB = 44;

export function NotificationRow({
  group,
  ring = 'none',
  onLongPress,
  onFollowChange,
  onLikeComment,
  onAnswerCollab,
}: {
  group: ActivityGroup;
  ring?: AvatarRing;
  onLongPress: () => void;
  onFollowChange: (status: 'none' | 'following' | 'requested') => void;
  onLikeComment: (like: boolean) => void;
  onAnswerCollab: (accept: boolean) => void;
}) {
  const { colors, spacing } = useTheme();
  const [first, second] = group.actors;
  const others = othersSuffix(group);
  const isComment =
    group.type === 'comment' || group.type === 'comment_reply' || group.type === 'comment_mention';
  const text = actionText(group.type, {
    kind: group.post?.kind,
    comment: group.comment?.body,
    title: group.data?.title,
    prompt: group.data?.prompt,
    audio: group.audio?.title,
  });

  function openActor() {
    if (!first) return;
    if (ring !== 'none') {
      router.push({ pathname: '/stories/[userId]', params: { userId: first.id } });
    } else {
      openProfile(first.username);
    }
  }

  const follow = group.actor_follow;
  const followStatus = follow?.i_follow ? 'following' : follow?.requested ? 'requested' : 'none';

  let trailing: React.ReactNode = null;
  if ((group.type === 'follow' && group.actor_count === 1) || group.type === 'follow_accepted') {
    trailing = first ? (
      <FollowButton
        userId={first.id}
        username={first.username}
        isPrivate={follow?.is_private}
        followsMe={group.type === 'follow'}
        status={followStatus}
        onChange={onFollowChange}
      />
    ) : null;
  } else if (group.post) {
    trailing = <PostThumb group={group} />;
  } else if (group.story) {
    trailing = <StoryThumb group={group} />;
  }

  return (
    <Pressable
      onPress={() => openGroup(group)}
      onLongPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onLongPress();
      }}
      delayLongPress={350}
      // No button role: the row holds its own buttons (avatar, Follow, Reply…), and web forbids
      // nested <button>s.
      accessibilityHint="Long press for options"
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.md,
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
        },
      ]}
    >
      {second && group.actor_count > 1 ? (
        <Pressable onPress={openActor} style={{ width: AVATAR, height: AVATAR }}>
          <View style={styles.backAvatar}>
            <Avatar uri={avatarUrl(second.avatar_path)} size={32} />
          </View>
          <View
            style={[
              styles.frontAvatar,
              { borderColor: colors.background, borderRadius: 18, borderWidth: 2 },
            ]}
          >
            <Avatar uri={avatarUrl(first?.avatar_path)} size={32} />
          </View>
        </Pressable>
      ) : (
        <Avatar
          uri={avatarUrl(first?.avatar_path)}
          size={AVATAR}
          ring={ring}
          onPress={openActor}
          accessibilityLabel={first ? `Open ${first.username}` : undefined}
        />
      )}

      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text numberOfLines={isComment ? 4 : 3}>
          {first ? (
            <Text variant="bodyBold" onPress={() => openProfile(first.username)}>
              {first.username}
            </Text>
          ) : null}
          {second && group.actor_count > 1 ? (
            <>
              <Text>{others > 0 ? ', ' : ' and '}</Text>
              <Text variant="bodyBold" onPress={() => openProfile(second.username)}>
                {second.username}
              </Text>
              {others > 0 ? (
                <Text>
                  {' '}
                  and {others} {others === 1 ? 'other' : 'others'}
                </Text>
              ) : null}
            </>
          ) : null}
          <Text>{text.startsWith("'") ? text : ` ${text}`}</Text>
          <Text color="textSecondary"> {shortAge(group.latest_at)}</Text>
        </Text>

        {isComment && group.comment ? (
          <View style={[styles.row, { gap: spacing.lg }]}>
            <Pressable
              hitSlop={8}
              onPress={() =>
                group.post &&
                router.push({
                  pathname: '/p/[id]/comments',
                  params: {
                    id: group.post.id,
                    replyTo: group.comment!.parent_id ?? group.comment!.id,
                    replyUser: first?.username ?? '',
                  },
                })
              }
              accessibilityRole="button"
            >
              <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                Reply
              </Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                onLikeComment(!group.comment!.liked);
              }}
              accessibilityRole="button"
              accessibilityLabel={group.comment.liked ? 'Unlike comment' : 'Like comment'}
            >
              <Icon
                name={group.comment.liked ? 'heartFilled' : 'heart'}
                size={14}
                color={group.comment.liked ? colors.like : colors.textSecondary}
              />
            </Pressable>
          </View>
        ) : null}

        {group.type === 'collab_invite' && group.collab_status === 'pending' ? (
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Button title="Accept" size="sm" onPress={() => onAnswerCollab(true)} />
            <Button
              title="Decline"
              size="sm"
              variant="secondary"
              onPress={() => onAnswerCollab(false)}
            />
          </View>
        ) : null}
        {group.type === 'collab_invite' && group.collab_status === 'accepted' ? (
          <Text variant="caption" color="textSecondary">
            You accepted. This post now appears on your profile.
          </Text>
        ) : null}
      </View>

      {trailing}
    </Pressable>
  );
}

function PostThumb({ group }: { group: ActivityGroup }) {
  const { colors } = useTheme();
  const url = useMediaUrl(BUCKETS.posts, group.post?.cover_path);
  const tall = group.post?.kind === 'reel';
  return (
    <Image
      source={url.data ? { uri: url.data } : undefined}
      style={{
        width: THUMB,
        height: tall ? THUMB * (4 / 3) : THUMB,
        borderRadius: 4,
        backgroundColor: colors.skeleton,
      }}
      contentFit="cover"
      transition={120}
      accessibilityIgnoresInvertColors
    />
  );
}

function StoryThumb({ group }: { group: ActivityGroup }) {
  const { colors } = useTheme();
  const path = group.story?.visible ? group.story.thumb_path : null;
  const url = useMediaUrl(BUCKETS.stories, path);
  return (
    <View
      style={{
        width: THUMB,
        height: THUMB * (16 / 9) * 0.75,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: path ? colors.skeleton : colors.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {url.data ? (
        <Image source={{ uri: url.data }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : !group.story?.visible ? (
        <Icon name="history" size={16} color={colors.textTertiary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  backAvatar: { position: 'absolute', top: 0, right: 0 },
  frontAvatar: { position: 'absolute', bottom: -2, left: -2 },
});
