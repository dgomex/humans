import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, SearchField, Text } from '@/components';
import { MUSIC_CLIP_MS, type ComposerMusic } from '@/features/create/types';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

import { trackUrl, useAudioTracks, useToggleSavedAudio, type AudioTrack } from '../api';

type Track = AudioTrack & { saved: boolean };

const formatTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Page 39 — Add music. Decision: a placeholder royalty-free catalog (scripts/seed-audio.mjs).
 * For you · Saved tabs, search, ▶ preview, bookmark; picking a song opens the clip selector
 * (drag the 15-second window), Done hands the clip back. Used by posts (page 36) and the story
 * editor (page 54).
 */
export function MusicPicker({
  onDone,
  onClose,
}: {
  onDone: (music: ComposerMusic) => void;
  onClose: () => void;
}) {
  const { colors, spacing } = useTheme();
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const [query, setQuery] = useState('');
  const term = useDebounced(query, 250);
  const tracks = useAudioTracks(term, tab === 'saved');
  const toggleSaved = useToggleSavedAudio();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [picked, setPicked] = useState<Track | null>(null);
  const [startMs, setStartMs] = useState(0);

  function preview(t: Track, fromMs = 0) {
    if (previewing === t.id && status.playing && fromMs === 0 && !picked) {
      player.pause();
      setPreviewing(null);
      return;
    }
    if (previewing !== t.id) player.replace({ uri: trackUrl(t) });
    void player.seekTo(fromMs / 1000);
    player.play();
    setPreviewing(t.id);
  }

  // The clip selector loops its 15-second window.
  useEffect(() => {
    if (!picked || !status.playing) return;
    if (status.currentTime * 1000 >= startMs + MUSIC_CLIP_MS) void player.seekTo(startMs / 1000);
  }, [picked, status.playing, status.currentTime, startMs, player]);

  function pick(t: Track) {
    setPicked(t);
    setStartMs(0);
    preview(t, 0);
  }

  function done() {
    if (!picked) return;
    player.pause();
    onDone({
      trackId: picked.id,
      title: picked.title,
      artist: picked.artist,
      audioPath: picked.audio_path,
      durationMs: picked.duration_ms,
      startMs,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        back={false}
        left={
          <TopBarButton
            icon="close"
            label="Close"
            onPress={() => {
              player.pause();
              onClose();
            }}
          />
        }
        title={picked ? picked.title : 'Music'}
        center
        right={picked ? <Button title="Done" variant="text" size="sm" onPress={done} /> : undefined}
      />

      {picked ? (
        <ClipSelector
          track={picked}
          startMs={startMs}
          playing={status.playing}
          positionMs={status.currentTime * 1000}
          onChange={(ms) => {
            setStartMs(ms);
            void player.seekTo(ms / 1000);
            player.play();
          }}
          onBack={() => {
            player.pause();
            setPicked(null);
            setPreviewing(null);
          }}
        />
      ) : (
        <>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search music" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(
                [
                  ['all', 'For you'],
                  ['saved', 'Saved'],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: tab === key ? colors.text : colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Text
                    variant="bodyBold"
                    style={{ color: tab === key ? colors.background : colors.text }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {tracks.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
            {tracks.data?.length === 0 ? (
              <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
                {tab === 'saved' ? 'Songs you save will appear here.' : 'No results found.'}
              </Text>
            ) : null}
            {(tracks.data ?? []).map((t) => {
              const playing = previewing === t.id && status.playing;
              return (
                // Sibling buttons (no nested <button> on web): preview · pick · save.
                <View
                  key={t.id}
                  style={[styles.row, { gap: spacing.md, paddingHorizontal: spacing.lg }]}
                >
                  <Pressable
                    onPress={() => preview(t)}
                    accessibilityRole="button"
                    accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}
                    style={[styles.cover, { backgroundColor: t.cover_color }]}
                  >
                    <Icon name={playing ? 'pause' : 'play'} size={20} color={colors.onMedia} />
                  </Pressable>
                  <Pressable
                    onPress={() => pick(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.title} by ${t.artist}`}
                    style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text variant="bodyBold" numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text color="textSecondary" numberOfLines={1}>
                      {t.artist} · {formatTime(t.duration_ms)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSaved.mutate({ trackId: t.id, saved: t.saved })}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t.saved ? 'Remove from saved' : 'Save audio'}
                  >
                    <Icon name={t.saved ? 'bookmarkFilled' : 'bookmark'} size={22} />
                  </Pressable>
                </View>
              );
            })}
            <Text
              variant="caption"
              color="textTertiary"
              style={{ padding: spacing.lg, textAlign: 'center' }}
            >
              Placeholder royalty-free tracks.
            </Text>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

/** Drag the window along the song to choose which 15 seconds play with the post. */
function ClipSelector({
  track,
  startMs,
  playing,
  positionMs,
  onChange,
  onBack,
}: {
  track: Track;
  startMs: number;
  playing: boolean;
  positionMs: number;
  onChange: (ms: number) => void;
  onBack: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const barWidth = width - spacing.lg * 2;
  const clip = Math.min(MUSIC_CLIP_MS, track.duration_ms);
  const maxStart = Math.max(0, track.duration_ms - clip);
  const windowWidth = (clip / track.duration_ms) * barWidth;
  const [dragStart, setDragStart] = useState<number | null>(null);
  const shown = dragStart ?? startMs;

  const toMs = (px: number) => Math.round((px / barWidth) * track.duration_ms);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      setDragStart(Math.min(maxStart, Math.max(0, startMs + toMs(e.translationX))));
    })
    .onEnd((e) => {
      setDragStart(null);
      onChange(Math.min(maxStart, Math.max(0, startMs + toMs(e.translationX))));
    });

  const left = (shown / track.duration_ms) * barWidth;
  const playhead = playing && positionMs >= shown ? ((positionMs - shown) / clip) * windowWidth : 0;

  return (
    <View style={{ flex: 1, padding: spacing.lg, gap: spacing.xl }}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <View
          style={[styles.bigCover, { backgroundColor: track.cover_color, borderRadius: radius.md }]}
        >
          <Icon name="musicFilled" size={40} color={colors.onMedia} />
        </View>
        <Text variant="headline">{track.title}</Text>
        <Text color="textSecondary">{track.artist}</Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <View
          style={[
            styles.bar,
            {
              width: barWidth,
              backgroundColor: colors.backgroundSecondary,
              borderRadius: radius.sm,
            },
          ]}
        >
          {Array.from({ length: 40 }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (i / 40) * barWidth + 2,
                top: 28 - (6 + ((i * 7) % 11)),
                width: 3,
                height: 2 * (6 + ((i * 7) % 11)),
                borderRadius: 2,
                backgroundColor: colors.textTertiary,
              }}
            />
          ))}
          <GestureDetector gesture={pan}>
            <View
              accessibilityLabel="Clip window"
              accessibilityHint="Drag to choose the part of the song"
              style={[
                styles.window,
                { left, width: windowWidth, borderColor: colors.text, borderRadius: radius.sm },
              ]}
            >
              {playhead > 0 ? (
                <View
                  style={[styles.playhead, { left: playhead, backgroundColor: colors.primary }]}
                />
              ) : null}
            </View>
          </GestureDetector>
        </View>
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          {formatTime(shown)} – {formatTime(shown + clip)} · drag to choose the part that plays
        </Text>
      </View>
      <Button title="Choose another song" variant="secondary" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  cover: { width: 48, height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  bigCover: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 56, justifyContent: 'center' },
  window: { position: 'absolute', top: 0, bottom: 0, borderWidth: 2 },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
