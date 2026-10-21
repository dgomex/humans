import * as Clipboard from 'expo-clipboard';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionGroup,
  ActionRow,
  Avatar,
  BottomSheet,
  Button,
  Icon,
  Text,
  useToast,
} from '@/components';
import { usePostCard } from '@/features/feed/api';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import {
  useAudioPage,
  useAudioReels,
  useReelSource,
  useRenameAudio,
  useToggleAudioSaved,
  type AudioPage,
} from '@/features/reels/api';
import { ReelGrid } from '@/features/reels/components/ReelGrid';
import { ReelPlayer } from '@/features/reels/components/ReelPlayer';
import { audioUrl } from '@/features/reels/format';
import { formatDuration } from '@/features/reels/types';
import { useTheme } from '@/theme';

/**
 * Page 62 — audio page: cover, title, artist (or "<user> · Original audio"), reel count, ▶
 * preview, Save, share / ⋯ (copy link, report, rename for your own original audio), the grid of
 * reels using the sound (original reel first), and "Use audio" → Reels camera with the sound.
 */
export default function AudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const page = useAudioPage(id);
  const reels = useAudioReels(id);
  const save = useToggleAudioSaved(id);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const data = page.data;

  const tiles = reels.data?.pages.flat() ?? [];

  function share() {
    const url = audioUrl(id);
    void Share.share({ message: url, url });
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title=""
        right={
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <TopBarButton
              icon="share"
              label="Send in a message"
              onPress={() => router.push({ pathname: '/direct/send', params: { audio: id } })}
            />
            <TopBarButton icon="more" label="More" onPress={() => setMenu(true)} />
          </View>
        }
      />
      {page.isPending ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} />
      ) : !data ? (
        <View style={[styles.center, { gap: spacing.sm, marginTop: spacing.xxl }]}>
          <Icon name="music" size={48} />
          <Text variant="headline">This audio isn&apos;t available</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            The reel it came from may have been deleted or made private.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 96 }}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              if (
                layoutMeasurement.height + contentOffset.y > contentSize.height - 400 &&
                reels.hasNextPage &&
                !reels.isFetchingNextPage
              ) {
                void reels.fetchNextPage();
              }
            }}
            scrollEventThrottle={200}
          >
            <Header
              page={data}
              onSave={() =>
                save.mutate(!data.saved, {
                  onSuccess: () => toast.show(data.saved ? 'Removed from saved' : 'Audio saved'),
                  onError: () => toast.show("Couldn't update. Try again."),
                })
              }
              onRename={() => setRenaming(true)}
            />
            {tiles.length === 0 && reels.isSuccess ? (
              <View style={[styles.center, { padding: spacing.xl, gap: spacing.sm }]}>
                <Icon name="reels" size={40} />
                <Text variant="bodyBold">No reels yet</Text>
                <Text color="textSecondary" style={{ textAlign: 'center' }}>
                  Be the first to use this audio.
                </Text>
              </View>
            ) : (
              <ReelGrid tiles={tiles} source="audio" owner={id} />
            )}
            {reels.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          </ScrollView>

          <View style={[styles.useWrap, { bottom: spacing.lg }]} pointerEvents="box-none">
            <Pressable
              onPress={() =>
                router.push({ pathname: '/compose/reel/camera', params: { track: id } })
              }
              accessibilityRole="button"
              style={[styles.use, { backgroundColor: colors.primary, gap: spacing.sm }]}
            >
              <Icon name="camera" size={20} color={colors.onPrimary} />
              <Text variant="bodyBold" style={{ color: colors.onPrimary }}>
                Use audio
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <ActionGroup>
          <ActionRow
            icon="link"
            label="Copy link"
            onPress={() => {
              setMenu(false);
              void Clipboard.setStringAsync(audioUrl(id)).then(() => toast.show('Link copied'));
            }}
          />
          <ActionRow
            icon="share"
            label="Share to…"
            onPress={() => {
              setMenu(false);
              share();
            }}
          />
          {data?.is_owner && data.source === 'original' ? (
            <ActionRow
              icon="edit"
              label="Rename audio"
              onPress={() => {
                setMenu(false);
                setRenaming(true);
              }}
            />
          ) : null}
          {!data?.is_owner ? (
            <ActionRow
              icon="report"
              label="Report audio"
              destructive
              onPress={() => {
                setMenu(false);
                router.push({ pathname: '/report', params: { type: 'audio', id } });
              }}
            />
          ) : null}
        </ActionGroup>
      </BottomSheet>
      {data ? (
        <RenameSheet page={data} visible={renaming} onClose={() => setRenaming(false)} />
      ) : null}
    </SafeAreaView>
  );
}

