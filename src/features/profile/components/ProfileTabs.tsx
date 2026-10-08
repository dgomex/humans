import { router } from 'expo-router';
import { useEffect, type ReactNode, type RefObject } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Button, Icon, Text, type IconName } from '@/components';
import { useUploadQueue } from '@/features/create/UploadQueue';
import { useProfilePosts, type GridPost } from '@/features/posts/api';
import { useTheme } from '@/theme';

export type ProfileTabKey = 'grid' | 'reels' | 'reposts' | 'tagged';

const TABS: { key: ProfileTabKey; icon: IconName; label: string }[] = [
  { key: 'grid', icon: 'grid', label: 'Posts' },
  { key: 'reels', icon: 'reels', label: 'Reels' },
  { key: 'reposts', icon: 'reposts', label: 'Reposts' },
  { key: 'tagged', icon: 'tagged', label: 'Tagged' },
];

/** Sticky icon tab bar (Grid · Reels · Reposts · Tagged) with the active underline. */
export function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTabKey;
  onChange: (tab: ProfileTabKey) => void;
}) {
  const { colors, hairline } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.separator,
          borderBottomWidth: hairline,
        },
      ]}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={[
              styles.tab,
              { borderBottomColor: on ? colors.text : 'transparent', borderBottomWidth: 1.5 },
            ]}
          >
            <Icon name={t.icon} size={24} color={on ? colors.icon : colors.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

export const PROFILE_TABS = TABS.map((t) => t.key);

/**
 * Tab pages, swipeable horizontally. The parent owns `pagerRef` so tab-bar taps can scroll it.
 * Grid and Tagged show posts (Phase 3); Reels and Reposts keep their empty states until Phase 6.
 * `loadMoreRef` is set to the active tab's "fetch next page" for the parent's scroll handler.
 */
export function ProfileTabPages({
  pagerRef,
  active,
  onSwipe,
  isOwn,
  userId,
  loadMoreRef,
}: {
  pagerRef: RefObject<ScrollView | null>;
  active: ProfileTabKey;
  onSwipe: (tab: ProfileTabKey) => void;
  isOwn: boolean;
  userId: string;
  loadMoreRef?: RefObject<(() => void) | null>;
}) {
  const { width } = useWindowDimensions();
  const posts = useProfilePosts(userId, 'grid');
  const tagged = useProfilePosts(userId, 'tagged', active === 'tagged');
  const { jobs } = useUploadQueue();

  const pending: GridItem[] = isOwn
    ? jobs
        .filter((j) => j.stage !== 'done')
        .map((j) => ({ id: `pending-${j.postId}`, uri: j.coverUri, pending: true }))
    : [];
  const byTab: Partial<Record<ProfileTabKey, GridItem[]>> = {
    grid: [...pending, ...(posts.data?.pages.flat() ?? []).map(toGridItem)],
    tagged: (tagged.data?.pages.flat() ?? []).map(toGridItem),
  };
  const query = active === 'grid' ? posts : active === 'tagged' ? tagged : null;
  useEffect(() => {
    if (!loadMoreRef) return;
    loadMoreRef.current = () => {
      if (query?.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    };
  }, [loadMoreRef, query]);

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const tab = TABS[Math.round(e.nativeEvent.contentOffset.x / width)]?.key;
    if (tab && tab !== active) onSwipe(tab);
  }

  return (
    <ScrollView
      ref={pagerRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumEnd}
    >
      {TABS.map((t) => {
        const loading =
          (t.key === 'grid' && posts.isPending) || (t.key === 'tagged' && tagged.isPending);
        return (
          <View key={t.key} style={{ width }}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 32 }} />
            ) : (
              <ProfileGrid
                items={byTab[t.key] ?? []}
                empty={<EmptyTab tab={t.key} isOwn={isOwn} />}
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function toGridItem(p: GridPost): GridItem {
  return {
    id: p.id,
    uri: p.coverUrl,
    kind: p.media_count > 1 ? 'carousel' : p.cover_type === 'video' ? 'video' : undefined,
    pinned: p.is_pinned,
    closeFriends: p.audience === 'close_friends',
  };
}

export type GridItem = {
  id: string;
  uri: string | null;
  kind?: 'carousel' | 'reel' | 'video';
  pinned?: boolean;
  closeFriends?: boolean;
  /** Upload in progress (own profile): dimmed with a spinner, not tappable. */
  pending?: boolean;
};

const KIND_ICON = { carousel: 'carousel', reel: 'reels', video: 'reelsFilled' } as const;

/** 3-column grid of vertical 3:4 tiles with 1px gutters (Instagram's 2025 grid). */
export function ProfileGrid({
  items,
  empty,
  onPressItem,
}: {
  items: GridItem[];
  empty: ReactNode;
  /** Default: open the post. */
  onPressItem?: (item: GridItem) => void;
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  if (items.length === 0) return <>{empty}</>;
  const tile = (width - 2) / 3;
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          disabled={item.pending}
          onPress={() =>
            onPressItem
              ? onPressItem(item)
              : router.push({ pathname: '/p/[id]', params: { id: item.id } })
          }
          accessibilityRole={item.pending ? undefined : 'button'}
          accessibilityLabel={item.pending ? 'Posting' : 'Open post'}
          style={{ width: tile, height: (tile * 4) / 3, backgroundColor: colors.skeleton }}
        >
          {item.uri ? (
            <Image
              source={{ uri: item.uri }}
              style={[StyleSheet.absoluteFill, item.pending && { opacity: 0.5 }]}
              contentFit="cover"
              recyclingKey={item.id}
            />
          ) : null}
          <View style={styles.badges}>
            {item.pinned ? <Icon name="pin" size={16} color={colors.onMedia} /> : null}
            {item.closeFriends ? (
              <Icon name="closeFriends" size={16} color={colors.closeFriends} />
            ) : null}
            {item.kind ? (
              <Icon name={KIND_ICON[item.kind]} size={16} color={colors.onMedia} />
            ) : null}
          </View>
          {item.pending ? <ActivityIndicator style={StyleSheet.absoluteFill} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function EmptyTab({ tab, isOwn }: { tab: ProfileTabKey; isOwn: boolean }) {
  const { colors, spacing } = useTheme();
  const own: Record<ProfileTabKey, { icon: IconName; title: string; body: string; cta?: string }> =
    {
      grid: {
        icon: 'camera',
        title: 'Share photos and videos',
        body: "When you share photos and videos, they'll appear on your profile.",
        cta: 'Share your first photo or video',
      },
      reels: {
        icon: 'reels',
        title: 'Share a reel',
        body: "When you share reels, they'll appear on your profile.",
        cta: 'Create your first reel',
      },
      reposts: {
        icon: 'reposts',
        title: 'Reposts',
        body: 'Posts and reels you repost will appear here.',
      },
      tagged: {
        icon: 'tagged',
        title: 'Photos and videos of you',
        body: "When people tag you in photos and videos, they'll appear here.",
      },
    };
  const other: Record<ProfileTabKey, { icon: IconName; title: string }> = {
    grid: { icon: 'camera', title: 'No posts yet' },
    reels: { icon: 'reels', title: 'No reels yet' },
    reposts: { icon: 'reposts', title: 'No reposts yet' },
    tagged: { icon: 'tagged', title: 'No photos' },
  };
  const content = isOwn ? own[tab] : { ...other[tab], body: undefined, cta: undefined };

  return (
    <View style={[styles.empty, { gap: spacing.md, paddingHorizontal: spacing.xl }]}>
      <View style={[styles.emptyIcon, { borderColor: colors.text }]}>
        <Icon name={content.icon} size={34} />
      </View>
      <Text variant="headline" style={styles.center}>
        {content.title}
      </Text>
      {content.body ? (
        <Text color="textSecondary" style={styles.center}>
          {content.body}
        </Text>
      ) : null}
      {content.cta ? (
        <Button title={content.cta} variant="text" onPress={() => router.push('/compose')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
  badges: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  empty: { alignItems: 'center', paddingTop: 48, paddingBottom: 64 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
