import { useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar, Button, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { MUSIC_CLIP_MS } from '@/features/create/types';
import { FollowButton } from '@/features/follows/FollowButton';
import { CaptionText } from '@/features/posts/components/CaptionText';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import type { FollowStatus } from '@/features/profile/api';
import { useTheme } from '@/theme';

import { usePostCard, useToggleLike, type FeedPost, type FeedReason } from '../api';
import { timeAgo } from '../format';
import { PostMedia } from './PostMedia';
import { usePostSheets } from './PostSheets';

const CAPTION_PREVIEW = 120;

export type PostCardProps = {
  postId: string;
  reason?: FeedReason;
  repostedBy?: { id: string; username: string; note: string | null };
  /** Focused card in the list (videos play). */
  active?: boolean;
  /** Feed context: enables Hide / Not interested. */
  inFeed?: boolean;
  /** Post detail: caption starts expanded. */
  expanded?: boolean;
};

/**
 * Page 43/44 — one post: header (author, collaborators, music, ⋯), media (page 45), actions
 * (like · comment · repost · share · save), likes line, caption, comment previews, timestamp.
 * Reads its card from the query cache, so every list showing the post stays in sync.
 */
export const PostCard = memo(function PostCard(props: PostCardProps) {
  const card = usePostCard(props.postId);
  const sheets = usePostSheets();
  if (!card.data) return null;
  const hiddenAs = sheets.hidden[props.postId];
  if (hiddenAs) return <HiddenPanel post={card.data} reason={hiddenAs} />;
  return <PostCardBody post={card.data} {...props} />;
});

function PostCardBody({
  post,
  reason,
  repostedBy,
  active = true,
  inFeed = false,
  expanded = false,
}: PostCardProps & { post: FeedPost }) {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const sheets = usePostSheets();
  const like = useToggleLike();
  const toast = useToast();
  const [showFull, setShowFull] = useState(expanded);
  const isOwn = post.author_id === profile?.id;
  const accepted = post.collaborators.filter((c) => c.status === 'accepted');

  function setLiked(next: boolean) {
    if (post.liked === next) return;
    like.mutate(
      { post, like: next },
      { onError: () => toast.show("Couldn't like the post. Try again.") },
    );
  }

  const openComments = (focus = false) =>
    router.push({
      pathname: '/p/[id]/comments',
      params: focus ? { id: post.id, focus: '1' } : { id: post.id },
    });
  const openLikes = () => router.push({ pathname: '/p/[id]/likes', params: { id: post.id } });

  const caption = post.caption.trim();
  const long = caption.length > CAPTION_PREVIEW || caption.split('\n').length > 2;
  const shownCaption =
    showFull || !long
      ? caption
      : caption.slice(0, CAPTION_PREVIEW).split('\n').slice(0, 2).join('\n');

  return (
    <View style={{ paddingBottom: spacing.lg }}>
      {repostedBy ? (
        <Pressable
          onPress={() => openProfile(repostedBy.username)}
          style={[
            styles.repostLine,
            { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 6 },
          ]}
        >
          <Icon name="reposts" size={14} color={colors.textSecondary} />
          <Text variant="captionBold" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {repostedBy.username} reposted
            {repostedBy.note ? (
              <Text variant="caption" color="textSecondary">
                {' · '}
                {repostedBy.note}
              </Text>
            ) : null}
          </Text>
        </Pressable>
      ) : null}

      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
        <Avatar
          uri={avatarUrl(post.author.avatar_path)}
          size={32}
          onPress={() => openProfile(post.author.username)}
          accessibilityLabel={`${post.author.username}'s profile`}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
              <Text variant="bodyBold" onPress={() => openProfile(post.author.username)}>
                {post.author.username}
              </Text>
              {accepted.length > 0 ? (
                <Text variant="bodyBold">
                  {' and '}
                  {accepted.length === 1 ? (
                    <Text variant="bodyBold" onPress={() => openProfile(accepted[0].user.username)}>
                      {accepted[0].user.username}
                    </Text>
                  ) : (
                    `${accepted.length} others`
                  )}
                </Text>
              ) : null}
            </Text>
            {post.is_favorite_author && reason !== 'suggested' ? (
              <Icon name="star" size={14} color={colors.primary} accessibilityLabel="Favorite" />
            ) : null}
          </View>
          {reason === 'suggested' ? (
            <Text variant="caption" color="textSecondary">
              Suggested for you
            </Text>
          ) : post.audio ? (
            <MusicLine post={post} />
          ) : null}
        </View>
        {post.audience === 'close_friends' ? (
          <Icon name="closeFriends" size={20} color={colors.closeFriends} />
        ) : null}
        {reason === 'suggested' && !isOwn ? <SuggestedFollow post={post} /> : null}
        <Pressable
          onPress={() => sheets.openOptions(post, { reason, inFeed })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Icon name="more" size={22} />
        </Pressable>
      </View>

      <PostMedia
        media={post.media}
        tags={post.tags}
        ratio={post.aspect_ratio}
        active={active}
        onDoubleTap={() => setLiked(true)}
      />

      {/* Actions */}
      <View style={[styles.actions, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        <View style={[styles.row, { gap: spacing.lg, flex: 1 }]}>
          <View style={[styles.row, { gap: 6 }]}>
            <LikeButton liked={post.liked} onPress={() => setLiked(!post.liked)} />
            {post.like_count ? (
              <Pressable onPress={openLikes} hitSlop={6} accessibilityLabel="Likes">
                <Text variant="bodyBold">{formatCount(post.like_count)}</Text>
              </Pressable>
            ) : null}
          </View>
          {!post.comments_disabled || post.comment_count > 0 ? (
            <Pressable
              onPress={() => openComments()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Comment"
              style={[styles.row, { gap: 6 }]}
            >
              <Icon name="comment" size={24} />
              {post.comment_count > 0 ? (
                <Text variant="bodyBold">{formatCount(post.comment_count)}</Text>
              ) : null}
            </Pressable>
          ) : null}
          {post.can_repost || post.reposted ? (
            <Pressable
              onPress={() => sheets.toggleRepost(post)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={post.reposted ? 'Undo repost' : 'Repost'}
              style={[styles.row, { gap: 6 }]}
            >
              <Icon name="reposts" size={24} color={post.reposted ? colors.success : colors.icon} />
              {post.repost_count > 0 ? (
                <Text variant="bodyBold">{formatCount(post.repost_count)}</Text>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => sheets.openShare(post)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Share"
          >
            <Icon name="share" size={24} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => sheets.toggleSave(post)}
          onLongPress={() => sheets.openCollections(post)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={post.saved ? 'Remove from saved' : 'Save'}
        >
          <Icon name={post.saved ? 'bookmarkFilled' : 'bookmark'} size={24} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 4 }}>
        {post.liked_by ? (
          <Pressable onPress={openLikes} style={[styles.row, { gap: 6 }]}>
            <Avatar uri={avatarUrl(post.liked_by.avatar_path)} size={18} />
            <Text style={{ flex: 1 }}>
              Liked by <Text variant="bodyBold">{post.liked_by.username}</Text>
              {post.like_count === null || post.like_count > 1 ? (
                <>
                  {' and '}
                  <Text variant="bodyBold">others</Text>
                </>
              ) : null}
            </Text>
          </Pressable>
        ) : null}

        {caption ? (
          <Pressable
            onPress={long && !showFull ? () => setShowFull(true) : undefined}
            disabled={!long || showFull}
          >
            <CaptionText username={post.author.username} caption={shownCaption} />
            {long && !showFull ? <Text color="textSecondary">… more</Text> : null}
          </Pressable>
        ) : null}

        {post.comment_count > 0 ? (
          <Pressable onPress={() => openComments()}>
            <Text color="textSecondary">
              {post.comment_count === 1
                ? 'View 1 comment'
                : `View all ${formatCount(post.comment_count)} comments`}
            </Text>
          </Pressable>
        ) : null}
        {post.preview_comments.map((c) => (
          <Pressable key={c.id} onPress={() => openComments()}>
            <Text numberOfLines={2}>
              <Text variant="bodyBold">{c.username}</Text> {c.body}
            </Text>
          </Pressable>
        ))}

        {!post.comments_disabled ? (
          <Pressable
            onPress={() => openComments(true)}
            style={[styles.row, { gap: spacing.sm, paddingTop: 2 }]}
            accessibilityRole="button"
          >
            <Avatar uri={avatarUrl(profile?.avatar_path)} size={24} />
            <Text color="textSecondary">Add a comment…</Text>
          </Pressable>
        ) : null}

        <Text variant="caption" color="textSecondary">
          {timeAgo(post.published_at)}
          {post.edited_at ? ' · Edited' : ''}
        </Text>
      </View>
    </View>
  );
}

/** ♡ with a bounce on tap (haptic on like). */
function LikeButton({ liked, onPress }: { liked: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      onPress={() => {
        scale.set(withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 6 })));
        if (!liked) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      accessibilityState={{ selected: liked }}
    >
      <Animated.View style={style}>
        <Icon
          name={liked ? 'heartFilled' : 'heart'}
          size={24}
          color={liked ? colors.like : colors.icon}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Inline Follow on a suggested post; disappears once you follow (Instagram keeps "Following" briefly). */
function SuggestedFollow({ post }: { post: FeedPost }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<FollowStatus>(
    post.i_follow_author ? 'following' : post.requested_author ? 'requested' : 'none',
  );
  return (
    <FollowButton
      userId={post.author.id}
      username={post.author.username}
      isPrivate={post.author.is_private}
      status={status}
      onChange={(s) => {
        setStatus(s);
        if (s !== 'none') invalidateFeedsLater(qc);
      }}
    />
  );
}

// Following someone from a suggestion refreshes the feeds after the button settles.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function invalidateFeedsLater(qc: ReturnType<typeof useQueryClient>) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void qc.invalidateQueries({ queryKey: ['feed', 'chrono'] });
    void qc.invalidateQueries({ queryKey: ['feed', 'card'] });
  }, 1500);
}

/** "Post hidden" panel replacing a card after Hide / Not interested, with Undo. */
function HiddenPanel({ post, reason }: { post: FeedPost; reason: string }) {
  const { colors, spacing, radius } = useTheme();
  const sheets = usePostSheets();
  const toast = useToast();
  return (
    <View
      style={{
        margin: spacing.md,
        padding: spacing.lg,
        gap: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text variant="bodyBold">Post hidden</Text>
        <Button title="Undo" variant="text" size="sm" onPress={() => sheets.undoHide(post.id)} />
      </View>
      <Text color="textSecondary">
        {reason === 'not_interested'
          ? "We'll suggest fewer posts like this."
          : "You won't see this post in your feed anymore."}
      </Text>
      <Pressable onPress={() => toast.show('Muting accounts is coming soon')}>
        <Text>Mute {post.author.username}</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: '/report', params: { type: 'post', id: post.id } })}
      >
        <Text color="danger">Report post</Text>
      </Pressable>
    </View>
  );
}

/** ♪ Artist · Title; tap to play/pause the post's 15-second clip. */
function MusicLine({ post }: { post: FeedPost }) {
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
      style={[styles.row, { gap: 4 }]}
    >
      <Icon name={status.playing ? 'musicFilled' : 'music'} size={12} color={colors.text} />
      <Text variant="caption" numberOfLines={1}>
        {post.audio?.artist} · {post.audio?.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', height: 54 },
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  repostLine: { flexDirection: 'row', alignItems: 'center' },
});
