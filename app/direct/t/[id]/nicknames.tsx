import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Button, Icon, TextField, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { directError, useThreadInfo, useThreadRpc, type ThreadMember } from '@/features/direct/api';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/** Page 79 → Nicknames: set what everyone in the chat sees for each person. */
export default function NicknamesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const info = useThreadInfo(id);
  const rpc = useThreadRpc();
  const [edit, setEdit] = useState<{ member: ThreadMember; value: string } | null>(null);
  const members = (info.data?.members ?? []).filter((m) => m.status !== 'left');

  function save(value: string) {
    if (!edit) return;
    const m = edit.member;
    setEdit(null);
    rpc.mutate(
      { fn: 'set_nickname', args: { p_thread: id, p_user: m.id, p_nickname: value }, threadId: id },
      { onError: (e) => toast.show(directError(e)) },
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Nicknames" center />
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <UserRow
            username={
              item.nickname ?? (item.id === profile?.id ? `${item.username} (you)` : item.username)
            }
            subtitle={item.nickname ? item.username : 'Set nickname'}
            avatarUri={avatarUrl(item.avatar_path)}
            onPress={() => setEdit({ member: item, value: item.nickname ?? '' })}
            trailing={<Icon name="edit" size={18} color={colors.textSecondary} />}
          />
        )}
      />
      <BottomSheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Nickname for ${edit.member.username}` : undefined}
      >
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TextField
            label="Nickname"
            value={edit?.value ?? ''}
            onChangeText={(v) => setEdit((e) => (e ? { ...e, value: v } : e))}
            maxLength={50}
            hint="Everyone in the chat will see this."
          />
          <Button title="Save" onPress={() => save(edit?.value ?? '')} />
          {edit?.member.nickname ? (
            <Button title="Remove nickname" variant="secondary" onPress={() => save('')} />
          ) : null}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
