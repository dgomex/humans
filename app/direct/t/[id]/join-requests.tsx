import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, UserRow, useToast } from '@/components';
import {
  directError,
  directKeys,
  useJoinRequests,
  useThreadInfo,
  useThreadRpc,
} from '@/features/direct/api';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/** Page 78 / 79 — Requests to join (admins, "Approve new members" on). */
export default function JoinRequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const info = useThreadInfo(id);
  const requests = useJoinRequests(id, info.data?.me.role === 'admin');
  const rpc = useThreadRpc();

  const answer = (user: string, approve: boolean) =>
    rpc.mutate(
      {
        fn: 'answer_join_request',
        args: { p_thread: id, p_user: user, p_approve: approve },
        threadId: id,
      },
      {
        onSuccess: () => void qc.invalidateQueries({ queryKey: directKeys.joinRequests(id) }),
        onError: (e) => toast.show(directError(e)),
      },
    );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Requests to join" center />
      <FlatList
        data={requests.data ?? []}
        keyExtractor={(r) => r.user_id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <UserRow
            username={item.username}
            subtitle={
              item.added_by_username ? `Added by ${item.added_by_username}` : 'Via invite link'
            }
            avatarUri={avatarUrl(item.avatar_path)}
            trailing={
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Approve" size="sm" onPress={() => answer(item.user_id, true)} />
                <Button
                  title="Decline"
                  size="sm"
                  variant="secondary"
                  onPress={() => answer(item.user_id, false)}
                />
              </View>
            }
          />
        )}
        ListEmptyComponent={
          requests.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ padding: spacing.xl, textAlign: 'center' }}>
              No requests to join.
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}
