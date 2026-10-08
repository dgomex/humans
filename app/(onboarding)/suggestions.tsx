import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, UserRow } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFollow, useSuggestedAccounts } from '@/features/follows/api';
import { FollowButton } from '@/features/follows/FollowButton';
import type { FollowStatus } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

/** Page 011 (part 2) — Discover people; Done finishes onboarding → Home. */
export default function SuggestionsScreen() {
  const { spacing, colors } = useTheme();
  const auth = useAuth();
  const suggestions = useSuggestedAccounts();
  const followMany = useFollow();
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});

  const data = suggestions.data ?? [];
  const contacts = data.filter((s) => s.reason === 'contact');
  const followedCount = Object.values(status).filter((v) => v !== 'none').length;

  function followAll() {
    const next = { ...status };
    for (const c of contacts) {
      if (!next[c.id] || next[c.id] === 'none') {
        next[c.id] = c.is_private ? 'requested' : 'following';
        followMany.mutate({ userId: c.id, follow: true });
      }
    }
    setStatus(next);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <FlatList
        data={data}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, paddingVertical: spacing.lg }}>
            <Text variant="title">Discover people</Text>
            <Text>Follow people to see their photos and videos in your feed.</Text>
            {contacts.length > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: spacing.sm,
                }}
              >
                <Text variant="bodyBold">{`${contacts.length} contacts on Humans`}</Text>
                <Button title="Follow all" variant="text" onPress={followAll} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          suggestions.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
              {suggestions.isError
                ? "Couldn't load suggestions."
                : "No suggestions yet. You'll find people to follow in Explore."}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <UserRow
            username={item.username}
            subtitle={item.full_name}
            detail={item.reason === 'contact' ? 'In your contacts' : 'Suggested for you'}
            avatarUri={avatarUrl(item.avatar_path)}
            avatarSize={52}
            trailing={
              <FollowButton
                userId={item.id}
                username={item.username}
                isPrivate={item.is_private}
                status={status[item.id] ?? 'none'}
                onChange={(v) => setStatus((f) => ({ ...f, [item.id]: v }))}
              />
            }
          />
        )}
      />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Button
          title={followedCount > 0 ? 'Next' : 'Skip'}
          shape="pill"
          size="lg"
          fullWidth
          variant={followedCount > 0 ? 'primary' : 'outline'}
          onPress={auth.finishOnboarding}
        />
      </View>
    </SafeAreaView>
  );
}
