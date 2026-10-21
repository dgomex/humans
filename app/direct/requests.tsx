import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { directKeys, useDirectBadge, useInbox } from '@/features/direct/api';
import { ThreadRow } from '@/features/direct/components/ThreadRow';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/**
 * Page 75 — Message requests (and ?hidden=1 → Hidden requests). People you don't follow land
 * here; they can send one text message until you accept. Spam / offensive ones are hidden.
 */
export default function RequestsScreen() {
  const { hidden } = useLocalSearchParams<{ hidden?: string }>();
  const isHidden = hidden === '1';
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useInbox(isHidden ? 'hidden' : 'requests');
  const badge = useDirectBadge();
  const threads = useMemo(() => list.data?.pages.flat() ?? [], [list.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: directKeys.inboxAll });
    void qc.invalidateQueries({ queryKey: directKeys.badge });
  };

  function deleteAll() {
    showDialog(
      isHidden ? 'Delete all hidden requests?' : 'Delete all requests?',
      "The people who sent them won't be notified.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('clear_requests', { p_hidden: isHidden });
            if (error) toast.show("Couldn't delete requests.");
            refresh();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={isHidden ? 'Hidden requests' : 'Message requests'}
        center
        right={
          threads.length > 0 ? (
            <Pressable onPress={deleteAll} hitSlop={8} accessibilityRole="button">
              <Text variant="bodyBold" color="danger">
                Delete all
              </Text>
            </Pressable>
          ) : null
        }
      />
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={
          <Text color="textSecondary" style={{ padding: spacing.lg, textAlign: 'center' }}>
            {isHidden
              ? "These requests may be offensive, unwanted or spam. You won't get notifications for them."
              : "Open a chat to get more info about who's messaging you. They won't know you've seen it until you accept."}
          </Text>
        }
        renderItem={({ item }) => (
          <ThreadRow
            thread={item}
            me={profile?.id ?? ''}
            onPress={() => router.push(`/direct/t/${item.id}`)}
            onDelete={async () => {
              await supabase.rpc('clear_thread', { p_thread: item.id });
              refresh();
            }}
          />
        )}
        ListEmptyComponent={
          list.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <View style={[styles.empty, { padding: spacing.xl, gap: spacing.sm }]}>
              <Text variant="subhead">
                {isHidden ? 'No hidden requests' : 'No message requests'}
              </Text>
              <Text color="textSecondary" style={{ textAlign: 'center' }}>
                {isHidden
                  ? 'Requests that may be offensive or spam show up here.'
                  : "You don't have any message requests."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isHidden ? null : (
            <Pressable
              onPress={() => router.push({ pathname: '/direct/requests', params: { hidden: '1' } })}
              accessibilityRole="button"
              style={[
                styles.hiddenRow,
                { padding: spacing.lg, gap: spacing.md, borderTopColor: colors.separator },
              ]}
            >
              <Icon name="eyeOff" size={22} />
              <Text variant="bodyBold" style={{ flex: 1 }}>
                Hidden requests
              </Text>
              {badge.data?.hidden ? <Text color="textSecondary">{badge.data.hidden}</Text> : null}
              <Icon name="chevronRight" size={18} color={colors.textSecondary} />
            </Pressable>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center' },
  hiddenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
