import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Button,
  Icon,
  Text,
  TextField,
  useToast,
  type IconName,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  directError,
  invalidateThread,
  setGroupPhoto,
  updateMyMembership,
  useThreadInfo,
  useThreadRpc,
} from '@/features/direct/api';
import { ThreadAvatar } from '@/features/direct/components/ThreadAvatar';
import { infoTitle, isMuted, MUTE_OPTIONS, muteUntil, THEMES } from '@/features/direct/format';
import { pickAvatar } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Page 79 — Chat details / settings (1:1 and groups). */
export default function ThreadDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const toast = useToast();
  const qc = useQueryClient();
  const info = useThreadInfo(id);
  const rpc = useThreadRpc();
  const [muteSheet, setMuteSheet] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const t = info.data;

  if (!t)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <TopBar title="Details" center />
        {info.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      </SafeAreaView>
    );

  const active = t.me.status === 'active';
  const group = t.kind === 'group';
  const admin = t.me.role === 'admin';
  const others = t.members.filter((m) => m.id !== me && m.status !== 'left');
  const other = !group ? others[0] : undefined;
  const muted = isMuted(t.me.muted_until);

  const call = (
    fn: Parameters<typeof rpc.mutate>[0]['fn'],
    args: Record<string, unknown>,
    done?: string,
  ) =>
    rpc.mutate(
      { fn, args, threadId: id },
      { onSuccess: () => done && toast.show(done), onError: (e) => toast.show(directError(e)) },
    );

  async function setMine(patch: Parameters<typeof updateMyMembership>[2], done?: string) {
    try {
      await updateMyMembership(id, me, patch);
      invalidateThread(qc, id);
      if (done) toast.show(done);
    } catch {
      toast.show("Couldn't update the chat.");
    }
  }

  const soon = (what: string) => toast.show(`${what} arrives with privacy settings (Phase 11).`);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Details" center />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={[styles.top, { padding: spacing.xl, gap: spacing.xs }]}>
          <Pressable
            disabled={!group || !active}
            onPress={async () => {
              const uri = await pickAvatar('library').catch(() => null);
              if (!uri) return;
              setGroupPhoto(id, uri)
                .then(() => invalidateThread(qc, id))
                .catch(() => toast.show("Couldn't change the photo."));
            }}
            accessibilityRole="button"
            accessibilityLabel={group ? 'Change group photo' : undefined}
          >
            <ThreadAvatar kind={t.kind} photoPath={t.photo_path} members={others} size={88} />
          </Pressable>
          <Text variant="headline" style={{ marginTop: spacing.sm }}>
            {infoTitle(t, me)}
          </Text>
          {other ? <Text color="textSecondary">{other.username}</Text> : null}
          {group && active ? (
            <Pressable
              onPress={() => setRename(t.title ?? '')}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text variant="bodyBold" color="primary">
                Change name
              </Text>
            </Pressable>
          ) : null}
        </View>

        {active ? (
          <View style={[styles.buttons, { gap: spacing.lg, paddingBottom: spacing.lg }]}>
            <RoundButton
              icon="phone"
              label="Audio"
              onPress={() => toast.show('Calls are coming soon')}
            />
            <RoundButton
              icon="videoCall"
              label="Video"
              onPress={() => toast.show('Calls are coming soon')}
            />
            {other ? (
              <RoundButton
                icon="profile"
                label="Profile"
                onPress={() => openProfile(other.username)}
              />
            ) : (
              <RoundButton
                icon="personAdd"
                label="Add"
                onPress={() => router.push(`/direct/t/${id}/add`)}
              />
            )}
            <RoundButton
              icon={muted ? 'bellOff' : 'bell'}
              label={muted ? 'Unmute' : 'Mute'}
              onPress={() =>
                muted ? void setMine({ muted_until: null }, 'Unmuted') : setMuteSheet(true)
              }
            />
            <RoundButton
              icon="search"
              label="Search"
              onPress={() =>
                router.push({
                  pathname: '/direct/t/[id]/filtered',
                  params: { id, filter: 'search' },
                })
              }
            />
          </View>
        ) : null}

        {active ? (
          <ActionGroup>
            <ActionRow
              icon="palette"
              label="Theme"
              detail={THEMES[t.theme]?.label}
              onPress={() => router.push(`/direct/t/${id}/theme`)}
            />
            <ActionRow
              icon="nickname"
              label="Nicknames"
              onPress={() => router.push(`/direct/t/${id}/nicknames`)}
            />
            {!group ? (
              <ActionRow
                icon="vanish"
                label="Vanish mode"
                detail="Seen messages disappear when you close the chat"
                disabled={t.request_pending}
                trailing={
                  <Switch
                    value={t.vanish_mode}
                    disabled={t.request_pending}
                    onValueChange={(on) => call('set_vanish_mode', { p_thread: id, p_on: on })}
                  />
                }
              />
            ) : null}
            <ActionRow
              icon="eye"
              label="Read receipts"
              detail="When off, people won't see when you've read their messages — and you won't see theirs"
              trailing={
                <Switch
                  value={t.me.read_receipts}
                  onValueChange={(on) => void setMine({ read_receipts: on })}
                />
              }
            />
          </ActionGroup>
        ) : null}

        <SectionTitle title="Shared" />
        <ActionGroup>
          <ActionRow
            icon="pin"
            label="Pinned messages"
            detail={t.pinned_count ? `${t.pinned_count} pinned` : 'None'}
            onPress={() =>
              router.push({ pathname: '/direct/t/[id]/filtered', params: { id, filter: 'pinned' } })
            }
          />
          <ActionRow
            icon="image"
            label="Media, links and posts"
            onPress={() =>
              router.push({ pathname: '/direct/t/[id]/filtered', params: { id, filter: 'media' } })
            }
          />
          {t.scheduled_count ? (
            <ActionRow
              icon="schedule"
              label="Scheduled messages"
              detail={`${t.scheduled_count}`}
              onPress={() =>
                router.push({
                  pathname: '/direct/t/[id]/filtered',
                  params: { id, filter: 'scheduled' },
                })
              }
            />
          ) : null}
        </ActionGroup>

        {group ? (
          <>
            <SectionTitle title="Group" />
            <ActionGroup>
              <ActionRow
                icon="people"
                label={`Members (${others.length + (t.me.status !== 'left' ? 1 : 0)})`}
                onPress={() => router.push(`/direct/t/${id}/members`)}
              />
              {active ? (
                <ActionRow
                  icon="personAdd"
                  label="Add people"
                  onPress={() => router.push(`/direct/t/${id}/add`)}
                />
              ) : null}
              {active && (admin || t.invite_token) ? (
                <ActionRow
                  icon="link"
                  label="Invite link"
                  onPress={() => router.push(`/direct/t/${id}/invite`)}
                />
              ) : null}
              {admin && active ? (
                <ActionRow
                  icon="admin"
                  label="Approve new members"
                  detail="Admins approve people before they join"
                  trailing={
                    <Switch
                      value={t.approval_required}
                      onValueChange={(on) =>
                        call('set_thread_approval', { p_thread: id, p_on: on })
                      }
                    />
                  }
                />
              ) : null}
              {admin && t.join_request_count ? (
                <ActionRow
                  icon="personAddFilled"
                  label="Requests to join"
                  detail={`${t.join_request_count} waiting`}
                  onPress={() => router.push(`/direct/t/${id}/join-requests`)}
                />
              ) : null}
            </ActionGroup>
          </>
        ) : !group && active ? (
          <ActionGroup>
            <ActionRow
              icon="people"
              label={`Create a group chat with ${other?.username ?? ''}`}
              onPress={() => router.push('/direct/new')}
            />
          </ActionGroup>
        ) : null}

        <SectionTitle title="Privacy & safety" />
        <ActionGroup>
          {other ? (
            <>
              <ActionRow
                icon="restrict"
                label="Restrict"
                detail="Coming soon"
                onPress={() => soon('Restricting')}
              />
              <ActionRow
                icon="block"
                label="Block"
                detail="Coming soon"
                destructive
                onPress={() => soon('Blocking')}
              />
            </>
          ) : null}
          <ActionRow
            icon="report"
            label="Report"
            destructive
            onPress={() =>
              router.push({
                pathname: '/report',
                params: group ? { type: 'thread', id } : { type: 'profile', id: other?.id ?? '' },
              })
            }
          />
          {group && t.me.status !== 'left' ? (
            <ActionRow
              icon="leave"
              label="Leave chat"
              destructive
              onPress={() =>
                showDialog(
                  'Leave chat?',
                  "You won't get messages from this group unless someone adds you back.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Leave',
                      style: 'destructive',
                      onPress: () =>
                        rpc.mutate(
                          { fn: 'leave_thread', args: { p_thread: id }, threadId: id },
                          { onError: (e) => toast.show(directError(e)) },
                        ),
                    },
                  ],
                )
              }
            />
          ) : null}
          <ActionRow
            icon="trash"
            label="Delete chat"
            destructive
            onPress={() =>
              showDialog('Delete chat?', 'This deletes the chat for you only.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    rpc.mutate(
                      { fn: 'clear_thread', args: { p_thread: id }, threadId: id },
                      { onSuccess: () => goBack('/direct') },
                    ),
                },
              ])
            }
          />
        </ActionGroup>
      </ScrollView>

      <BottomSheet visible={muteSheet} onClose={() => setMuteSheet(false)} title="Mute messages">
        <ActionGroup>
          {MUTE_OPTIONS.map((o) => (
            <ActionRow
              key={o.label}
              label={o.label}
              onPress={() => {
                setMuteSheet(false);
                void setMine({ muted_until: muteUntil(o.ms) }, 'Muted');
              }}
            />
          ))}
        </ActionGroup>
      </BottomSheet>
      <BottomSheet
        visible={rename !== null}
        onClose={() => setRename(null)}
        title="Change group name"
      >
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TextField
            label="Group name"
            value={rename ?? ''}
            onChangeText={setRename}
            maxLength={100}
            autoFocus
          />
          <Button
            title="Save"
            onPress={() => {
              const v = rename;
              setRename(null);
              call('rename_thread', { p_thread: id, p_title: v ?? '' });
            }}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignItems: 'center', gap: spacing.xs }}
    >
      <View style={[styles.round, { backgroundColor: colors.backgroundSecondary }]}>
        <Icon name={icon} size={22} />
      </View>
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { spacing } = useTheme();
  return (
    <Text
      variant="captionBold"
      color="textSecondary"
      style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs }}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'center' },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
