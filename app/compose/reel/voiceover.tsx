import * as Crypto from 'expo-crypto';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, useToast } from '@/components';
import { usePostCard } from '@/features/feed/api';
import { trackUrl } from '@/features/posts/api';
import { ReelPlayer } from '@/features/reels/components/ReelPlayer';
import { useReelComposer } from '@/features/reels/composer';
import { sourceFromComposer } from '@/features/reels/source';
import { formatDuration, secondsLabel } from '@/features/reels/types';
import { useTheme } from '@/theme';

/**
 * Page 60 — voiceover: the reel plays (its own sound lowered) while you hold to record narration
 * from the playhead. Each take is kept with its start time; ↶ removes the last one. Takes are
 * mixed live by the player (no encoding).
 */
export default function VoiceoverScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { state, reel, updateReel } = useReelComposer();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [seek, setSeek] = useState<{ ms: number; key: number } | null>(null);
  const startedAt = useRef<{ ms: number; wall: number } | null>(null);

  const remixCard = usePostCard(reel?.remix?.postId);
  const musicUrl = state.music ? trackUrl({ audio_path: state.music.audioPath }) : null;
  const source = useMemo(() => {
    const s = sourceFromComposer(state, { original: remixCard.data ?? null, musicUrl });
    // While recording, the reel's own sound is quieter (like Instagram's ducking).
    return recording
      ? { ...s, segments: s.segments.map((g) => ({ ...g, volume: g.volume * 0.25 })) }
      : s;
  }, [state, remixCard.data, musicUrl, recording]);
  const ownTime = Math.max(0, time - source.ownOffset);
  const previewH = Math.min(420, (width * 0.6 * 16) / 9);
  const previewW = (previewH * 9) / 16;

  useEffect(() => {
    return () => {
      void setAudioModeAsync({ allowsRecording: false });
    };
  }, []);

  async function start() {
    if (recording) return;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      toast.show('Allow microphone access to record a voiceover.');
      return;
    }
    if (ownTime >= source.total - source.ownOffset - 300) {
      toast.show('Move back to record — this is the end of the reel');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startedAt.current = { ms: ownTime, wall: Date.now() };
    setRecording(true);
    setPlaying(true);
  }

  async function stop() {
    if (!recording) return;
    setRecording(false);
    setPlaying(false);
    await recorder.stop();
    const began = startedAt.current;
    startedAt.current = null;
    const uri = recorder.uri;
    if (!began || !uri) {
      toast.show("Couldn't save the voiceover.");
      return;
    }
    const durationMs = Date.now() - began.wall;
    if (durationMs < 300) return;
    updateReel((r) => ({
      voiceovers: [
        ...r.voiceovers,
        { id: Crypto.randomUUID(), uri, atMs: Math.round(began.ms), durationMs },
      ],
    }));
  }

  function onTime(ms: number) {
    setTime(ms);
    // Recording stops by itself at the end of the reel.
    if (recording && ms >= source.total - 80) void stop();
  }

  const takes = reel?.voiceovers ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          disabled={recording}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="back" size={26} color={colors.onMedia} />
        </Pressable>
        <Text variant="subhead" style={{ color: colors.onMedia }}>
          Voiceover
        </Text>
        <Pressable onPress={() => router.back()} disabled={recording} hitSlop={10}>
          <Text variant="bodyBold" color="primary">
            Done
          </Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.md, flex: 1 }}>
        <View style={{ width: previewW, height: previewH, borderRadius: 10, overflow: 'hidden' }}>
          <ReelPlayer
            source={source}
            width={previewW}
            height={previewH}
            active
            paused={!playing}
            seek={seek}
            onTime={onTime}
          />
        </View>
        <View style={[styles.row, { gap: spacing.md }]}>
          <Pressable
            onPress={() => setPlaying((p) => !p)}
            disabled={recording}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={24} color={colors.onMedia} />
          </Pressable>
          <Text variant="captionBold" style={{ color: colors.onMedia }}>
            {formatDuration(time)} / {formatDuration(source.total)}
          </Text>
          <Pressable
            onPress={() => setSeek((s) => ({ ms: source.ownOffset, key: (s?.key ?? 0) + 1 }))}
            disabled={recording}
            accessibilityRole="button"
            accessibilityLabel="Back to start"
          >
            <Icon name="history" size={22} color={colors.onMedia} />
          </Pressable>
        </View>

        {/* Takes on the reel's timeline */}
        <View
          style={[
            styles.track,
            { width: width - spacing.xl * 2, backgroundColor: colors.mediaScrim },
          ]}
        >
          {takes.map((t) => {
            const own = Math.max(1, source.total - source.ownOffset);
            return (
              <View
                key={t.id}
                style={[
                  styles.take,
                  {
                    left: `${(t.atMs / own) * 100}%`,
                    width: `${Math.max(1, (t.durationMs / own) * 100)}%`,
                    backgroundColor: colors.like,
                  },
                ]}
              />
            );
          })}
          <View
            style={[
              styles.playhead,
              {
                left: `${(ownTime / Math.max(1, source.total - source.ownOffset)) * 100}%`,
                backgroundColor: colors.onMedia,
              },
            ]}
          />
        </View>
        <Text variant="caption" style={{ color: colors.onMedia, opacity: 0.8 }}>
          {takes.length === 0
            ? 'Hold the button to record over your reel'
            : `${takes.length} ${takes.length === 1 ? 'take' : 'takes'} · ${secondsLabel(
                takes.reduce((n, t) => n + t.durationMs, 0),
              )}`}
        </Text>

        <View
          style={[styles.row, { gap: spacing.xl, marginTop: 'auto', marginBottom: spacing.xl }]}
        >
          <Pressable
            onPress={() => updateReel((r) => ({ voiceovers: r.voiceovers.slice(0, -1) }))}
            disabled={recording || takes.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Undo last take"
            style={[
              styles.small,
              { backgroundColor: colors.mediaScrim, opacity: takes.length && !recording ? 1 : 0.4 },
            ]}
          >
            <Icon name="undo" size={22} color={colors.onMedia} />
          </Pressable>
          <Pressable
            onPressIn={() => void start()}
            onPressOut={() => void stop()}
            accessibilityRole="button"
            accessibilityLabel="Hold to record"
            style={[
              styles.record,
              {
                borderColor: colors.onMedia,
                backgroundColor: recording ? colors.like : 'transparent',
              },
            ]}
          >
            <Icon name={recording ? 'micFilled' : 'mic'} size={34} color={colors.onMedia} />
          </Pressable>
          <View style={styles.small} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 24, borderRadius: 6, overflow: 'hidden' },
  take: { position: 'absolute', top: 4, bottom: 4, borderRadius: 3 },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  small: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  record: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
