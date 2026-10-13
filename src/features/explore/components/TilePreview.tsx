import { Image } from 'expo-image';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Avatar, Icon, Text, useToast, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePostCard, useToggleLike } from '@/features/feed/api';
import { usePostSheets } from '@/features/feed/components/PostSheets';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { useTheme } from '@/theme';

import type { ExploreTile } from '../api';

export type PreviewAction = 'like' | 'profile' | 'share' | 'more';
type Rect = { x: number; y: number; w: number; h: number };

/**
 * Long-press preview of an Explore tile: author, the media, and Like / View profile / Share /
 * More. The finger stays down: dragging onto an action and releasing runs it; releasing
 * elsewhere closes the preview (ExploreGrid owns the gesture and hit-tests the reported rects).
 */
export function TilePreview({
  tile,
  hovered,
  onTarget,
  runRef,
}: {
  tile: ExploreTile;
  hovered: PreviewAction | null;
  onTarget: (action: PreviewAction, rect: Rect | null) => void;
  runRef: MutableRefObject<((a: PreviewAction) => void) | null>;
}) {
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const card = usePostCard(tile.id);
  const like = useToggleLike();
  const sheets = usePostSheets();
  const toast = useToast();
  const post = card.data;
  const cardWidth = Math.min(width - spacing.xl * 2, 420);
  const first = post?.media[0];
  const imageUri =
    tile.coverUrl ?? (first ? (first.type === 'video' ? first.thumbUrl : first.url) : null);
  const ratio = tile.kind === 'reel' ? 9 / 16 : post ? post.aspect_ratio : 1;

  useEffect(() => {
    runRef.current = (action) => {
      if (!post) return;
      if (action === 'like') {
        like.mutate(
          { post, like: !post.liked },
          { onError: () => toast.show("Couldn't like the post. Try again.") },
        );
      } else if (action === 'profile') openProfile(post.author.username);
      else if (action === 'share') sheets.openShare(post);
      else sheets.openOptions(post, { reason: post.i_follow_author ? 'following' : 'suggested' });
    };
    return () => {
      runRef.current = null;
    };
  }, [post, like, sheets, toast, runRef]);

  const actions: { key: PreviewAction; icon: IconName; label: string }[] = [
    {
      key: 'like',
      icon: post?.liked ? 'heartFilled' : 'heart',
      label: post?.liked ? 'Unlike' : 'Like',
    },
    { key: 'profile', icon: 'profile', label: 'View profile' },
    { key: 'share', icon: 'share', label: 'Share' },
    ...(post && post.author_id !== profile?.id
      ? [{ key: 'more' as const, icon: 'more' as IconName, label: 'More' }]
      : []),
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.mediaScrim }]}
    >
      <Animated.View
        entering={ZoomIn.duration(160)}
        style={{
          width: cardWidth,
          borderRadius: radius.lg,
          overflow: 'hidden',
          backgroundColor: colors.background,
        }}
      >
        <View style={[styles.row, { padding: spacing.md, gap: spacing.sm }]}>
          <Avatar uri={avatarUrl(post?.author.avatar_path)} size={32} />
          <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
            {post?.author.username ?? ''}
          </Text>
        </View>
        <View
          style={{
            width: cardWidth,
            height: Math.min(cardWidth / Math.max(ratio, 0.5), cardWidth * 1.4),
            backgroundColor: colors.skeleton,
          }}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <ActivityIndicator style={StyleSheet.absoluteFill} />
          )}
        </View>
        <View style={[styles.row, { justifyContent: 'space-around', paddingVertical: spacing.md }]}>
          {actions.map((a) => (
            <Target key={a.key} action={a.key} onTarget={onTarget}>
              <View
                style={[
                  styles.action,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: hovered === a.key ? colors.backgroundSecondary : 'transparent',
                  },
                ]}
              >
                <Icon
                  name={a.icon}
                  size={26}
                  color={a.key === 'like' && post?.liked ? colors.like : colors.icon}
                />
              </View>
              {hovered === a.key ? (
                <Text variant="caption" style={styles.label}>
                  {a.label}
                </Text>
              ) : null}
            </Target>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** Reports its on-screen rect so the grid's gesture can hit-test the finger position. */
function Target({
  action,
  onTarget,
  children,
}: {
  action: PreviewAction;
  onTarget: (action: PreviewAction, rect: Rect | null) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  useEffect(() => () => onTarget(action, null), [action, onTarget]);
  return (
    <View
      ref={ref}
      style={{ alignItems: 'center' }}
      onLayout={() =>
        ref.current?.measureInWindow((x, y, w, h) => onTarget(action, { x, y, w, h }))
      }
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  action: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', top: 50, width: 90, textAlign: 'center' },
});
