import { router } from 'expo-router';
import type { ReactNode, RefObject } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Button, Icon, Text, type IconName } from '@/components';
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
 * Each tab shows its empty state until Phase 3/6 content exists.
 */
export function ProfileTabPages({
  pagerRef,
  active,
  onSwipe,
  isOwn,
}: {
  pagerRef: RefObject<ScrollView | null>;
  active: ProfileTabKey;
  onSwipe: (tab: ProfileTabKey) => void;
  isOwn: boolean;
}) {
  const { width } = useWindowDimensions();

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
      {TABS.map((t) => (
        <View key={t.key} style={{ width }}>
          <ProfileGrid items={[]} empty={<EmptyTab tab={t.key} isOwn={isOwn} />} />
        </View>
      ))}
    </ScrollView>
  );
}

export type GridItem = {
  id: string;
  uri: string | null;
  kind?: 'carousel' | 'reel';
  pinned?: boolean;
};

/** 3-column grid of vertical 3:4 tiles with 1px gutters (Instagram's 2025 grid). */
export function ProfileGrid({ items, empty }: { items: GridItem[]; empty: ReactNode }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  if (items.length === 0) return <>{empty}</>;
  const tile = (width - 2) / 3;
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.id}
          style={{ width: tile, height: (tile * 4) / 3, backgroundColor: colors.skeleton }}
        />
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
        <Button title={content.cta} variant="text" onPress={() => router.push('/create-entry')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
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