function Header({
  page,
  onSave,
  onRename,
}: {
  page: AudioPage;
  onSave: () => void;
  onRename: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const original = page.source === 'original';
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <View
          style={[styles.cover, { backgroundColor: page.cover_color, borderRadius: radius.md }]}
        >
          {original && page.owner ? (
            <Avatar uri={avatarUrl(page.owner.avatar_path)} size={72} />
          ) : (
            <Icon name="musicFilled" size={44} color={colors.onMedia} />
          )}
          <PreviewButton page={page} />
        </View>
        <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
          <Text variant="headline" numberOfLines={2}>
            {page.title}
          </Text>
          {original && page.owner ? (
            <Text
              variant="bodyBold"
              color="textSecondary"
              onPress={() => openProfile(page.owner!.username)}
            >
              {page.owner.username}
            </Text>
          ) : (
            <Text color="textSecondary">{page.artist}</Text>
          )}
          <Text variant="caption" color="textSecondary">
            {formatCount(page.reel_count)} {page.reel_count === 1 ? 'reel' : 'reels'}
            {page.duration_ms ? ` · ${formatDuration(page.duration_ms)}` : ''}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            title={page.saved ? 'Saved' : 'Save audio'}
            variant="secondary"
            fullWidth
            onPress={onSave}
          />
        </View>
        {page.is_owner && original ? (
          <View style={{ flex: 1 }}>
            <Button title="Rename" variant="secondary" fullWidth onPress={onRename} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** ▶ on the cover: catalog tracks stream their file; original audio plays its reel's sound. */
function PreviewButton({ page }: { page: AudioPage }) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const focused = useIsFocused();
  const on = playing && focused;
  return (
    <Pressable
      onPress={() => setPlaying((p) => !p)}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Pause preview' : 'Play preview'}
      style={[StyleSheet.absoluteFill, styles.center]}
    >
      <View style={[styles.play, { backgroundColor: colors.mediaScrim }]}>
        <Icon name={on ? 'pause' : 'play'} size={22} color={colors.onMedia} />
      </View>
      {page.audioUrl ? (
        <CatalogPreview uri={page.audioUrl} playing={on} />
      ) : page.origin_post_id ? (
        <OriginPreview postId={page.origin_post_id} playing={on} />
      ) : null}
    </Pressable>
  );
}

function CatalogPreview({ uri, playing }: { uri: string; playing: boolean }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);
  // Loop the preview.
  useEffect(() => {
    if (status.didJustFinish) {
      void player.seekTo(0);
      player.play();
    }
  }, [status.didJustFinish, player]);
  return null;
}

function OriginPreview({ postId, playing }: { postId: string; playing: boolean }) {
  const card = usePostCard(postId);
  const source = useReelSource(card.data);
  if (!source) return null;
  return <ReelPlayer source={source} width={1} height={1} active={playing} audioOnly />;
}

function RenameSheet({
  page,
  visible,
  onClose,
}: {
  page: AudioPage;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const rename = useRenameAudio(page.id);
  const [title, setTitle] = useState(page.title);
  const valid = title.trim().length >= 1 && title.trim().length <= 60;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Rename audio">
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          autoFocus
          placeholder="Audio name"
          placeholderTextColor={colors.textTertiary}
          style={{
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            fontSize: 16,
          }}
        />
        <Text variant="caption" color="textSecondary">
          People who use your audio will see this name.
        </Text>
        <Button
          title="Save"
          disabled={!valid}
          loading={rename.isPending}
          onPress={() =>
            rename.mutate(title.trim(), {
              onSuccess: () => {
                toast.show('Audio renamed');
                onClose();
              },
              onError: () => toast.show("Couldn't rename the audio."),
            })
          }
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  cover: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  useWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  use: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
