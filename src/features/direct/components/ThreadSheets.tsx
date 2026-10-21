import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Button,
  Icon,
  Text,
  UserRow,
  type IconName,
} from '@/components';
import type { ComposerItem } from '@/features/create/types';
import { avatarUrl } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

import type { Message, ThreadMember, ViewMode } from '../api';
import { olderThan, QUICK_REACTIONS } from '../format';

export type MenuAction =
  'reply' | 'forward' | 'copy' | 'edit' | 'pin' | 'unpin' | 'unsend' | 'save' | 'report';

/** Long-press on a message: quick reactions + actions (page 76). */
export function MessageMenu({
  message,
  me,
  canInteract,
  onClose,
  onReact,
  onAction,
}: {
  message: Message | null;
  me: string;
  canInteract: boolean;
  onClose: () => void;
  onReact: (m: Message, emoji: string) => void;
  onAction: (m: Message, a: MenuAction) => void;
}) {
  const { colors, spacing } = useTheme();
  if (!message)
    return (
      <BottomSheet visible={false} onClose={onClose}>
        {null}
      </BottomSheet>
    );
  const m = message;
  const mine = m.sender_id === me;
  const myReaction = m.reactions.find((r) => r.user_id === me)?.emoji;
  const editable =
    mine &&
    m.kind === 'text' &&
    !m.vanish &&
    !m.data?.story_reply &&
    (m.scheduled_for !== null || !olderThan(m.created_at, 15 * 60_000));
  const actions: { key: MenuAction; icon: IconName; label: string; destructive?: boolean }[] = [];
  if (canInteract && !m.scheduled_for)
    actions.push({ key: 'reply', icon: 'reply', label: 'Reply' });
  if (!m.vanish && m.view_mode === 'keep' && !m.scheduled_for)
    actions.push({ key: 'forward', icon: 'forwardMessage', label: 'Forward' });
  if (m.kind === 'text' && !m.vanish) actions.push({ key: 'copy', icon: 'copy', label: 'Copy' });
  if (editable) actions.push({ key: 'edit', icon: 'edit', label: 'Edit' });
  if (canInteract && !m.vanish && !m.scheduled_for)
    actions.push(
      m.pinned_at
        ? { key: 'unpin', icon: 'pinOff', label: 'Unpin' }
        : { key: 'pin', icon: 'pin', label: 'Pin' },
    );
  if (m.kind === 'media' && m.view_mode === 'keep' && !m.vanish)
    actions.push({ key: 'save', icon: 'download', label: 'Save' });
  if (mine)
    actions.push({
      key: 'unsend',
      icon: 'trash',
      label: m.scheduled_for ? 'Delete scheduled message' : 'Unsend',
      destructive: true,
    });
  else actions.push({ key: 'report', icon: 'report', label: 'Report', destructive: true });

  return (
    <BottomSheet visible onClose={onClose}>
      {canInteract && !m.scheduled_for ? (
        <View
          style={[styles.reactions, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}
        >
          {QUICK_REACTIONS.map((e) => (
            <Pressable
              key={e}
              onPress={() => onReact(m, e)}
              accessibilityRole="button"
              accessibilityLabel={`React ${e}`}
              style={[
                styles.emoji,
                myReaction === e && { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <Text style={{ fontSize: 30 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ActionGroup>
        {actions.map((a) => (
          <ActionRow
            key={a.key}
            icon={a.icon}
            label={a.label}
            destructive={a.destructive}
            onPress={() => onAction(m, a.key)}
          />
        ))}
      </ActionGroup>
    </BottomSheet>
  );
}

/** "Tap to see reactions": who reacted with what; tap your own to remove it. */
export function ReactionsSheet({
  message,
  members,
  me,
  onClose,
  onRemoveMine,
}: {
  message: Message | null;
  members: ThreadMember[];
  me: string;
  onClose: () => void;
  onRemoveMine: (m: Message) => void;
}) {
  const { spacing } = useTheme();
  const byId = Object.fromEntries(members.map((x) => [x.id, x]));
  return (
    <BottomSheet visible={!!message} onClose={onClose} title="Reactions">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
      >
        {(message?.reactions ?? []).map((r) => {
          const who = byId[r.user_id];
          const mine = r.user_id === me;
          return (
            <UserRow
              key={r.user_id}
              username={mine ? 'You' : (who?.username ?? 'Instagram User')}
              subtitle={mine ? 'Tap to remove' : who?.full_name}
              avatarUri={avatarUrl(who?.avatar_path)}
              onPress={mine && message ? () => onRemoveMine(message) : undefined}
              trailing={<Text style={{ fontSize: 24 }}>{r.emoji}</Text>}
            />
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const MODES: { key: ViewMode; icon: IconName; label: string; detail: string }[] = [
  { key: 'once', icon: 'viewOnce', label: 'View once', detail: 'Can be opened once' },
  { key: 'replay', icon: 'replay', label: 'Allow replay', detail: 'Can be opened twice' },
  { key: 'keep', icon: 'keepInChat', label: 'Keep in chat', detail: 'Stays in the chat' },
];

/**
 * Camera shots (📷) default to View once, like Instagram; gallery picks default to Keep in chat.
 * Lets you switch before sending (page 80).
 */
export function SendMediaSheet({
  items,
  defaultMode,
  sending,
  onClose,
  onSend,
}: {
  items: ComposerItem[] | null;
  defaultMode: ViewMode;
  sending: boolean;
  onClose: () => void;
  onSend: (mode: ViewMode) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [shown, setShown] = useState<ComposerItem[] | null>(null);
  if (items !== shown) {
    setShown(items);
    setMode(defaultMode);
  }
  return (
    <BottomSheet
      visible={!!items?.length}
      onClose={onClose}
      title={items && items.length > 1 ? `Send ${items.length} items` : 'Send'}
    >
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {(items ?? []).map((it) => (
            <View key={it.key}>
              <Image
                source={{ uri: it.uri }}
                style={{
                  width: 96,
                  height: 128,
                  borderRadius: radius.md,
                  backgroundColor: colors.skeleton,
                }}
                contentFit="cover"
              />
              {it.type === 'video' ? (
                <View style={styles.videoIcon}>
                  <Icon name="video" size={16} color={colors.onMedia} />
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <View style={[styles.modes, { gap: spacing.sm }]}>
          {MODES.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => setMode(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === o.key }}
              style={[
                styles.mode,
                {
                  borderRadius: radius.lg,
                  padding: spacing.sm,
                  borderColor: mode === o.key ? colors.primary : colors.separator,
                  backgroundColor: mode === o.key ? colors.backgroundSecondary : 'transparent',
                },
              ]}
            >
              <Icon name={o.icon} size={22} color={mode === o.key ? colors.primary : colors.icon} />
              <Text variant="captionBold">{o.label}</Text>
              <Text variant="tiny" color="textSecondary" style={{ textAlign: 'center' }}>
                {o.detail}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button title="Send" loading={sending} onPress={() => onSend(mode)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  reactions: { flexDirection: 'row', justifyContent: 'space-between' },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: { position: 'absolute', right: 6, top: 6 },
  modes: { flexDirection: 'row' },
  mode: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 1 },
});
