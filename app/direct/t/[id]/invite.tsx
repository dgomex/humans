import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionGroup, ActionRow, Button, Text, useToast } from '@/components';
import { directError, useThreadInfo, useThreadRpc } from '@/features/direct/api';
import { inviteUrl } from '@/features/direct/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/**
 * Page 78 — Invite link + QR. Admins create, reset (old link stops working) or turn it off;
 * members can share an existing link. ≤250 joins per link per day.
 */
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const info = useThreadInfo(id);
  const rpc = useThreadRpc();
  const t = info.data;
  const admin = t?.me.role === 'admin';
  const link = t?.invite_token ? inviteUrl(t.invite_token) : null;

  const create = () =>
    rpc.mutate(
      { fn: 'create_thread_invite', args: { p_thread: id }, threadId: id },
      { onError: (e) => toast.show(directError(e)) },
    );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Invite link" center />
      {!t ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : !link ? (
        <View style={{ padding: spacing.xl, gap: spacing.md, alignItems: 'center' }}>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            Anyone with the link can join this group
            {t.approval_required ? ' after an admin approves them' : ''}.
          </Text>
          {admin ? (
            <Button title="Create invite link" loading={rpc.isPending} onPress={create} />
          ) : (
            <Text color="textSecondary">Only admins can create a link.</Text>
          )}
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
            <View style={{ padding: spacing.md, backgroundColor: '#FFFFFF', borderRadius: 16 }}>
              <QRCode value={link} size={200} />
            </View>
            <Text selectable color="link" style={{ textAlign: 'center' }}>
              {link}
            </Text>
          </View>
          <ActionGroup>
            <ActionRow
              icon="copy"
              label="Copy link"
              onPress={() =>
                void Clipboard.setStringAsync(link).then(() => toast.show('Link copied'))
              }
            />
            <ActionRow
              icon="share"
              label="Share link"
              onPress={() => void Share.share({ message: link, url: link })}
            />
            {admin ? (
              <ActionRow
                icon="replay"
                label="Reset link"
                detail="The current link will stop working"
                onPress={() =>
                  showDialog('Reset link?', 'People with the current link won’t be able to join.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', onPress: create },
                  ])
                }
              />
            ) : null}
            {admin ? (
              <ActionRow
                icon="block"
                label="Turn off link"
                destructive
                onPress={() =>
                  rpc.mutate(
                    { fn: 'disable_thread_invite', args: { p_thread: id }, threadId: id },
                    { onError: (e) => toast.show(directError(e)) },
                  )
                }
              />
            ) : null}
          </ActionGroup>
        </View>
      )}
    </SafeAreaView>
  );
}
