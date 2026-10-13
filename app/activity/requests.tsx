import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SearchField, Text, UserRow, useToast } from '@/components';
import { useAnswerRequest, useMyFollowRequests, type FollowRequest } from '@/features/activity/api';
import { SuggestionsSection } from '@/features/activity/components/Suggestions';
import { FollowButton } from '@/features/follows/FollowButton';
import type { FollowStatus } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

type Answered = { state: 'confirmed'; follow: FollowStatus } | { state: 'deleted' };

/** Page 72 — Follow requests: Confirm / Delete, then Follow back inline. */
export default function FollowRequestsScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 250);
  const requests = useMyFollowRequests(query);
  const answer = useAnswerRequest();
  // Rows stay in place after answering until you leave (Instagram keeps them).
  const [answered, setAnswered] = useState<Record<string, Answered>>({});
  const [kept, setKept] = useState<Record<string, FollowRequest>>({});

  const list = useMemo(() => {
    const fetched = requests.data?.pages.flat() ?? [];
    const ids = new Set(fetched.map((r) => r.id));
    const extra = Object.values(kept).filter(
      (r) =>
        !ids.has(r.id) &&
        (!query ||
          r.username.includes(query.toLowerCase()) ||
          r.full_name.toLowerCase().includes(query.toLowerCase())),
    );
    return [...fetched, ...extra].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [requests.data, kept, query]);

  function reply(r: FollowRequest, approve: boolean) {
    setKept((k) => ({ ...k, [r.id]: r }));
    setAnswered((a) => ({
      ...a,
      [r.id]: approve
        ? {
            state: 'confirmed',
            follow: r.i_follow ? 'following' : r.requested ? 'requested' : 'none',
          }
        : { state: 'deleted' },
    }));
    answer.mutate(
      { requesterId: r.id, approve },
      {
        onError: () => {
          setAnswered(({ [r.id]: _, ...rest }) => rest);
          toast.show("Couldn't update the request.");
        },
      },
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Follow requests" center />
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
            <SearchField value={search} onChangeText={setSearch} />
          </View>
        }
        ListEmptyComponent={
          requests.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
              {query ? 'No results found.' : 'No pending requests.'}
            </Text>
          )
        }
        ListFooterComponent={query ? null : <SuggestionsSection limit={10} />}
        onEndReached={() => {
          if (requests.hasNextPage && !requests.isFetchingNextPage) void requests.fetchNextPage();
        }}
        renderItem={({ item }) => {
          const done = answered[item.id];
          return (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <UserRow
                username={item.username}
                subtitle={item.full_name || null}
                avatarUri={avatarUrl(item.avatar_path)}
                onPress={() => openProfile(item.username)}
                trailing={
                  !done ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Button title="Confirm" size="sm" onPress={() => reply(item, true)} />
                      <Button
                        title="Delete"
                        variant="secondary"
                        size="sm"
                        onPress={() => reply(item, false)}
                      />
                    </View>
                  ) : done.state === 'confirmed' ? (
                    <FollowButton
                      userId={item.id}
                      username={item.username}
                      isPrivate={item.is_private}
                      followsMe
                      status={done.follow}
                      onChange={(s) =>
                        setAnswered((a) => ({ ...a, [item.id]: { state: 'confirmed', follow: s } }))
                      }
                    />
                  ) : (
                    <Text color="textSecondary">Request removed</Text>
                  )
                }
              />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
