import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components';
import { usePostCard } from '@/features/feed/api';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { BUCKETS, getSignedUrls } from '@/lib/storage';
import { useTheme } from '@/theme';

import type { Message } from '../api';
import { olderThan } from '../format';

const CARD_W = 220;

/** Shared post / reel (page 76 → 44 / 58). Respects the viewer's access: "Post unavailable". */
export function SharedPostCard({ postId }: { postId: string | null }) {
  const { colors, spacing, radius } = useTheme();
  const card = usePostCard(postId ?? undefined);
  const post = card.data;
  if (!postId || (!card.isPending && !post)) return <Unavailable label="Post unavailable" />;
  if (!post) return <CardSkeleton height={CARD_W * 1.25} />;
  const reel = post.kind === 'reel';
  const first = post.media[0];
  const cover = reel ? (post.coverUrl ?? first?.thumbUrl) : (first?.thumbUrl ?? first?.url);
  const h = reel ? CARD_W * (16 / 9) : CARD_W / Math.max(0.75, Math.min(1.91, post.aspect_ratio));
  return (
    <Pressable
      onPress={() =>
        reel
          ? router.push({ pathname: '/reel/[id]', params: { id: post.id } })
          : router.push(`/p/${post.id}`)
      }
      accessibilityRole="button"
      accessibilityLabel={`${reel ? 'Reel' : 'Post'} by ${post.author.username}`}
      style={[
        styles.card,
        { width: CARD_W, borderRadius: radius.xl, backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <View style={[styles.cardHead, { padding: spacing.sm, gap: spacing.sm }]}>
        <Avatar uri={avatarUrl(post.author.avatar_path)} size={24} />
        <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
          {post.author.username}
        </Text>
      </View>
      <View>
        <Image
          source={cover ? { uri: cover } : null}
          style={{ width: CARD_W, height: Math.min(h, 390), backgroundColor: colors.skeleton }}
          contentFit="cover"
        />
        {reel ? (
          <View style={styles.badge}>
            <Icon name="reels" size={20} color={colors.onMedia} />
          </View>
        ) : post.media.length > 1 ? (
          <View style={styles.badge}>
            <Icon name="carousel" size={18} color={colors.onMedia} />
          </View>
        ) : null}
      </View>
      {post.caption ? (
        <Text numberOfLines={2} style={{ padding: spacing.sm }}>
          <Text variant="bodyBold">{post.author.username}</Text> {post.caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Shared story (expires with the story) or the story a reply refers to. */
export function StoryPreview({
  message,
  small = false,
}: {
  message: Pick<Message, 'story' | 'storyUrl'>;
  small?: boolean;
}) {
  const { colors, radius } = useTheme();
  const s = message.story;
  if (!s) return null;
  const w = small ? 96 : 160;
  if (!s.visible || s.active === false)
    return (
      <View
        style={[
          styles.storyGone,
          {
            width: w,
            height: w * (16 / 9),
            borderRadius: radius.lg,
            borderColor: colors.separator,
          },
        ]}
      >
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          {s.visible ? 'Story expired' : 'Story unavailable'}
        </Text>
      </View>
    );
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/stories/view', params: { ids: s.id } })}
      accessibilityRole="button"
      accessibilityLabel="Open story"
    >
      {message.storyUrl ? (
        <Image
          source={{ uri: message.storyUrl }}
          style={{
            width: w,
            height: w * (16 / 9),
            borderRadius: radius.lg,
            backgroundColor: colors.skeleton,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.storyGone,
            {
              width: w,
              height: w * (16 / 9),
              borderRadius: radius.lg,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
        >
          <Icon name="story" size={28} color={colors.textSecondary} />
        </View>
      )}
    </Pressable>
  );
}

export function SharedProfileCard({ profile }: { profile: NonNullable<Message['profile']> }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={() => openProfile(profile.username)}
      accessibilityRole="button"
      accessibilityLabel={`Profile ${profile.username}`}
      style={[
        styles.profileCard,
        {
          width: CARD_W,
          borderRadius: radius.xl,
          backgroundColor: colors.backgroundSecondary,
          padding: spacing.lg,
          gap: spacing.xs,
        },
      ]}
    >
      <Avatar uri={avatarUrl(profile.avatar_path)} size={64} />
      <Text variant="bodyBold">{profile.username}</Text>
      {profile.full_name ? <Text color="textSecondary">{profile.full_name}</Text> : null}
      <Text variant="caption" color="textSecondary">
        {formatCount(profile.followers_count)}{' '}
        {profile.followers_count === 1 ? 'follower' : 'followers'} ·{' '}
        {formatCount(profile.posts_count)} {profile.posts_count === 1 ? 'post' : 'posts'}
      </Text>
      <Text variant="bodyBold" color="primary" style={{ marginTop: spacing.xs }}>
        View profile
      </Text>
    </Pressable>
  );
}

export function SharedAudioCard({ audio }: { audio: NonNullable<Message['audio']> }) {
  const { colors, spacing, radius } = useTheme();
  if (audio.unavailable) return <Unavailable label="Audio unavailable" />;
  const subtitle =
    audio.source === 'original' ? `${audio.owner_username ?? ''} · Original audio` : audio.artist;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/audio/[id]', params: { id: audio.id } })}
      accessibilityRole="button"
      style={[
        styles.audioCard,
        {
          width: CARD_W,
          borderRadius: radius.xl,
          backgroundColor: colors.backgroundSecondary,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.audioArt,
          {
            backgroundColor: audio.cover_color ?? colors.backgroundPressed,
            borderRadius: radius.md,
          },
        ]}
      >
        <Icon name="musicFilled" size={22} color={colors.onMedia} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold" numberOfLines={1}>
          {audio.title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const SPEEDS = [1, 1.5, 2] as const;

const formatDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Voice message (page 76): ▶ / ❚❚, waveform with progress, remaining time, speed toggle. */
export function VoiceBubble({
  message,
  mine,
  color,
}: {
  message: Message;
  mine: boolean;
  color: string;
}) {
  const { colors, spacing } = useTheme();
  const [url, setUrl] = useState<string | null>(message.mediaUrl);
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [loading, setLoading] = useState(false);
  const total = message.duration_ms ?? 0;
  const progress = total > 0 ? Math.min(1, (status.currentTime * 1000) / total) : 0;
  const bars = (
    message.waveform?.length ? message.waveform : Array.from({ length: 28 }, () => 0.4)
  ).slice(0, 40);
  const fg = mine ? colors.onPrimary : colors.text;

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  async function toggle() {
    if (!url) {
      if (!message.media_path) return;
      setLoading(true);
      const urls = await getSignedUrls(BUCKETS.messages, [message.media_path]).catch(
        () => ({}) as Record<string, string>,
      );
      setLoading(false);
      setUrl(urls[message.media_path] ?? null);
      return;
    }
    if (status.playing) player.pause();
    else {
      player.setPlaybackRate(speed);
      player.play();
    }
  }

  return (
    <View
      style={[
        styles.voice,
        {
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: color,
        },
      ]}
    >
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Play voice message'}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Icon name={status.playing ? 'pause' : 'play'} size={22} color={fg} />
        )}
      </Pressable>
      <View style={styles.wave}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={{
              width: 2.5,
              borderRadius: 2,
              height: 4 + Math.max(0, Math.min(1, b)) * 22,
              backgroundColor: fg,
              opacity: i / bars.length <= progress ? 1 : 0.45,
            }}
          />
        ))}
      </View>
      <Text variant="caption" style={{ color: fg, minWidth: 32 }}>
        {formatDuration(status.playing || progress > 0 ? total - status.currentTime * 1000 : total)}
      </Text>
      <Pressable
        onPress={() => {
          const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
          setSpeed(next);
          player.setPlaybackRate(next);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${speed}x`}
      >
        <Text variant="captionBold" style={{ color: fg }}>
          {speed}×
        </Text>
      </Pressable>
    </View>
  );
}

/** View-once / replay media pill (page 80). */
export function EphemeralBubble({
  message,
  mine,
  me,
  color,
  onOpen,
}: {
  message: Message;
  mine: boolean;
  me: string;
  color: string;
  onOpen: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const limit = message.view_mode === 'replay' ? 2 : 1;
  const views = message.views ?? [];
  const myViews = views.find((v) => v.user_id === me)?.view_count ?? 0;
  const expired = olderThan(message.created_at, 14 * 86400000);
  const word = message.media_type === 'video' ? 'Video' : 'Photo';
  let label: string;
  let canOpen = false;
  if (mine) {
    const shot = views.some((v) => v.screenshot_at);
    label = shot
      ? 'Screenshot'
      : views.length > 0
        ? views.some((v) => v.view_count > 1)
          ? 'Replayed'
          : 'Opened'
        : 'Delivered';
  } else if (expired) {
    label = 'Expired';
  } else if (myViews >= limit) {
    label = 'Opened';
  } else if (myViews === 1) {
    label = 'Tap to replay';
    canOpen = true;
  } else {
    label = 'Tap to view';
    canOpen = true;
  }
  const fg = mine ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={canOpen ? onOpen : undefined}
      disabled={!canOpen}
      accessibilityRole="button"
      accessibilityLabel={`${word}, ${label}`}
      style={[
        styles.ephemeral,
        {
          backgroundColor: color,
          borderRadius: radius.xl,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
      ]}
    >
      <Icon name={message.view_mode === 'replay' ? 'replay' : 'viewOnce'} size={20} color={fg} />
      <View>
        <Text variant="bodyBold" style={{ color: fg }}>
          {word}
        </Text>
        <Text variant="caption" style={{ color: fg, opacity: 0.8 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function Unavailable({ label }: { label: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={[
        styles.unavailable,
        {
          borderRadius: radius.xl,
          borderColor: colors.separator,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Icon name="alert" size={18} color={colors.textSecondary} />
      <Text color="textSecondary">{label}</Text>
    </View>
  );
}

function CardSkeleton({ height }: { height: number }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{ width: CARD_W, height, borderRadius: radius.xl, backgroundColor: colors.skeleton }}
    />
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  badge: { position: 'absolute', top: 8, right: 8 },
  storyGone: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
  },
  profileCard: { alignItems: 'center' },
  audioCard: { flexDirection: 'row', alignItems: 'center' },
  audioArt: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  voice: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, minWidth: 200 },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  ephemeral: { flexDirection: 'row', alignItems: 'center' },
  unavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
