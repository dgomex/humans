import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionGroup, ActionRow, BottomSheet, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  directError,
  openDirect,
  useThreadInfo,
  useThreadRpc,
  type ThreadMember,
} from '@/features/direct/api';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/** Page 79 → Members: admins first; admins can make / remove admins and remove people. */
export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const toast = useToast();
  const info = useThreadInfo(id);
  const rpc = useThreadRpc();
  const [sheet, setSheet] = useState<ThreadMember | null>(null);
  const t = info.data;
  const admin = t?.me.role === 'admin' && t.me.status === 'active';
  const members = (t?.members ?? [])
    .filter((m) => m.status !== 'left')
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1));

  const run = (fn: 'set_thread_admin' | 'remove_thread_member', args: Record<string, unknown>) =>
    rpc.mutate({ fn, args, threadId: id }, { onError: (e) => toast.show(directError(e)) });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Members"
        center
        right={
          t?.me.status === 'active' ? (
            <TopBarButton
              icon="personAdd"
              label="Add people"
              onPress={() => router.push(`/direct/t/${id}/add`)}
            />
          ) : null
        }
      />
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <UserRow
            username={item.id === me ? `${item.username} (you)` : item.username}
            subtitle={[item.full_name, item.nickname ? `“${item.nickname}”` : null]
              .filter(Boolean)
              .join(' · ')}
            detail={
              item.role === 'admin'
                ? 'Admin'
                : item.status === 'request'
                  ? 'Hasn’t accepted yet'
                  : null
            }
            avatarUri={avatarUrl(item.avatar_path)}
            onPress={item.id === me ? undefined : () => setSheet(item)}
          />
        )}
        ListFooterComponent={<View style={{ height: spacing.xl }} />}
      />
      <BottomSheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet?.username}>
        {sheet ? (
          <ActionGroup>
            <ActionRow
              icon="profile"
              label="View profile"
              onPress={() => {
                setSheet(null);
                openProfile(sheet.username);
              }}
            />
            <ActionRow
              icon="messenger"
              label="Message"
              onPress={() => {
                setSheet(null);
                void openDirect(sheet.id).catch(() => toast.show("Couldn't open the chat."));
              }}
            />
            {admin ? (
              <ActionRow
                icon="admin"
                label={sheet.role === 'admin' ? 'Remove as admin' : 'Make admin'}
                onPress={() => {
                  setSheet(null);
                  run('set_thread_admin', {
                    p_thread: id,
                    p_user: sheet.id,
                    p_admin: sheet.role !== 'admin',
                  });
                }}
              />
            ) : null}
            {admin ? (
              <ActionRow
                icon="remove"
                label="Remove from group"
                destructive
                onPress={() => {
                  const m = sheet;
                  setSheet(null);
                  showDialog(
                    `Remove ${m.username}?`,
                    "They won't see new messages in this group.",
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => run('remove_thread_member', { p_thread: id, p_user: m.id }),
                      },
                    ],
                  );
                }}
              />
            ) : null}
          </ActionGroup>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
