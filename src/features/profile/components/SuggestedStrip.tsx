import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components';
import { suggestionReason, useDismissSuggestion } from '@/features/activity/api';
import { useSuggestedAccounts } from '@/features/follows/api';
import { FollowButton } from '@/features/follows/FollowButton';
import { useTheme } from '@/theme';

import type { FollowStatus } from '../api';
import { avatarUrl } from '../avatar';
import { openProfile } from '../format';

/**
 * "Discover people" cards toggled by the person+ button (pages 16/17/18) and on Explore.
 * ✕ is stored server-side (page 73) so the account leaves every suggestions list.
 */
export function SuggestedStrip({ title = 'Discover people' }: { title?: string }) {
  const { colors, spacing, radius, hairline } = useTheme();
  const suggestions = useSuggestedAccounts();
  const dismiss = useDismissSuggestion();
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});

  const people = suggestions.data ?? [];
  if (!suggestions.isPending && people.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
        <Text variant="bodyBold">{title}</Text>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      >
        {people.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => openProfile(p.username)}
            style={[
              styles.card,
              {
                borderColor: colors.separator,
                borderWidth: hairline * 2,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.xs,
              },
            ]}
          >
            <Pressable
              onPress={() => dismiss.mutate(p.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${p.username}`}
              style={styles.dismiss}
            >
              <Icon name="close" size={16} color={colors.textSecondary} />
            </Pressable>
            <Avatar uri={avatarUrl(p.avatar_path)} size={64} />
            <Text variant="bodyBold" numberOfLines={1}>
              {p.username}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {suggestionReason(p)}
            </Text>
            <View style={{ alignSelf: 'stretch', marginTop: spacing.xs }}>
              <FollowButton
                userId={p.id}
                username={p.username}
                isPrivate={p.is_private}
                followsMe={p.follows_me}
                status={status[p.id] ?? 'none'}
                onChange={(s) => setStatus((m) => ({ ...m, [p.id]: s }))}
                fill
              />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { width: 150, alignItems: 'center' },
  dismiss: { position: 'absolute', top: 6, right: 6, zIndex: 1 },
});
