import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Icon,
  Text,
  useToast,
  type IconName,
} from '@/components';
import {
  normalizeTag,
  useHashtag,
  useHashtagPosts,
  type HashtagHeader,
  type HashtagTab,
} from '@/features/explore/api';
import { ExploreGrid } from '@/features/explore/components/ExploreGrid';
import { hashtagUrl, openTile } from '@/features/explore/format';
import { formatCount } from '@/features/profile/format';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { ReelGrid } from '@/features/reels/components/ReelGrid';
import { useTheme } from '@/theme';

const TABS: { key: HashtagTab; label: string; icon: IconName }[] = [
  { key: 'top', label: 'Top', icon: 'grid' },
  { key: 'recent', label: 'Recent', icon: 'history' },
  { key: 'reels', label: 'Reels', icon: 'reels' },
];

/**
 * Page 68 — hashtag page: cover (top post), post count, Top · Recent · Reels grids, share and
 * ⋯ (Copy link, Report). No hashtag following (decision 2026-10-12).
 */
export default function HashtagScreen() {
  const params = useLocalSearchParams<{ tag: string }>();
  const name = normalizeTag(params.tag ?? '');
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const header = useHashtag(name);
  const [tab, setTab] = useState<HashtagTab>('top');
  const posts = useHashtagPosts(name, tab);
  const [menu, setMenu] = useState(false);
  const tiles = useMemo(() => (posts.data?.pages ?? []).flatMap((p) => p.tiles), [posts.data]);

  function share() {
    const url = hashtagUrl(name);
    void Share.share({ message: url, url });
  }

  const more = () => {
    if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
  };

  const top = (
    <View>
      <Header name={name} data={header.data ?? null} loading={header.isPending} />
      <View style={[styles.tabs, { borderBottomColor: colors.separator }]}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: tab === t.key }}
            style={[styles.tab, { borderBottomColor: tab === t.key ? colors.text : 'transparent' }]}
          >
            <Icon
              name={t.icon}
              size={24}
              color={tab === t.key ? colors.icon : colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const empty = posts.isPending ? (
    <ActivityIndicator style={{ marginTop: spacing.xl }} />
  ) : (
    <View style={[styles.center, { padding: spacing.xl, gap: spacing.sm }]}>
      <Icon name={tab === 'reels' ? 'reels' : 'camera'} size={40} />
      <Text variant="bodyBold">{tab === 'reels' ? 'No reels yet' : 'No posts yet'}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={`#${name}`}
        right={
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <TopBarButton icon="share" label="Share" onPress={share} />
            <TopBarButton icon="more" label="More" onPress={() => setMenu(true)} />
          </View>
        }
      />
      {tab === 'reels' ? (
        <ScrollView
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            if (layoutMeasurement.height + contentOffset.y > contentSize.height - 400) more();
          }}
          scrollEventThrottle={200}
        >
          {top}
          {tiles.length === 0 ? (
            empty
          ) : (
            <ReelGrid tiles={tiles} source="tag" owner={name} gap={1} />
          )}
          {posts.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
        </ScrollView>
      ) : (
        <ExploreGrid
          key={tab}
          tiles={tiles}
          pattern={false}
          complete={!posts.hasNextPage}
          onPressTile={(t) => openTile(t, { source: 'tag', owner: name, tab, title: `#${name}` })}
          onEndReached={more}
          loadingMore={posts.isFetchingNextPage}
          header={top}
          empty={empty}
        />
      )}

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <ActionGroup>
          <ActionRow
            icon="link"
            label="Copy link"
            onPress={() => {
              setMenu(false);
              void Clipboard.setStringAsync(hashtagUrl(name)).then(() => toast.show('Link copied'));
            }}
          />
          {header.data ? (
            <ActionRow
              icon="report"
              label="Report"
              destructive
              onPress={() => {
                setMenu(false);
                router.push({
                  pathname: '/report',
                  params: { type: 'hashtag', id: header.data!.id },
                });
              }}
            />
          ) : null}
        </ActionGroup>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Header({
  name,
  data,
  loading,
}: {
  name: string;
  data: HashtagHeader | null;
  loading: boolean;
}) {
  const { colors, spacing, hairline } = useTheme();
  const count = data?.post_count ?? 0;
  return (
    <View style={[styles.header, { padding: spacing.lg, gap: spacing.xl }]}>
      <View
        style={[
          styles.cover,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.separator,
            borderWidth: hairline,
          },
        ]}
      >
        {data?.coverUrl ? (
          <Image
            source={{ uri: data.coverUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Icon name="hashtag" size={40} />
        )}
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="headline" numberOfLines={1}>
          #{name}
        </Text>
        {loading ? null : (
          <Text color="textSecondary">
            <Text variant="bodyBold">{formatCount(count)}</Text> {count === 1 ? 'post' : 'posts'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  cover: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1.5 },
  center: { alignItems: 'center' },
});
