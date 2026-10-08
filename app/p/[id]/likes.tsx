import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchField, Text, UserRow } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useLikers, usePostCard, type Liker } from '@/features/feed/api';
import { FollowButton } from '@/features/follows/FollowButton';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { followStatusOf, type FollowStatus } from '@/features/profile/api';
import { TopBar } from '@/features/profile/components/TopBar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

/**
 * Page 47 — Likes (of a post, or of a comment with `?comment=`): search, people you follow
 * first, inline Follow. Hidden like counts: only the author sees the total.
 */
export default function LikesScreen() {
  const { id, comment } = useLocalSearchParams<{ id: string; comment?: string }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 200);
  const card = usePostCard(comment ? undefined : id);
  const likers = useLikers(comment ? { kind: 'comment', id: comment } : { kind: 'post', id }, term);
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  const rows = likers.data?.pages.flat() ?? [];
  const total = card.data?.like_count;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Likes" center />
      <FlatList
        data={rows}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <SearchField value={search} onChangeText={setSearch} />
            {!comment && typeof total === 'number' && total > 0 ? (
              <Text variant="caption" color="textSecondary">
                {formatCount(total)} {total === 1 ? 'like' : 'likes'}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }: { item: Liker }) => (
          <UserRow
            username={item.username}
            subtitle={item.full_name}
            avatarUri={avatarUrl(item.avatar_path)}
            onPress={() => openProfile(item.username)}
            trailing={
              item.id === profile?.id ? null : (
                <FollowButton
                  userId={item.id}
                  username={item.username}
                  isPrivate={item.is_private}
                  followsMe={item.follows_me}
                  status={status[item.id] ?? followStatusOf(item)}
                  onChange={(s) => setStatus((m) => ({ ...m, [item.id]: s }))}
                />
              )
            }
          />
        )}
        ListEmptyComponent={
          likers.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
              {term ? 'No results found.' : 'No likes yet'}
            </Text>
          )
        }
        onEndReached={() => {
          if (likers.hasNextPage && !likers.isFetchingNextPage) void likers.fetchNextPage();
        }}
      />
    </SafeAreaView>
  );
}
