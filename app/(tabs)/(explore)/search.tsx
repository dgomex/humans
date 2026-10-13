import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import {
  useRecentSearches,
  useRecordSearch,
  useRemoveRecent,
  useSearchAccounts,
  useSearchAudio,
  useSearchHashtags,
  useSearchPosts,
  type AccountResult,
  type RecentSearch,
} from '@/features/explore/api';
import { ExploreGrid } from '@/features/explore/components/ExploreGrid';
import {
  AccountResultRow,
  AudioRow,
  HashtagRow,
  KeywordRow,
  RecentRow,
} from '@/features/explore/components/SearchRows';
import { openHashtag, openTile } from '@/features/explore/format';
import { followStatusOf, type FollowStatus } from '@/features/profile/api';
import { openProfile } from '@/features/profile/format';
import { TopBarButton } from '@/features/profile/components/TopBar';
import { ReelGrid } from '@/features/reels/components/ReelGrid';
import { useDebounced } from '@/lib/useDebounced';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

const TABS = [
  { key: 'top', label: 'For you' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'reels', label: 'Reels' },
  { key: 'audio', label: 'Audio' },
  { key: 'tags', label: 'Tags' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/**
 * Pages 66 + 67 â€” Search. Empty field: recent searches (See all â†’ full list). Typing: live
 * suggestions (keyword, accounts, tags, audio). Submitting a keyword: results with For you Â·
 * Accounts Â· Reels Â· Audio Â· Tags (swipe between them). Opened results go to recent searches.
 * No Places tab: the place page (69) is dropped.
 */
export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  // `q`: a keyword re-run from the full recent searches list.
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState<string | null>(params.q ?? null);
  const record = useRecordSearch();
  const input = useRef<TextInput>(null);

  // A new `q` (re-run from the full recents list) replaces the field.
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    if (params.q) {
      setText(params.q);
      setSubmitted(params.q);
    }
  }

  const showResults = submitted !== null && submitted === text.trim();

  function submit(query: string) {
    const q = query.trim();
    if (!q) return;
    setText(q);
    setSubmitted(q);
    input.current?.blur();
    record.mutate({ kind: 'keyword', query: q });
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md, gap: spacing.md }]}>
        <TopBarButton icon="back" label="Back" onPress={() => goBack('/explore')} />
        <View
          style={[
            styles.field,
            {
              backgroundColor: colors.backgroundSecondary,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            },
          ]}
        >
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => submit(text)}
            autoFocus={!params.q}
            placeholder="Search"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search"
            style={[styles.input, { color: colors.text }]}
          />
          {text ? (
            <Pressable
              onPress={() => {
                setText('');
                setSubmitted(null);
                input.current?.focus();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {showResults ? (
        <Results query={submitted} />
      ) : text.trim() ? (
        <Typeahead query={text} onSubmit={submit} />
      ) : (
        <Recents onKeyword={submit} />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------------------------
// Opening a result (records it in recent searches)
// ---------------------------------------------------------------------------------------------

function useOpeners() {
  const record = useRecordSearch();
  return {
    account: (a: { id: string; username: string }) => {
      record.mutate({ kind: 'account', target: a.id });
      openProfile(a.username);
    },
    tag: (t: { id: string; name: string }) => {
      record.mutate({ kind: 'hashtag', target: t.id });
      openHashtag(t.name);
    },
    audio: (id: string) => {
      record.mutate({ kind: 'audio', target: id });
      router.push({ pathname: '/audio/[id]', params: { id } });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Recent searches (page 67)
// ---------------------------------------------------------------------------------------------

function Recents({ onKeyword }: { onKeyword: (q: string) => void }) {
  const { spacing } = useTheme();
  const recents = useRecentSearches(10);
  const remove = useRemoveRecent();
  const open = useOpeners();
  const rows = recents.data ?? [];

  function openRecent(r: RecentSearch) {
    if (r.kind === 'account' && r.username && r.target_id)
      open.account({ id: r.target_id, username: r.username });
    else if (r.kind === 'hashtag' && r.tag_name && r.target_id)
      open.tag({ id: r.target_id, name: r.tag_name });
    else if (r.kind === 'audio' && r.target_id) open.audio(r.target_id);
    else if (r.query) onKeyword(r.query);
  }

  if (recents.isPending) return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  if (rows.length === 0) return null;
  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View
        style={[
          styles.sectionHeader,
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
        ]}
      >
        <Text variant="bodyBold">Recent</Text>
        <Pressable
          onPress={() => router.push('/recent-searches')}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text color="link" variant="bodyBold">
            See all
          </Text>
        </Pressable>
      </View>
      {rows.map((r) => (
        <RecentRow
          key={r.id}
          item={r}
          onPress={() => openRecent(r)}
          onRemove={() => remove.mutate(r.id)}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------------
// Typeahead
// ---------------------------------------------------------------------------------------------

function Typeahead({ query, onSubmit }: { query: string; onSubmit: (q: string) => void }) {
  const { spacing } = useTheme();
  const q = useDebounced(query.trim(), 250);
  const tagOnly = q.startsWith('#');
  const accounts = useSearchAccounts(q, 6, !tagOnly && q.length > 0);
  const tags = useSearchHashtags(q, tagOnly ? 10 : 3, q.length > 0);
  const audio = useSearchAudio(q, 2, !tagOnly && q.length > 0);
  const open = useOpeners();
  const loading = accounts.isFetching || tags.isFetching || audio.isFetching;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <KeywordRow query={query.trim()} onPress={() => onSubmit(query)} />
      {(tagOnly ? [] : (accounts.data ?? [])).map((a) => (
        <AccountResultRow key={a.id} account={a} onPress={() => open.account(a)} />
      ))}
      {(tags.data ?? []).map((t) => (
        <HashtagRow key={t.id} tag={t} onPress={() => open.tag(t)} />
      ))}
      {(tagOnly ? [] : (audio.data ?? [])).map((a) => (
        <AudioRow key={a.id} audio={a} onPress={() => open.audio(a.id)} />
      ))}
      {loading ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------------
// Results (page 66)
// ---------------------------------------------------------------------------------------------

function Results({ query }: { query: string }) {
  const { width } = useWindowDimensions();
  const { colors, hairline } = useTheme();
  const [tab, setTab] = useState<TabKey>('top');
  const pager = useRef<FlatList<(typeof TABS)[number]>>(null);
  const index = TABS.findIndex((t) => t.key === tab);

  function select(key: TabKey) {
    setTab(key);
    pager.current?.scrollToIndex({ index: TABS.findIndex((t) => t.key === key), animated: true });
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: hairline, borderBottomColor: colors.separator }}
      >
        {TABS.map((t, i) => (
          <Pressable
            key={t.key}
            onPress={() => select(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === index }}
            style={[styles.tab, { borderBottomColor: i === index ? colors.text : 'transparent' }]}
          >
            <Text variant="bodyBold" color={i === index ? 'text' : 'textSecondary'}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        ref={pager}
        data={TABS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(t) => t.key}
        getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (TABS[i]) setTab(TABS[i].key);
        }}
        renderItem={({ item, index: i }) => (
          <View style={{ width }}>
            {/* Mount a tab once it's been near the visible one. */}
            {Math.abs(i - index) <= 1 ? (
              <ResultTab tab={item.key} query={query} onSeeAccounts={() => select('accounts')} />
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

function ResultTab({
  tab,
  query,
  onSeeAccounts,
}: {
  tab: TabKey;
  query: string;
  onSeeAccounts: () => void;
}) {
  if (tab === 'top') return <TopTab query={query} onSeeAccounts={onSeeAccounts} />;
  if (tab === 'accounts') return <AccountsTab query={query} />;
  if (tab === 'reels') return <ReelsTab query={query} />;
  if (tab === 'audio') return <AudioTab query={query} />;
  return <TagsTab query={query} />;
}

function NoResults({ query }: { query: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <Text color="textSecondary">No results found for &quot;{query}&quot;.</Text>
    </View>
  );
}

function useFollowStatuses() {
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  return {
    of: (a: AccountResult) => status[a.id] ?? followStatusOf(a),
    set: (id: string, s: FollowStatus) => setStatus((m) => ({ ...m, [id]: s })),
  };
}

function TopTab({ query, onSeeAccounts }: { query: string; onSeeAccounts: () => void }) {
  const { spacing } = useTheme();
  const accounts = useSearchAccounts(query, 3);
  const posts = useSearchPosts(query, 'top');
  const open = useOpeners();
  const follow = useFollowStatuses();
  const tiles = useMemo(() => (posts.data?.pages ?? []).flatMap((p) => p.tiles), [posts.data]);
  const people = accounts.data ?? [];

  if (posts.isPending || accounts.isPending)
    return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  return (
    <ExploreGrid
      tiles={tiles}
      complete={!posts.hasNextPage}
      onPressTile={(t) => openTile(t, { source: 'search', owner: query, title: query })}
      onEndReached={() => {
        if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
      }}
      loadingMore={posts.isFetchingNextPage}
      header={
        people.length > 0 ? (
          <View style={{ paddingVertical: spacing.sm }}>
            {people.map((a) => (
              <AccountResultRow
                key={a.id}
                account={a}
                onPress={() => open.account(a)}
                status={follow.of(a)}
                onStatus={(s) => follow.set(a.id, s)}
              />
            ))}
            <Pressable
              onPress={onSeeAccounts}
              accessibilityRole="button"
              style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
            >
              <Text color="link" variant="bodyBold">
                See more accounts
              </Text>
            </Pressable>
          </View>
        ) : null
      }
      empty={people.length === 0 ? <NoResults query={query} /> : null}
    />
  );
}

function AccountsTab({ query }: { query: string }) {
  const { spacing } = useTheme();
  const accounts = useSearchAccounts(query, 50);
  const open = useOpeners();
  const follow = useFollowStatuses();
  if (accounts.isPending) return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  return (
    <FlatList
      data={accounts.data ?? []}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => (
        <AccountResultRow
          account={item}
          onPress={() => open.account(item)}
          status={follow.of(item)}
          onStatus={(s) => follow.set(item.id, s)}
        />
      )}
      ListEmptyComponent={<NoResults query={query} />}
    />
  );
}

function ReelsTab({ query }: { query: string }) {
  const { spacing } = useTheme();
  const reels = useSearchPosts(query, 'reels');
  const tiles = (reels.data?.pages ?? []).flatMap((p) => p.tiles);
  if (reels.isPending) return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  if (tiles.length === 0) return <NoResults query={query} />;
  return (
    <ScrollView
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (
          layoutMeasurement.height + contentOffset.y > contentSize.height - 400 &&
          reels.hasNextPage &&
          !reels.isFetchingNextPage
        )
          void reels.fetchNextPage();
      }}
      scrollEventThrottle={200}
    >
      <ReelGrid tiles={tiles} source="search" owner={query} gap={1} />
      {reels.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
    </ScrollView>
  );
}

function AudioTab({ query }: { query: string }) {
  const { spacing } = useTheme();
  const audio = useSearchAudio(query, 50);
  const open = useOpeners();
  if (audio.isPending) return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  return (
    <FlatList
      data={audio.data ?? []}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <AudioRow audio={item} onPress={() => open.audio(item.id)} />}
      ListEmptyComponent={<NoResults query={query} />}
    />
  );
}

function TagsTab({ query }: { query: string }) {
  const { spacing } = useTheme();
  const tags = useSearchHashtags(query, 50);
  const open = useOpeners();
  if (tags.isPending && tags.fetchStatus !== 'idle')
    return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  return (
    <FlatList
      data={tags.data ?? []}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => <HashtagRow tag={item} onPress={() => open.tag(item)} />}
      ListEmptyComponent={<NoResults query={query} />}
    />
  );
}

const styles = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center' },
  field: { flex: 1, height: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tab: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1.5 },
});
