import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, useToast } from '@/components';
import { directError, useThreadInfo, useThreadRpc } from '@/features/direct/api';
import { PeoplePicker, type PickedPerson } from '@/features/direct/components/PeoplePicker';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Page 79 → Add people (needs admin approval when "Approve new members" is on). */
export default function AddPeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const info = useThreadInfo(id);
  const rpc = useThreadRpc();
  const [selected, setSelected] = useState<PickedPerson[]>([]);
  const current = (info.data?.members ?? []).filter((m) => m.status !== 'left').map((m) => m.id);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Add people" center />
      <PeoplePicker
        selected={selected}
        onChange={setSelected}
        exclude={current}
        max={250 - current.length}
      />
      {selected.length ? (
        <View style={{ padding: spacing.lg }}>
          <Button
            title={
              info.data?.approval_required && info.data.me.role !== 'admin'
                ? 'Send to admins'
                : 'Add'
            }
            loading={rpc.isPending}
            onPress={() =>
              rpc.mutate(
                {
                  fn: 'add_thread_members',
                  args: { p_thread: id, p_members: selected.map((s) => s.id) },
                  threadId: id,
                },
                {
                  onSuccess: (r) => {
                    toast.show(r === 'requested' ? 'An admin needs to approve them.' : 'Added');
                    goBack('/direct');
                  },
                  onError: (e) => toast.show(directError(e)),
                },
              )
            }
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
