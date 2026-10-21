import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Button,
  Icon,
  SearchField,
  Text,
  useToast,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  AccountSwitcherProvider,
  useAccountSwitcher,
} from '@/features/auth/components/AccountSwitcher';
import {
  directKeys,
  updateMyMembership,
  useDirectBadge,
  useInbox,
  usePresence,
  type InboxThread,
} from '@/features/direct/api';
import { NotesRow } from '@/features/direct/components/Notes';
import { ThreadRow } from '@/features/direct/components/ThreadRow';
import { MUTE_OPTIONS, muteUntil, threadTitle } from '@/features/direct/format';
import { TopBarButton } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

/** Page 74 — Inbox: notes row, chats (pinned first), Requests link, search, realtime. */
export default function InboxScreen() {
  return (
    <AccountSwitcherProvider>
      <Inbox />
    </AccountSwitcherProvider>
  );
}

function Inbox() {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const qc = useQueryClient();
  const toast = useToast();
  const switcher = useAccountSwitcher();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 250);
  const inbox = useInbox('inbox', query);
  const badge = useDirectBadge();
  const [menu, setMenu] = useState<InboxThread | null>(null);
  const [muteFor, setMuteFor] = useState<InboxThread | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const threads = useMemo(() => inbox.data?.pages.flat() ?? [], [inbox.data]);
  const presence = usePresence(
    threads.filter((t) => t.kind === 'direct' && t.members[0]).map((t) => t.members[0].id),
  );

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: directKeys.inboxAll });
    void qc.invalidateQueries({ queryKey: directKeys.badge });
  };

  async function change(
    t: InboxThread,
    patch: Parameters<typeof updateMyMembership>[2],
    done?: string,
  ) {
    try {
      await updateMyMembership(t.id, me, patch);
      refreshAll();
      if (done) toast.show(done);
    } catch (e) {
      toast.show(
        (e as Error).message?.includes('pin_limit')
          ? 'You can only pin 3 chats.'
          : "Couldn't update the chat.",
      );
    }
  }

  function remove(t: InboxThread) {
    showDialog(
      'Delete chat?',
      'This will delete the chat for you only. Others in the chat will still see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('clear_thread', { p_thread: t.id });
            if (error) toast.show("Couldn't delete the chat.");
            refreshAll();
          },
        },
      ],
    );
  }

  async function refresh() {
    setRefreshing(true);
    await qc.resetQueries({ queryKey: directKeys.inbox('inbox', query) });
    void qc.invalidateQueries({ queryKey: directKeys.notes });
    void qc.invalidateQueries({ queryKey: directKeys.badge });
    setRefreshing(false);
  }

  const requests = badge.data?.requests ?? 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md, gap: spacing.md }]}>
        <TopBarButton icon="back" label="Back" onPress={() => goBack('/')} />
        <Pressable
          onPress={switcher.open}
          style={[styles.title, { gap: 4 }]}
          accessibilityRole="button"
          accessibilityLabel="Switch accounts"
        >
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {profile?.username}
          </Text>
          <Icon name="down" size={18} />
        </Pressable>
        <TopBarButton
          icon="compose"
          label="New message"
          onPress={() => router.push('/direct/new')}
        />
      </View>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage();
        }}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <SearchField value={search} onChangeText={setSearch} />
            </View>
            {query ? null : <NotesRow />}
            <View
              style={[
                styles.sectionRow,
                { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
              ]}
            >
              <Text variant="subhead">Messages</Text>
              <Pressable
                onPress={() => router.push('/direct/requests')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Requests${requests ? `, ${requests}` : ''}`}
              >
                <Text variant="bodyBold" color={requests ? 'primary' : 'textSecondary'}>
                  Requests{requests ? ` (${requests})` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ThreadRow
            thread={item}
            me={me}
            lastActive={item.kind === 'direct' ? presence.data?.[item.members[0]?.id] : null}
            onPress={() => router.push(`/direct/t/${item.id}`)}
            onLongPress={() => setMenu(item)}
            onCamera={
              item.my_status === 'active'
                ? () =>
                    router.push({
                      pathname: '/direct/t/[id]',
                      params: { id: item.id, camera: '1' },
                    })
                : undefined
            }
            onMute={
              item.my_status === 'active'
                ? () =>
                    item.muted ? change(item, { muted_until: null }, 'Unmuted') : setMuteFor(item)
                : undefined
            }
            onDelete={() => remove(item)}
          />
        )}
        ListEmptyComponent={
          inbox.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : inbox.isError ? (
            <View style={[styles.empty, { padding: spacing.xl, gap: spacing.md }]}>
              <Text color="textSecondary">Couldn&apos;t load your messages.</Text>
              <Button title="Retry" variant="secondary" onPress={() => void inbox.refetch()} />
            </View>
          ) : query ? (
            <Text color="textSecondary" style={{ padding: spacing.xl, textAlign: 'center' }}>
              No chats found.
            </Text>
          ) : (
            <View style={[styles.empty, { padding: spacing.xl, gap: spacing.md }]}>
              <View style={[styles.emptyIcon, { borderColor: colors.text }]}>
                <Icon name="messenger" size={44} />
              </View>
              <Text variant="headline">Message your friends</Text>
              <Text color="textSecondary" style={{ textAlign: 'center' }}>
                Send private messages, photos and posts to friends and groups.
              </Text>
              <Button title="Send message" onPress={() => router.push('/direct/new')} />
            </View>
          )
        }
        ListFooterComponent={
          inbox.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null
        }
      />

      {/* Long-press / swipe "More" (page 74). */}
      <BottomSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={menu ? threadTitle(menu) : undefined}
      >
        {menu ? (
          <ActionGroup>
            {menu.my_status === 'active' ? (
              <ActionRow
                icon={menu.pinned_at ? 'pinOff' : 'pin'}
                label={menu.pinned_at ? 'Unpin' : 'Pin'}
                onPress={() => {
                  const t = menu;
                  setMenu(null);
                  void change(t, { pinned_at: t.pinned_at ? null : new Date().toISOString() });
                }}
              />
            ) : null}
            {menu.my_status === 'active' ? (
              <ActionRow
                icon={menu.muted ? 'bell' : 'bellOff'}
                label={menu.muted ? 'Unmute messages' : 'Mute messages'}
                onPress={() => {
                  const t = menu;
                  setMenu(null);
                  if (t.muted) void change(t, { muted_until: null }, 'Unmuted');
                  else setMuteFor(t);
                }}
              />
            ) : null}
            <ActionRow
              icon="chat"
              label={menu.unread ? 'Mark as read' : 'Mark as unread'}
              onPress={() => {
                const t = menu;
                setMenu(null);
                if (t.unread)
                  void supabase.rpc('mark_thread_read', { p_thread: t.id }).then(refreshAll);
                else void change(t, { marked_unread: true });
              }}
            />
            <ActionRow
              icon="trash"
              label="Delete"
              destructive
              onPress={() => {
                const t = menu;
                setMenu(null);
                remove(t);
              }}
            />
          </ActionGroup>
        ) : null}
      </BottomSheet>
      <BottomSheet visible={!!muteFor} onClose={() => setMuteFor(null)} title="Mute messages">
        <ActionGroup>
          {MUTE_OPTIONS.map((o) => (
            <ActionRow
              key={o.label}
              label={o.label}
              onPress={() => {
                const t = muteFor!;
                setMuteFor(null);
                void change(t, { muted_until: muteUntil(o.ms) }, 'Muted');
              }}
            />
          ))}
        </ActionGroup>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center' },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
