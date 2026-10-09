import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ActionGroup, ActionRow, Avatar, BottomSheet, Icon, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { avatarUrl } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

import { ringOf, useStoriesTray } from '../api';
import { useStoryUploads } from '../StoryUploads';
import { setStoryQueue } from '../viewerQueue';

const SIZE = 64;

/**
 * Page 43 tray (Phase 5): "Your story" (+ to add, progress ring while sharing, retry on failure),
 * then followed accounts with active stories — gradient ring = unseen, grey = seen, green =
 * Close Friends. Tapping opens the viewer (page 52) and swiping continues in tray order.
 */
export function StoriesTray() {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const tray = useStoriesTray();
  const uploads = useStoryUploads();
  const [failedSheet, setFailedSheet] = useState(false);

  const rows = tray.data ?? [];
  const own = rows.find((r) => r.is_own);
  const others = rows.filter((r) => !r.is_own);
  const active = uploads.jobs.filter((j) => j.stage !== 'failed' && j.stage !== 'done');
  const failed = uploads.jobs.filter((j) => j.stage === 'failed');
  const progress = active.length
    ? active.reduce((sum, j) => sum + j.progress, 0) / active.length
    : null;

  const open = (userId: string) => {
    setStoryQueue(rows.map((r) => r.user_id));
    router.push({ pathname: '/stories/[userId]', params: { userId } });
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.md,
        }}
      >
        <View style={styles.item}>
          <Pressable
            onPress={() => {
              if (failed.length) setFailedSheet(true);
              else if (own) open(own.user_id);
              else router.push('/story/camera');
            }}
            accessibilityRole="button"
            accessibilityLabel={own ? 'Your story' : 'Add to your story'}
          >
            <Avatar
              uri={avatarUrl(profile?.avatar_path)}
              size={SIZE}
              ring={own ? (own.has_close_friends ? 'closeFriends' : 'unseen') : 'none'}
            />
            {progress !== null ? <ProgressRing progress={progress} /> : null}
          </Pressable>
          <Pressable
            onPress={() => router.push('/story/camera')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Add to your story"
            style={[
              styles.plus,
              {
                backgroundColor: failed.length ? colors.danger : colors.primary,
                borderColor: colors.background,
              },
            ]}
          >
            <Icon name={failed.length ? 'alert' : 'add'} size={14} color={colors.onPrimary} />
          </Pressable>
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.label}>
            {progress !== null ? 'Sharing…' : failed.length ? "Couldn't share" : 'Your story'}
          </Text>
        </View>
        {others.map((r) => (
          <Pressable
            key={r.user_id}
            onPress={() => open(r.user_id)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={`${r.username}'s story${r.has_unseen ? ', unseen' : ''}`}
          >
            <Avatar uri={avatarUrl(r.avatar_path)} size={SIZE} ring={ringOf(r)} />
            <Text
              variant="caption"
              numberOfLines={1}
              color={r.has_unseen ? 'text' : 'textSecondary'}
              style={styles.label}
            >
              {r.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <BottomSheet
        visible={failedSheet}
        onClose={() => setFailedSheet(false)}
        title="Couldn't share your story"
      >
        <ActionGroup>
          <ActionRow
            icon="history"
            label="Retry"
            onPress={() => {
              failed.forEach((j) => uploads.retry(j.storyId));
              setFailedSheet(false);
            }}
          />
          <ActionRow
            icon="trash"
            label="Discard"
            destructive
            onPress={() => {
              failed.forEach((j) => void uploads.discard(j.storyId));
              setFailedSheet(false);
            }}
          />
        </ActionGroup>
      </BottomSheet>
    </>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const { colors } = useTheme();
  const outer = SIZE + 12;
  const r = (outer - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg
      width={outer}
      height={outer}
      style={[StyleSheet.absoluteFill, { left: -6, top: -6 }]}
      pointerEvents="none"
    >
      <Circle
        cx={outer / 2}
        cy={outer / 2}
        r={r}
        stroke={colors.separator}
        strokeWidth={3}
        fill="none"
      />
      <Circle
        cx={outer / 2}
        cy={outer / 2}
        r={r}
        stroke={colors.primary}
        strokeWidth={3}
        fill="none"
        strokeDasharray={`${c}`}
        strokeDashoffset={c * (1 - Math.max(0.05, progress))}
        rotation={-90}
        origin={`${outer / 2}, ${outer / 2}`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', width: SIZE + 12 },
  label: { marginTop: 4, maxWidth: SIZE + 12 },
  plus: {
    position: 'absolute',
    right: 2,
    top: SIZE - 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
