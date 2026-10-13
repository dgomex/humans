import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text, UserRow } from '@/components';
import { useSuggestedAccounts, type SuggestedAccount } from '@/features/follows/api';
import { FollowButton } from '@/features/follows/FollowButton';
import { avatarUrl } from '@/features/profile/avatar';
import type { FollowStatus } from '@/features/profile/api';
import { openProfile } from '@/features/profile/format';
import { useTheme } from '@/theme';

import { suggestionReason, useDismissSuggestion } from '../api';

/** One suggestion: avatar, username, reason line, Follow / Follow back, ✕ (page 73). */
export function SuggestionRow({
  account,
  status,
  onStatus,
}: {
  account: SuggestedAccount;
  status: FollowStatus;
  onStatus: (s: FollowStatus) => void;
}) {
  const { colors, spacing } = useTheme();
  const dismiss = useDismissSuggestion();
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <UserRow
        username={account.username}
        subtitle={account.full_name || null}
        detail={suggestionReason(account)}
        avatarUri={avatarUrl(account.avatar_path)}
        onPress={() => openProfile(account.username)}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <FollowButton
              userId={account.id}
              username={account.username}
              isPrivate={account.is_private}
              followsMe={account.follows_me}
              status={status}
              onChange={onStatus}
            />
            <Pressable
              onPress={() => dismiss.mutate(account.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${account.username} from suggestions`}
            >
              <Icon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

/** "Suggested for you" block at the bottom of Activity / Follow requests, with See all. */
export function SuggestionsSection({ limit = 8 }: { limit?: number }) {
  const { spacing } = useTheme();
  const suggestions = useSuggestedAccounts();
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  const people = (suggestions.data ?? []).slice(0, limit);
  if (people.length === 0) return null;
  return (
    <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xs,
        }}
      >
        <Text variant="bodyBold">Suggested for you</Text>
        <Pressable
          onPress={() => router.push('/discover-people')}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text variant="bodyBold" color="primary">
            See all
          </Text>
        </Pressable>
      </View>
      {people.map((p) => (
        <SuggestionRow
          key={p.id}
          account={p}
          status={status[p.id] ?? 'none'}
          onStatus={(s) => setStatus((m) => ({ ...m, [p.id]: s }))}
        />
      ))}
    </View>
  );
}
