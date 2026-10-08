import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SearchField, Text, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { FollowButton } from '@/features/follows/FollowButton';
import {
  followStatusOf,
  useConnections,
  useProfile,
  useRemoveFollower,
  type Connection,
  type ConnectionKind,
  type FollowStatus,
} from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

/** Pages 021/022 — Followers · Following (· Mutual on other profiles), with search. */
export default function ConnectionsScreen() {
  const { colors, spacing, hairline } = useTheme();
  const params = useLocalSearchParams<{ username: string; tab?: ConnectionKind }>();
  const profile = useProfile({ username: params.username });
  const p = profile.data;
  const [kind, setKind] = useState<ConnectionKind>(params.tab ?? 'followers');
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());

  const tabs: { kind: ConnectionKind; label: string }[] = [];
  if (p && !p.is_self && p.mutual_count > 0) {
    tabs.push({ kind: 'mutual', label: `${formatCount(p.mutual_count)} mutual` });
  }
  tabs.push(
    {
      kind: 'followers',
      label: `${formatCount(p?.followers_count ?? 0)} ${p?.followers_count === 1 ? 'follower' : 'followers'}`,
    },
    { kind: 'following', label: `${formatCount(p?.following_count ?? 0)} following` },
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title={p?.username ?? params.username} center />
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: hairline,
          borderBottomColor: colors.separator,
        }}
      >
        {tabs.map((t) => {
          const on = t.kind === kind;
          return (
            <Pressable
              key={t.kind}
              onPress={() => setKind(t.kind)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderBottomWidth: 1.5,
                borderBottomColor: on ? colors.text : 'transparent',
              }}
            >
              <Text variant="bodyBold" color={on ? 'text' : 'textSecondary'}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {p ? (
        <ConnectionList
          key={kind}
          userId={p.id}
          ownList={p.is_self}
          kind={kind}
          search={query}
          header={
            <View style={{ paddingVertical: spacing.md }}>
              <SearchField value={search} onChangeText={setSearch} />
            </View>
          }
        />
      ) : (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      )}
    </SafeAreaView>
  );
}

function ConnectionList({
  userId,
  ownList,
  kind,
  search,
  header,
}: {
  userId: string;
  ownList: boolean;
  kind: ConnectionKind;
  search: string;
  header: React.ReactElement;
}) {
  const { spacing } = useTheme();
  const list = useConnections(userId, kind, search);
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const rows = (list.data?.pages.flat() ?? []).filter((r) => !removed.has(r.id));

  const empty = search
    ? 'No users found.'
    : kind === 'followers'
      ? ownList
        ? 'People who follow you will appear here.'
        : 'No followers yet.'
      : kind === 'following'
        ? ownList
          ? "You'll see all the people you follow here."
          : 'Not following anyone yet.'
        : 'No mutual followers.';

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
      ListHeaderComponent={header}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        list.isPending ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : (
          <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
            {list.isError ? "Couldn't load this list." : empty}
          </Text>
        )
      }
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator /> : null}
      renderItem={({ item }) => (
        <ConnectionRow
          row={item}
          status={status[item.id] ?? followStatusOf(item)}
          onStatus={(s) => setStatus((m) => ({ ...m, [item.id]: s }))}
          removable={ownList && kind === 'followers'}
          onRemoved={() => setRemoved((r) => new Set(r).add(item.id))}
        />
      )}
    />
  );
}

function ConnectionRow({
  row,
  status,
  onStatus,
  removable,
  onRemoved,
}: {
  row: Connection;
  status: FollowStatus;
  onStatus: (s: FollowStatus) => void;
  removable: boolean;
  onRemoved: () => void;
}) {
  const { spacing } = useTheme();
  const { session } = useAuth();
  const toast = useToast();
  const remove = useRemoveFollower();

  function confirmRemove() {
    const me = session?.user.id;
    if (!me) return;
    showDialog(
      'Remove follower?',
      `We won't tell @${row.username} they were removed from your followers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onRemoved();
            remove.mutate(
              { me, followerId: row.id },
              { onError: () => toast.show("Couldn't remove follower.") },
            );
          },
        },
      ],
    );
  }

  let trailing: React.ReactNode = null;
  if (removable) {
    trailing = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {status === 'none' ? (
          <FollowButton
            userId={row.id}
            username={row.username}
            status={status}
            followsMe
            isPrivate={row.is_private}
            onChange={onStatus}
          />
        ) : null}
        <Button title="Remove" variant="secondary" size="sm" onPress={confirmRemove} />
      </View>
    );
  } else if (!row.is_self) {
    trailing = (
      <FollowButton
        userId={row.id}
        username={row.username}
        status={status}
        followsMe={row.follows_me}
        isPrivate={row.is_private}
        onChange={onStatus}
      />
    );
  }

  return (
    <UserRow
      username={row.username}
      subtitle={row.full_name}
      avatarUri={avatarUrl(row.avatar_path)}
      avatarSize={52}
      onPress={() => openProfile(row.username)}
      trailing={trailing}
    />
  );
}
