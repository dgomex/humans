import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar, BottomSheet, Icon, Text, UserRow, useToast, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { openHashtag } from '@/features/explore/format';
import { usePostCard, useToggleLike, type FeedPost } from '@/features/feed/api';
import { usePostSheets } from '@/features/feed/components/PostSheets';
import { FollowButton } from '@/features/follows/FollowButton';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import type { FollowStatus } from '@/features/profile/api';
import { useTheme } from '@/theme';

import { recordPlay, useReelSource } from '../api';
import { setReelsMuted, useReelsMuted, useReelsRate } from '../format';
import { ReelPlayer } from './ReelPlayer';

/** A play counts after the reel has been on screen this long. */
const PLAY_AFTER_MS = 1200;
const EDGE = 0.2;
const CAPTION_LINES = 2;
// Captions use Instagram's white-on-video style; mentions / hashtags are bold.
const TOKEN = /(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]+)/iu;

export type ReelViewProps = {
  postId: string;
  width: number;
  height: number;
  /** Focused page of the pager (plays). */
  active: boolean;
  /** Neighbours mount their player paused so swiping shows the first frame at once. */
  mounted?: boolean;
  /** Space taken by the tab bar / home indicator under the reel. */
  bottomInset?: number;
  /** Open comments / likes keeps the reel playing (they are routes over it). */
  onOverlayRoute?: () => void;
};

/**
 * Page 58 / 64 — one full-screen reel: the player, the right rail (♡ · 💬 · ⟳ · ✈ · ⋯ · audio),
 * author + Follow, caption, tags / remix / audio chips, "Watch next part", and the scrubber.
 * Tap = sound on/off, double-tap = like, hold = pause (UI hides), hold an edge = 2×.
 */
export const ReelView = memo(function ReelView(props: ReelViewProps) {
  const card = usePostCard(props.postId);
  const sheets = usePostSheets();
  const { colors, spacing } = useTheme();
  if (!card.data) {
    return (
      <View
        style={{
          width: props.width,
          height: props.height,
          backgroundColor: colors.mediaBackground,
        }}
      />
    );
  }
  if (sheets.hidden[props.postId]) {
    return (
      <View
        style={[
          styles.hidden,
          {
            width: props.width,
            height: props.height,
            backgroundColor: colors.mediaBackground,
            gap: spacing.md,
          },
        ]}
      >
        <Icon name="hide" size={40} color={colors.onMedia} />
        <Text variant="headline" style={{ color: colors.onMedia }}>
          Reel hidden
        </Text>
        <Text style={{ color: colors.onMedia, opacity: 0.8, textAlign: 'center' }}>
          We&apos;ll show you fewer reels like this.
        </Text>
        <Pressable onPress={() => sheets.undoHide(props.postId)} accessibilityRole="button">
          <Text variant="bodyBold" color="primary">
            Undo
          </Text>
        </Pressable>
      </View>
    );
  }
  return <ReelBody post={card.data} {...props} />;
});

