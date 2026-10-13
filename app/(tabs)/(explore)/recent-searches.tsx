import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useClearRecents,
  useRecentSearches,
  useRecordSearch,
  useRemoveRecent,
  type RecentSearch,
} from '@/features/explore/api';
import { RecentRow } from '@/features/explore/components/SearchRows';
import { openHashtag } from '@/features/explore/format';
import { openProfile } from '@/features/profile/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/** Page 67 — all recent searches, ✕ per entry, Clear all (with confirmation). */
export default function RecentSearchesScreen() {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const recents = useRecentSearches();
  const remove = useRemoveRecent();
  const clear = useClearRecents(profile?.id);
  const record = useRecordSearch();
  const rows = recents.data ?? [];

  function open(r: RecentSearch) {
    if (r.kind === 'account' && r.username && r.target_id) {
      record.mutate({ kind: 'account', target: r.target_id });
      openProfile(r.username);
    } else if (r.kind === 'hashtag' && r.tag_name && r.target_id) {
      record.mutate({ kind: 'hashtag', target: r.target_id });
      openHashtag(r.tag_name);
    } else if (r.kind === 'audio' && r.target_id) {
      record.mutate({ kind: 'audio', target: r.target_id });
      router.push({ pathname: '/audio/[id]', params: { id: r.target_id } });
    } else if (r.query) {
      // Re-run the keyword: back to Search with the query submitted.
      record.mutate({ kind: 'keyword', query: r.query });
      router.dismissTo({ pathname: '/search', params: { q: r.query } });
    }
  }

  function confirmClear() {
    showDialog(
      'Clear search history?',
      "You won't be able to undo this. If you clear your search history, you may still see accounts you've searched for as suggested results.",
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => clear.mutate() },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        center
        title="Recent searches"
        right={
          rows.length > 0 ? (
            <Pressable onPress={confirmClear} hitSlop={8} accessibilityRole="button">
              <Text color="link" variant="bodyBold">
                Clear all
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 26 }} />
          )
        }
      />
      {recents.isPending ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          renderItem={({ item }) => (
            <RecentRow
              item={item}
              onPress={() => open(item)}
              onRemove={() => remove.mutate(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text color="textSecondary">No recent searches.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
