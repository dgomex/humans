import { router } from 'expo-router';
import { View } from 'react-native';

import { ActionGroup, ActionRow, BottomSheet, Icon, useToast } from '@/components';
import type { FeedPost } from '@/features/feed/api';
import { useUpdatePostFlags } from '@/features/posts/api';
import { saveStoryMedia } from '@/features/stories/saveMedia';
import { useTheme } from '@/theme';

import { setReelsRate, useReelsRate } from '../format';
import { PLAYBACK_RATES } from '../types';

/**
 * Download a reel (page 64): its clips are saved to the photo library as they were uploaded
 * (decision: edit list played live, so there is no single rendered file).
 */
export async function downloadReel(post: FeedPost, toast: ReturnType<typeof useToast>) {
  const media = post.media.filter((m) => m.url);
  if (media.length === 0) {
    toast.show("Couldn't download the reel.");
    return;
  }
  try {
    for (const m of media) {
      const r = await saveStoryMedia(m.url!, m.type === 'video' ? 'mp4' : 'jpg');
      if (r === 'denied') {
        toast.show('Allow photo access to save reels');
        return;
      }
      if (r === 'unsupported') {
        toast.show('Downloading is available in the app');
        return;
      }
    }
    toast.show(
      media.length === 1 ? 'Saved to your photos' : `Saved ${media.length} clips to your photos`,
    );
  } catch {
    toast.show("Couldn't download the reel.");
  }
}

/**
 * Reel rows in the ⋯ sheet (pages 58 / 64): Remix, View remixes, Playback speed, Download; on
 * your own reels also the remix / download permissions.
 */
export function ReelOptionRows({
  post,
  onClose,
  onSpeed,
  own = false,
}: {
  post: FeedPost;
  onClose: () => void;
  onSpeed: () => void;
  own?: boolean;
}) {
  const toast = useToast();
  const rate = useReelsRate();
  const flags = useUpdatePostFlags(post.id);
  const toggle = (patch: { allow_remix?: boolean; allow_download?: boolean }, message: string) => {
    onClose();
    flags.mutate(patch, {
      onSuccess: () => toast.show(message),
      onError: () => toast.show("Couldn't update the reel."),
    });
  };
  return (
    <ActionGroup>
      {post.can_remix ? (
        <ActionRow
          icon="remix"
          label="Remix"
          onPress={() => {
            onClose();
            router.push({ pathname: '/compose/reel/camera', params: { remix: post.id } });
          }}
        />
      ) : null}
      {post.remix_count > 0 ? (
        <ActionRow
          icon="sequence"
          label={`View remixes (${post.remix_count})`}
          onPress={() => {
            onClose();
            router.push({ pathname: '/remixes/[id]', params: { id: post.id } });
          }}
        />
      ) : null}
      <ActionRow icon="speed" label="Playback speed" detail={`${rate}×`} onPress={onSpeed} />
      {own || post.allow_download ? (
        <ActionRow
          icon="download"
          label="Download"
          onPress={() => {
            onClose();
            void downloadReel(post, toast);
          }}
        />
      ) : null}
      {own ? (
        <>
          <ActionRow
            icon="remix"
            label={post.allow_remix ? 'Turn off remixing' : 'Allow remixing'}
            onPress={() =>
              toggle(
                { allow_remix: !post.allow_remix },
                post.allow_remix ? 'Remixing turned off' : 'Remixing allowed',
              )
            }
          />
          <ActionRow
            icon="download"
            label={post.allow_download ? 'Turn off downloads' : 'Allow downloads'}
            onPress={() =>
              toggle(
                { allow_download: !post.allow_download },
                post.allow_download ? 'Downloads turned off' : 'Downloads allowed',
              )
            }
          />
        </>
      ) : null}
    </ActionGroup>
  );
}

/** ⋯ → Playback speed (kept for the session across reels). */
export function SpeedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const rate = useReelsRate();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Playback speed">
      <View>
        {PLAYBACK_RATES.map((r) => (
          <ActionRow
            key={r}
            label={r === 1 ? 'Normal' : `${r}×`}
            trailing={
              <Icon
                name={rate === r ? 'radioOn' : 'radioOff'}
                size={22}
                color={rate === r ? colors.primary : colors.textTertiary}
              />
            }
            onPress={() => {
              setReelsRate(r);
              onClose();
            }}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
