import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ActionRow, BottomSheet, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import { useUploadQueue, type UploadJob } from '../UploadQueue';

const LABEL: Record<UploadJob['stage'], string> = {
  preparing: 'Getting ready…',
  uploading: 'Posting…',
  publishing: 'Finishing up…',
  done: 'Posted',
  failed: "Couldn't post.",
};

/** Page 40 — "Posting…" rows at the top of Home with progress, Retry and ⋯ (draft / discard). */
export function UploadBanner() {
  const { jobs } = useUploadQueue();
  if (jobs.length === 0) return null;
  return (
    <View>
      {jobs.map((job) => (
        <UploadRow key={job.postId} job={job} />
      ))}
    </View>
  );
}

function UploadRow({ job }: { job: UploadJob }) {
  const { colors, spacing, hairline } = useTheme();
  const queue = useUploadQueue();
  const [menu, setMenu] = useState(false);
  const failed = job.stage === 'failed';
  const label = failed && job.offline ? 'Waiting for network…' : LABEL[job.stage];

  return (
    <View style={{ borderBottomWidth: hairline, borderBottomColor: colors.separator }}>
      <View style={[styles.row, { gap: spacing.md, padding: spacing.md }]}>
        <Image
          source={{ uri: job.coverUri }}
          style={[styles.thumb, { backgroundColor: colors.skeleton }]}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold">{label}</Text>
          {failed && !job.offline ? (
            <Text variant="caption" color="textSecondary">
              Tap retry to try again.
            </Text>
          ) : null}
        </View>
        {job.stage === 'done' ? <Icon name="checkCircle" size={24} color={colors.success} /> : null}
        {failed ? (
          <>
            <Pressable
              onPress={() => queue.retry(job.postId)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Icon name="reposts" size={24} />
            </Pressable>
            <Pressable
              onPress={() => setMenu(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Icon name="more" size={24} />
            </Pressable>
          </>
        ) : null}
        {job.stage === 'preparing' ? <ActivityIndicator /> : null}
      </View>
      {job.stage !== 'done' && !failed ? (
        <View style={[styles.track, { backgroundColor: colors.backgroundSecondary }]}>
          <View
            style={{
              height: '100%',
              width: `${Math.round(job.progress * 100)}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      ) : null}
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <ActionRow
          icon="drafts"
          label="Save draft"
          onPress={() => {
            setMenu(false);
            void queue.saveAsDraft(job.postId);
          }}
        />
        <ActionRow
          icon="trash"
          label="Discard post"
          destructive
          onPress={() => {
            setMenu(false);
            void queue.discard(job.postId);
          }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 40, height: 40, borderRadius: 4 },
  track: { height: 2, width: '100%' },
});
