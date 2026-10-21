import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import type { InboxThread } from '../api';
import { isActiveNow, previewText, shortTime, threadTitle } from '../format';
import { ThreadAvatar } from './ThreadAvatar';

/** Inbox / requests row (pages 74 / 75): picture, name, preview · age, unread dot, mute, 📷. */
export function ThreadRow({
  thread,
  me,
  lastActive,
  onPress,
  onLongPress,
  onCamera,
  onMute,
  onDelete,
}: {
  thread: InboxThread;
  me: string;
  lastActive?: string | null;
  onPress: () => void;
  onLongPress?: () => void;
  onCamera?: () => void;
  onMute?: () => void;
  onDelete?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const title = threadTitle(thread);
  const names = Object.fromEntries(thread.members.map((m) => [m.id, m.nickname || m.username]));
  const unread = thread.unread && thread.my_status !== 'left';
  const preview =
    thread.my_status === 'left'
      ? 'You left the group'
      : previewText(thread, thread.last_message, me, names);
  const status =
    thread.last_message?.sender_id === me && thread.my_status === 'active'
      ? thread.seen
        ? 'Seen'
        : null
      : null;
  const active = thread.kind === 'direct' && isActiveNow(lastActive);

  const row = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      // The 📷 is its own button; web forbids nested <button>s.
      accessibilityRole={onCamera ? undefined : 'button'}
      accessibilityLabel={`${title}. ${preview}${unread ? '. Unread' : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.md,
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}
    >
      <ThreadAvatar
        kind={thread.kind}
        photoPath={thread.photo_path}
        members={thread.members}
        active={active}
      />
      <View style={styles.text}>
        <Text variant={unread ? 'bodyBold' : 'body'} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.previewLine}>
          <Text
            variant={unread ? 'bodyBold' : 'body'}
            color={unread ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={styles.preview}
          >
            {status && !unread ? status : preview}
          </Text>
          <Text color="textSecondary" numberOfLines={1} style={styles.age}>
            {` · ${shortTime(thread.last_message_at)}`}
          </Text>
        </View>
      </View>
      <View style={[styles.trailing, { gap: spacing.md }]}>
        {thread.pinned_at ? <Icon name="pin" size={16} color={colors.textSecondary} /> : null}
        {thread.muted ? <Icon name="bellOff" size={16} color={colors.textSecondary} /> : null}
        {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        {onCamera ? (
          <Pressable
            onPress={onCamera}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Send a photo to ${title}`}
          >
            <Icon name="camera" size={26} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );

  if (!onMute && !onDelete) return row;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_p, _t, swipeable) => (
        <View style={styles.actions}>
          {onMute ? (
            <SwipeAction
              label={thread.muted ? 'Unmute' : 'Mute'}
              color={colors.textSecondary}
              onPress={() => {
                swipeable.close();
                onMute();
              }}
            />
          ) : null}
          {onDelete ? (
            <SwipeAction
              label="Delete"
              color={colors.danger}
              onPress={() => {
                swipeable.close();
                onDelete();
              }}
            />
          ) : null}
          {onLongPress ? (
            <SwipeAction
              label="More"
              color={colors.backgroundPressed}
              onPress={() => {
                swipeable.close();
                onLongPress();
              }}
            />
          ) : null}
        </View>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

function SwipeAction({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.action, { backgroundColor: color }]}
    >
      <Text variant="bodyBold" style={{ color: colors.onPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  previewLine: { flexDirection: 'row', alignItems: 'center' },
  preview: { flexShrink: 1 },
  age: { flexShrink: 0 },
  trailing: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row' },
  action: { width: 76, alignItems: 'center', justifyContent: 'center' },
});
