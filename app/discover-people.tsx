import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, useToast } from '@/components';
import { activityKeys, useDiscoverPeople } from '@/features/activity/api';
import { SuggestionRow } from '@/features/activity/components/Suggestions';
import { followKeys } from '@/features/follows/api';
import { syncContacts } from '@/features/onboarding/contacts';
import type { FollowStatus } from '@/features/profile/api';
import { TopBar } from '@/features/profile/components/TopBar';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Page 73 — Discover people: Connect contacts card + ranked suggestions with reasons. */
export default function DiscoverPeopleScreen() {
  const { colors, spacing, radius, hairline } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const people = useDiscoverPeople();
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Contacts are "connected" once at least one hashed address was synced (page 11).
  const contacts = useQuery({
    queryKey: ['contacts', 'connected'],
    enabled: Platform.OS !== 'web',
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contact_hashes')
        .select('hash', { count: 'exact', head: true });
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const list = useMemo(() => {
    const seen = new Set<string>();
    return (people.data?.pages.flat() ?? []).filter((p) => !seen.has(p.id) && !!seen.add(p.id));
  }, [people.data]);

  async function connect() {
    setConnecting(true);
    try {
      const n = await syncContacts();
      if (n === null) {
        toast.show('Allow access to contacts in Settings to find people you know.');
      } else {
        await contacts.refetch();
        await qc.resetQueries({ queryKey: activityKeys.discover });
        void qc.invalidateQueries({ queryKey: followKeys.suggestions });
      }
    } catch {
      toast.show("Couldn't sync contacts. Try again later.");
    } finally {
      setConnecting(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setStatus({});
    await qc.resetQueries({ queryKey: activityKeys.discover });
    setRefreshing(false);
  }

  const contactCard =
    contacts.data === false ? (
      <View
        style={{
          margin: spacing.lg,
          padding: spacing.lg,
          borderRadius: radius.md,
          borderWidth: hairline * 2,
          borderColor: colors.separator,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Icon name="contacts" size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold">Connect contacts</Text>
          <Text color="textSecondary">Follow people you know.</Text>
        </View>
        <Button title="Connect" size="sm" loading={connecting} onPress={connect} />
      </View>
    ) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Discover people" center />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <>
            {contactCard}
            {list.length > 0 ? (
              <Text
                variant="bodyBold"
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.xs,
                }}
              >
                All suggestions
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          people.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : people.isError ? (
            <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
              <Text color="textSecondary">{"Couldn't load suggestions."}</Text>
              <Button title="Try again" variant="secondary" onPress={() => people.refetch()} />
            </View>
          ) : (
            <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
              No suggestions right now.
            </Text>
          )
        }
        ListFooterComponent={
          people.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null
        }
        onEndReached={() => {
          if (people.hasNextPage && !people.isFetchingNextPage) void people.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <SuggestionRow
            account={item}
            status={status[item.id] ?? 'none'}
            onStatus={(s) => setStatus((m) => ({ ...m, [item.id]: s }))}
          />
        )}
      />
    </SafeAreaView>
  );
}