function ReelBody({
  post,
  width,
  height,
  active,
  mounted = true,
  bottomInset = 0,
  onOverlayRoute,
}: ReelViewProps & { post: FeedPost }) {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const sheets = usePostSheets();
  const like = useToggleLike();
  const source = useReelSource(post);
  const muted = useReelsMuted();
  const rate = useReelsRate();
  const [held, setHeld] = useState(false);
  const [fast, setFast] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [seek, setSeek] = useState<{ ms: number; key: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const progress = useSharedValue(0);
  const heart = useSharedValue(0);
  const speaker = useSharedValue(0);
  const isOwn = post.author_id === profile?.id;

  // Count a play once the reel has been watched for a moment.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => recordPlay(post.id), PLAY_AFTER_MS);
    return () => clearTimeout(t);
  }, [active, post.id]);

  // Leaving a reel resets its expanded caption, like Instagram.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setExpanded(false);
  }

  function setLiked(next: boolean) {
    if (post.liked === next) return;
    like.mutate({ post, like: next }, { onError: () => toast.show("Couldn't like the reel.") });
  }

  function toggleMute() {
    setReelsMuted(!muted);
    speaker.set(withSequence(withTiming(1, { duration: 120 }), withDelay(600, withTiming(0))));
  }

  function doubleTapLike() {
    heart.set(
      withSequence(
        withSpring(1, { damping: 8, stiffness: 220 }),
        withDelay(450, withTiming(0, { duration: 200 })),
      ),
    );
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(true);
  }

  function startHold(x: number) {
    if (x < width * EDGE || x > width * (1 - EDGE)) setFast(true);
    else setHeld(true);
  }
  function endHold() {
    setHeld(false);
    setFast(false);
  }

  const single = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(toggleMute);
  });
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(doubleTapLike);
    });
  const hold = Gesture.LongPress()
    .minDuration(250)
    .onStart((e) => scheduleOnRN(startHold, e.x))
    .onFinalize(() => scheduleOnRN(endHold));
  const gesture = Gesture.Race(hold, Gesture.Exclusive(double, single));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.get() > 0.01 ? 1 : 0,
    transform: [{ scale: 0.4 + heart.get() * 0.6 }],
  }));
  const speakerStyle = useAnimatedStyle(() => ({ opacity: speaker.get() }));

  const accepted = post.collaborators.filter((c) => c.status === 'accepted');
  const tagged = post.tags;
  const caption = post.caption.trim();
  const uiHidden = held || scrubbing;
  const bottom = bottomInset + spacing.md;

  const openComments = () => {
    onOverlayRoute?.();
    router.push({ pathname: '/p/[id]/comments', params: { id: post.id } });
  };
  const openLikes = () => {
    onOverlayRoute?.();
    router.push({ pathname: '/p/[id]/likes', params: { id: post.id } });
  };
  const openAudio = () => {
    if (post.audio) router.push({ pathname: '/audio/[id]', params: { id: post.audio.id } });
  };

  return (
    <View style={{ width, height, backgroundColor: colors.mediaBackground }}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          {source && mounted ? (
            <ReelPlayer
              source={source}
              width={width}
              height={height}
              active={active}
              paused={held || scrubbing}
              muted={muted}
              rate={fast ? 2 : rate}
              seek={seek}
              progress={progress}
              stickerActions={{
                onMention: (u) => openProfile(u),
                onHashtag: (tag) => openHashtag(tag),
                onLink: () => toast.show('Links open in the browser in a later update'),
              }}
            />
          ) : (
            <Image
              source={{ uri: post.coverUrl ?? post.media[0]?.thumbUrl ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
        </View>
      </GestureDetector>

      {/* Double-tap heart, mute flash, 2× pill */}
      <Animated.View
        pointerEvents="none"
        style={[styles.center, { top: height / 2 - 60 }, heartStyle]}
      >
        <Icon name="heartFilled" size={110} color={colors.onMedia} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.center, { top: height / 2 - 32 }, speakerStyle]}
      >
        <View style={[styles.speaker, { backgroundColor: colors.mediaScrim }]}>
          <Icon name={muted ? 'volumeOff' : 'volumeOn'} size={30} color={colors.onMedia} />
        </View>
      </Animated.View>
      {fast ? (
        <View pointerEvents="none" style={[styles.center, { top: spacing.xxl * 2 }]}>
          <View style={[styles.pill, { backgroundColor: colors.mediaScrim }]}>
            <Text variant="captionBold" style={{ color: colors.onMedia }}>
              2× ▸▸
            </Text>
          </View>
        </View>
      ) : null}

      {!uiHidden ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={[styles.shade, { height: height * 0.4 }]}
          />

          {/* Right rail */}
          <View style={[styles.rail, { bottom: bottom + 12, right: spacing.sm, gap: spacing.lg }]}>
            <RailButton
              icon={post.liked ? 'heartFilled' : 'heart'}
              color={post.liked ? colors.like : colors.onMedia}
              label={post.liked ? 'Unlike' : 'Like'}
              count={post.like_count}
              onPress={() => setLiked(!post.liked)}
              onCountPress={openLikes}
            />
            {!post.comments_disabled || post.comment_count > 0 ? (
              <RailButton
                icon="comment"
                label="Comment"
                count={post.comment_count}
                onPress={openComments}
              />
            ) : null}
            {post.can_repost || post.reposted ? (
              <RailButton
                icon="reposts"
                color={post.reposted ? colors.success : colors.onMedia}
                label={post.reposted ? 'Undo repost' : 'Repost'}
                count={post.repost_count}
                onPress={() => sheets.toggleRepost(post)}
              />
            ) : null}
            <RailButton icon="share" label="Share" onPress={() => sheets.openShare(post)} />
            <RailButton
              icon="more"
              label="More options"
              onPress={() => sheets.openOptions(post, { inFeed: true })}
            />
            <AudioDisc post={post} spinning={active && !held} onPress={openAudio} />
          </View>

          {/* Bottom-left: author, caption, chips */}
          <View
            style={[
              styles.info,
              { bottom: bottom + 8, left: spacing.md, right: 72, gap: spacing.sm },
            ]}
          >
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Avatar
                uri={avatarUrl(post.author.avatar_path)}
                size={32}
                onPress={() => openProfile(post.author.username)}
                accessibilityLabel={`${post.author.username}'s profile`}
              />
              <RNText
                numberOfLines={1}
                style={[styles.username, { color: colors.onMedia, flexShrink: 1 }]}
                onPress={() => openProfile(post.author.username)}
              >
                {post.author.username}
                {accepted.length > 0
                  ? ` and ${accepted.length === 1 ? accepted[0].user.username : `${accepted.length} others`}`
                  : ''}
              </RNText>
              {post.audience === 'close_friends' ? (
                <Icon name="closeFriends" size={18} color={colors.closeFriends} />
              ) : null}
              {!isOwn && !post.i_follow_author ? <FollowPill post={post} /> : null}
            </View>

            {caption ? (
              <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button">
                <RNText
                  numberOfLines={expanded ? undefined : CAPTION_LINES}
                  style={[styles.caption, { color: colors.onMedia }]}
                >
                  {caption.split(TOKEN).map((part, i) =>
                    i % 2 === 0 ? (
                      part
                    ) : (
                      <RNText
                        key={i}
                        style={styles.bold}
                        onPress={() =>
                          part.startsWith('@')
                            ? openProfile(part.slice(1).toLowerCase())
                            : openHashtag(part.slice(1))
                        }
                      >
                        {part}
                      </RNText>
                    ),
                  )}
                </RNText>
              </Pressable>
            ) : null}

            {post.liked_by ? (
              <Pressable onPress={openLikes} style={[styles.row, { gap: 6 }]}>
                <Avatar uri={avatarUrl(post.liked_by.avatar_path)} size={16} />
                <RNText style={[styles.small, { color: colors.onMedia }]} numberOfLines={1}>
                  Liked by <RNText style={styles.bold}>{post.liked_by.username}</RNText>
                  {post.like_count === null || post.like_count > 1 ? ' and others' : ''}
                </RNText>
              </Pressable>
            ) : null}

            <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
              <Chip icon="music" onPress={openAudio}>
                {post.audio
                  ? `${post.audio.artist} · ${post.audio.title}`
                  : `${post.author.username} · Original audio`}
              </Chip>
              {tagged.length > 0 ? (
                <Chip icon="tagPerson" onPress={() => setTagsOpen(true)}>
                  {tagged.length === 1 ? tagged[0].user.username : `${tagged.length} people`}
                </Chip>
              ) : null}
              {post.remix ? (
                <Chip
                  icon="remix"
                  onPress={() =>
                    post.remix?.post_id
                      ? router.push({ pathname: '/reel/[id]', params: { id: post.remix.post_id } })
                      : toast.show('The original reel is unavailable')
                  }
                >
                  {post.remix.username ? `Remix with ${post.remix.username}` : 'Remix'}
                </Chip>
              ) : null}
            </View>

            {post.linked_reel_id ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/reel/[id]', params: { id: post.linked_reel_id! } })
                }
                accessibilityRole="button"
                style={[styles.linked, { backgroundColor: colors.mediaScrim, gap: 6 }]}
              >
                <Icon name="play" size={14} color={colors.onMedia} />
                <Text variant="captionBold" style={{ color: colors.onMedia }}>
                  Watch next part
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <Scrubber
        progress={progress}
        width={width}
        bottom={bottomInset}
        total={source?.total ?? 0}
        onScrub={setScrubbing}
        onSeek={(ms) => setSeek((s) => ({ ms, key: (s?.key ?? 0) + 1 }))}
      />

      <BottomSheet visible={tagsOpen} onClose={() => setTagsOpen(false)} title="In this reel">
        {tagged.map((t) => (
          <UserRow
            key={t.id}
            username={t.user.username}
            onPress={() => {
              setTagsOpen(false);
              openProfile(t.user.username);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

function RailButton({
  icon,
  label,
  count,
  color,
  onPress,
  onCountPress,
}: {
  icon: IconName;
  label: string;
  count?: number | null;
  color?: string;
  onPress: () => void;
  onCountPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.railItem}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name={icon} size={28} color={color ?? colors.onMedia} />
      </Pressable>
      {count ? (
        <Pressable
          onPress={onCountPress ?? onPress}
          hitSlop={6}
          disabled={!onCountPress && !onPress}
        >
          <Text variant="captionBold" style={{ color: colors.onMedia }}>
            {formatCount(count)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Square audio thumbnail (spins while playing) → audio page. */
function AudioDisc({
  post,
  spinning,
  onPress,
}: {
  post: FeedPost;
  spinning: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      turn.set(
        withRepeat(withTiming(turn.get() + 360, { duration: 6000, easing: Easing.linear }), -1),
      );
    } else {
      cancelAnimation(turn);
    }
  }, [spinning, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  const owner = post.audio?.owner ?? (post.audio ? null : post.author);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Audio">
      <Animated.View
        style={[
          styles.disc,
          {
            borderColor: colors.onMedia,
            backgroundColor: post.audio?.cover_color ?? colors.mediaScrim,
          },
          style,
        ]}
      >
        {owner ? (
          <Avatar uri={avatarUrl(owner.avatar_path)} size={26} />
        ) : (
          <Icon name="musicFilled" size={16} color={colors.onMedia} />
        )}
      </Animated.View>
    </Pressable>
  );
}

function Chip({
  icon,
  children,
  onPress,
}: {
  icon: IconName;
  children: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, { backgroundColor: colors.mediaScrim }]}
    >
      <Icon name={icon} size={13} color={colors.onMedia} />
      <RNText numberOfLines={1} style={[styles.small, { color: colors.onMedia, maxWidth: 190 }]}>
        {children}
      </RNText>
    </Pressable>
  );
}

/** Outlined "Follow" next to the username; disappears once you follow. */
function FollowPill({ post }: { post: FeedPost }) {
  const [status, setStatus] = useState<FollowStatus>(post.requested_author ? 'requested' : 'none');
  if (status === 'following') return null;
  return (
    <FollowButton
      userId={post.author.id}
      username={post.author.username}
      isPrivate={post.author.is_private}
      status={status}
      onChange={setStatus}
      size="sm"
    />
  );
}

/** Bottom progress line; drag it to seek (the reel pauses while scrubbing). */
function Scrubber({
  progress,
  width,
  bottom,
  total,
  onScrub,
  onSeek,
}: {
  progress: ReturnType<typeof useSharedValue<number>>;
  width: number;
  bottom: number;
  total: number;
  onScrub: (on: boolean) => void;
  onSeek: (ms: number) => void;
}) {
  const { colors } = useTheme();
  const drag = useSharedValue(-1);
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onStart((e) => {
      drag.set(Math.min(1, Math.max(0, e.x / width)));
      scheduleOnRN(onScrub, true);
    })
    .onUpdate((e) => {
      drag.set(Math.min(1, Math.max(0, e.x / width)));
    })
    .onFinalize(() => {
      if (drag.get() >= 0) scheduleOnRN(onSeek, drag.get() * total);
      drag.set(-1);
      scheduleOnRN(onScrub, false);
    });
  const fill = useAnimatedStyle(() => ({
    width: `${(drag.get() >= 0 ? drag.get() : progress.get()) * 100}%`,
    height: drag.get() >= 0 ? 4 : 2,
  }));
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.scrubZone, { bottom, width }]} accessibilityLabel="Seek">
        <View style={[styles.track, { backgroundColor: colors.mediaGrid }]}>
          <Animated.View style={[{ backgroundColor: colors.onMedia }, fill]} />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hidden: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  speaker: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  rail: { position: 'absolute', alignItems: 'center' },
  railItem: { alignItems: 'center', gap: 4, minWidth: 44 },
  info: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center' },
  username: { fontSize: 14, fontWeight: '700' },
  caption: { fontSize: 14, lineHeight: 19 },
  small: { fontSize: 13 },
  bold: { fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  linked: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  disc: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scrubZone: { position: 'absolute', left: 0, height: 20, justifyContent: 'flex-end' },
  track: { height: 2, width: '100%', justifyContent: 'center' },
});
