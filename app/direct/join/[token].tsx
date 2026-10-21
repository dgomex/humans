import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, useToast } from '@/components';
import { directError, directKeys, useInvitePreview } from '@/features/direct/api';
import { ThreadAvatar } from '@/features/direct/components/ThreadAvatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Group invite link / QR (page 78): preview, then Join (or Request to join with approval on). */
export default function JoinGroupScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const preview = useInvitePreview(token);
  const [busy, setBusy] = useState(false);
  const p = preview.data;
  const member =
    p?.my_status === 'active' || p?.my_status === 'request' || p?.my_status === 'hidden';

  async function join() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('join_thread_by_invite', { p_token: token });
      if (error) throw error;
      const r = data as { status: string; thread_id: string };
      void qc.invalidateQueries({ queryKey: directKeys.all });
      if (r.status === 'requested') {
        toast.show('Request sent. An admin needs to approve it.');
        void preview.refetch();
      } else router.replace(`/direct/t/${r.thread_id}`);
    } catch (e) {
      toast.show(directError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Group invite" center />
      {preview.isPending ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} />
      ) : !p ? (
        <Text color="textSecondary" style={{ padding: spacing.xl, textAlign: 'center' }}>
          This invite link is no longer active.
        </Text>
      ) : (
        <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <ThreadAvatar
            kind="group"
            photoPath={member ? p.photo_path : null}
            members={p.members}
            size={96}
          />
          <Text variant="headline">{p.title ?? p.members.map((m) => m.username).join(', ')}</Text>
          <Text color="textSecondary">{p.member_count} members</Text>
          {member ? (
            <Button title="Open chat" onPress={() => router.replace(`/direct/t/${p.thread_id}`)} />
          ) : p.requested ? (
            <Text color="textSecondary">Your request to join is waiting for an admin.</Text>
          ) : (
            <Button
              title={p.approval_required ? 'Request to join' : 'Join group'}
              loading={busy}
              onPress={() => void join()}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
