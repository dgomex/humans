import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAnswerFollowRequest, useFollowRequests } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/**
 * STUB of page 072 (Follow requests, Phase 8): lets a private account Confirm / Delete
 * requests until the Activity feed exists.
 */
export default function FollowRequestsScreen() {
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const me = auth.session?.user.id;
  const requests = useFollowRequests(me);
  const answer = useAnswerFollowRequest();
  const [answered, setAnswered] = useState<Record<string, 'confirmed' | 'deleted'>>({});

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Follow requests" center />
      <FlatList
        data={requests.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          requests.isPending ? (
            <ActivityIndicator />
          ) : (
            <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
              No follow requests.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const done = answered[item.id];
          const reply = (approve: boolean) => {
            if (!me) return;
            setAnswered((a) => ({ ...a, [item.id]: approve ? 'confirmed' : 'deleted' }));
            answer.mutate(
              { me, requesterId: item.id, approve },
              {
                onError: () => {
                  setAnswered(({ [item.id]: _, ...rest }) => rest);
                  toast.show("Couldn't update the request.");
                },
              },
            );
          };
          return (
            <UserRow
              username={item.username}
              subtitle={item.full_name}
              avatarUri={avatarUrl(item.avatar_path)}
              avatarSize={52}
              onPress={() => openProfile(item.username)}
              trailing={
                done ? (
                  <Text color="textSecondary">
                    {done === 'confirmed' ? 'Confirmed' : 'Request removed'}
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button title="Confirm" size="sm" onPress={() => reply(true)} />
                    <Button
                      title="Delete"
                      variant="secondary"
                      size="sm"
                      onPress={() => reply(false)}
                    />
                  </View>
                )
              }
            />
          );
        }}
      />
    </SafeAreaView>
  );
}
