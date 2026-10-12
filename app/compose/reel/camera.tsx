import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { BottomSheet, Button, Icon, Text, useToast, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSaveDraft } from '@/features/create/drafts';
import { PickerPermissionError, pickFromLibrary, videoPoster } from '@/features/create/media';
import { usePostCard } from '@/features/feed/api';
import { trackUrl } from '@/features/posts/api';
import { openAppSettings } from '@/features/profile/avatar';
import { useAudioPage, useReelSource } from '@/features/reels/api';
import { ReelPlayer } from '@/features/reels/components/ReelPlayer';
import { clipItem, newReelState, useReelComposer } from '@/features/reels/composer';
import { clipEditOf } from '@/features/reels/source';
import {
  MAX_REEL_CLIPS,
  MAX_REEL_MS,
  REEL_LENGTHS_MS,
  SPEEDS,
  clipLength,
  secondsLabel,
  type RemixLayout,
} from '@/features/reels/types';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

type Flash = 'off' | 'on' | 'auto';
const FLASH_NEXT: Record<Flash, Flash> = { off: 'on', on: 'auto', auto: 'off' };
const FLASH_ICON: Record<Flash, IconName> = { off: 'flashOff', on: 'flashOn', auto: 'flashAuto' };
const TIMERS = [0, 3, 10] as const;
const RING = 86;
const LAYOUTS: { layout: RemixLayout; icon: IconName; label: string }[] = [
  { layout: 'side_by_side', icon: 'sideBySide', label: 'Side by side' },
  { layout: 'react', icon: 'pip', label: 'React' },
  { layout: 'sequence', icon: 'sequence', label: 'Sequence' },
];

// expo-audio players are imperative native objects (see ReelPlayer).
function setRate(p: AudioPlayer, rate: number) {
  p.setPlaybackRate(Math.min(2, Math.max(0.5, rate)));
}

/**
 * Page 59 — Reels camera: tap to start / stop or hold to record segments (segmented ring), up to
 * the chosen length (15 s … 3 min); speed per segment (music follows), 3 / 10 s timer with
 * "record until", Align ghost of the last frame, music while recording, library clips, delete
 * the last segment. Page 63: with `?remix=` the original plays beside / over the camera.
 * Params: `track` (Use audio), `remix` (reel id).
 */
export default function ReelCameraScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ track?: string; remix?: string }>();
  const { width, height } = useWindowDimensions();
  const rc = useReelComposer();
  const { composer, state, reel, addClips, removeClip, updateReel, length } = rc;
  const saveDraft = useSaveDraft(profile?.id);
  const camera = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('front');
  const [flash, setFlash] = useState<Flash>('off');
  const [zoom, setZoom] = useState(0);
  const [videoMode, setVideoMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const holding = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState<number>(90_000);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [timerOpen, setTimerOpen] = useState(false);
  const [recordUntil, setRecordUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [align, setAlign] = useState(false);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState(false);
  const zoomStart = useSharedValue(0);

  const canvasH = Math.min((width * 16) / 9, height);
  const canvasW = (canvasH * 9) / 16;

  // --- start a reel (or keep the one coming back from the editor) ---------------------------
  const audioPage = useAudioPage(params.track);
  const remixCard = usePostCard(params.remix);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    if (state.reel && state.items.length > 0) {
      started.current = true;
      return;
    }
    if (params.track && !audioPage.isSuccess) return;
    if (params.remix && !remixCard.isSuccess) return;
    started.current = true;
    const page = audioPage.data;
    const next = newReelState();
    if (page && page.source !== 'original' && page.audio_path) {
      next.music = {
        trackId: page.id,
        title: page.title,
        artist: page.artist,
        audioPath: page.audio_path,
        durationMs: page.duration_ms,
        startMs: 0,
      };
    } else if (page && page.origin_post_id) {
      next.reel!.borrowedAudio = {
        trackId: page.id,
        title: page.title,
        artist: page.owner?.username ?? page.artist,
        originPostId: page.origin_post_id,
      };
    }
    const original = remixCard.data;
    if (params.remix) {
      if (!original || !original.can_remix) {
        toast.show("This reel can't be remixed");
      } else {
        next.reel!.remix = { postId: original.id, layout: 'side_by_side' };
      }
    }
    composer.reset(next);
  }, [
    params.track,
    params.remix,
    audioPage.isSuccess,
    audioPage.data,
    remixCard.isSuccess,
    remixCard.data,
    state.reel,
    state.items.length,
    composer,
    toast,
  ]);

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) void requestCam();
  }, [camPerm, requestCam]);

  useEffect(() => {
    if (!recording) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => clearInterval(id);
  }, [recording]);

  // --- sound while recording: catalog music (slowed / sped up to match the speed) ----------
  const musicUrl = state.music ? trackUrl({ audio_path: state.music.audioPath }) : null;
  const music = useAudioPlayer(musicUrl ? { uri: musicUrl } : null);
  useEffect(() => {
    if (!musicUrl) return;
    if (recording) {
      setRate(music, 1 / speed);
      void music.seekTo(((state.music?.startMs ?? 0) + length) / 1000);
      music.play();
    } else {
      music.pause();
    }
    // Start / stop with the recording only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // Borrowed original audio and the remix original follow the recorded length.
  const borrowedCard = usePostCard(reel?.borrowedAudio?.originPostId);
  const borrowed = useReelSource(borrowedCard.data);
  const remixSource = useReelSource(remixCard.data);
  const seekAt = useMemo(() => ({ ms: length, key: Math.round(length) }), [length]);

  const remixLayout = reel?.remix?.layout ?? null;
  const used = length + (recording ? elapsed / speed : 0);
  const cap = Math.min(limit, MAX_REEL_MS);

  // --- recording ------------------------------------------------------------------------------
  const haptic = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  async function startRecording(untilMs?: number) {
    if (!camera.current || recordingRef.current) return;
    if (state.items.length >= MAX_REEL_CLIPS) {
      toast.show(`Reels can have up to ${MAX_REEL_CLIPS} clips`);
      return;
    }
    const room = (untilMs ?? cap) - length;
    if (room < 500) {
      toast.show('You reached the length limit. Tap → to continue.');
      return;
    }
    let mic = micPerm;
    if (!mic?.granted) mic = await requestMic();
    if (!mic.granted) {
      toast.show('Allow microphone access to record reels.');
      return;
    }
    if (!videoMode) {
      setVideoMode(true);
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!camera.current) return;
    haptic();
    setArmedDelete(false);
    setElapsed(0);
    recordingRef.current = true;
    setRecording(true);
    const t0 = Date.now();
    const video = await camera.current
      .recordAsync({ maxDuration: Math.max(1, (room * speed) / 1000) })
      .catch((e: unknown) => {
        console.warn('[reel camera] recordAsync failed', e);
        return null;
      });
    const realMs = Date.now() - t0;
    recordingRef.current = false;
    setRecording(false);
    if (!video?.uri) {
      toast.show("Couldn't record the clip.");
      return;
    }
    if (realMs < 300) return;
    const poster = await videoPoster(video.uri).catch(() => null);
    const item = clipItem({
      uri: video.uri,
      type: 'video',
      width: poster?.width ?? 1080,
      height: poster?.height ?? 1920,
      durationMs: realMs,
      mimeType: 'video/mp4',
    });
    addClips([item], speed);
    if (Platform.OS !== 'web') {
      const last = await VideoThumbnails.getThumbnailAsync(video.uri, {
        time: Math.max(0, realMs - 150),
        quality: 0.5,
      }).catch(() => null);
      setLastFrame(last?.uri ?? null);
    }
    if (length + realMs / speed >= cap - 300) toast.show('Length limit reached');
  }

  const stopRecording = () => {
    holding.current = false;
    if (recordingRef.current) camera.current?.stopRecording();
  };

  function shutterPress() {
    if (recording) {
      stopRecording();
      return;
    }
    if (timer > 0) {
      runCountdown();
      return;
    }
    void startRecording();
  }

  function runCountdown() {
    let n: number = timer;
    setCountdown(n);
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setCountdown(null);
        void startRecording(recordUntil ?? cap);
      } else {
        setCountdown(n);
      }
    }, 1000);
  }

  function undoSegment() {
    if (!armedDelete) {
      setArmedDelete(true);
      return;
    }
    const last = state.items.at(-1);
    if (last) removeClip(last.key);
    setArmedDelete(false);
    setLastFrame(null);
  }

  async function openLibrary() {
    try {
      const room = MAX_REEL_CLIPS - state.items.length;
      const { items, tooLong } = await pickFromLibrary(Math.min(10, room), MAX_REEL_MS);
      if (tooLong) toast.show('Clips must be 3 minutes or shorter.');
      if (items.length === 0) return;
      addClips(items.map((i) => clipItem(i)));
      // Picking from the library goes straight to the editor, like Instagram.
      router.push('/compose/reel/edit');
    } catch (e) {
      toast.show(
        e instanceof PickerPermissionError
          ? 'Allow photo access to add from your library.'
          : "Couldn't open your library.",
      );
    }
  }

  function close() {
    if (state.items.length === 0) {
      composer.allowExit();
      goBack('/reels');
      return;
    }
    showDialog('Discard reel?', 'If you leave now, your clips will be lost.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'Save draft',
        onPress: () =>
          saveDraft.mutate(state, {
            onSuccess: () => {
              toast.show('Draft saved');
              composer.allowExit();
              goBack('/reels');
            },
            onError: () => toast.show("Couldn't save the draft."),
          }),
      },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          composer.allowExit();
          goBack('/reels');
        },
      },
    ]);
  }

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => scheduleOnRN(flip));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      zoomStart.set(zoom);
    })
    .onUpdate((e) => setZoom(Math.min(1, Math.max(0, zoomStart.get() + (e.scale - 1) * 0.25))));

  if (camPerm && !camPerm.granted) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background, gap: spacing.md }]}
      >
        <Icon name="camera" size={48} />
        <Text variant="headline">Allow camera access</Text>
        <Text color="textSecondary" style={{ textAlign: 'center', paddingHorizontal: spacing.xl }}>
          To record reels, allow Humans to use your camera and microphone. You can also make a reel
          from your library.
        </Text>
        <Button
          title={camPerm.canAskAgain ? 'Allow' : 'Open Settings'}
          onPress={() => (camPerm.canAskAgain ? void requestCam() : void openAppSettings())}
        />
        <Button title="Add from library" variant="secondary" onPress={() => void openLibrary()} />
        <Button title="Not now" variant="text" onPress={close} />
      </SafeAreaView>
    );
  }

  // Segment boundaries on the ring (fractions of the limit).
  const segs = state.items.map((i) => {
    const e = clipEditOf(state, i);
    return clipLength({ in_ms: e.inMs, out_ms: e.outMs, speed: e.speed });
  });
  const circumference = Math.PI * (RING - 6);
  const cameraView = camPerm?.granted ? (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
      <View style={StyleSheet.absoluteFill}>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mode={videoMode ? 'video' : 'picture'}
          zoom={zoom}
          mirror={facing === 'front'}
          videoQuality="1080p"
        />
        {align && lastFrame ? (
          <Image
            source={{ uri: lastFrame }}
            style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
            contentFit="cover"
          />
        ) : null}
      </View>
    </GestureDetector>
  ) : null;

  const original =
    remixLayout && remixLayout !== 'sequence' ? (
      remixSource ? (
        <ReelPlayer
          source={remixSource}
          width={remixLayout === 'side_by_side' ? canvasW / 2 : canvasW * 0.38}
          height={remixLayout === 'side_by_side' ? canvasH : (canvasW * 0.38 * 16) / 9}
          active={recording}
          seek={seekAt}
          muted={false}
        />
      ) : null
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View
        style={{
          width: canvasW,
          height: canvasH,
          alignSelf: 'center',
          overflow: 'hidden',
          borderRadius: 12,
          flexDirection: 'row',
        }}
      >
        {remixLayout === 'side_by_side' ? (
          <>
            <View style={{ width: canvasW / 2, height: canvasH }}>{original}</View>
            <View style={{ width: canvasW / 2, height: canvasH }}>{cameraView}</View>
          </>
        ) : (
          <View style={StyleSheet.absoluteFill}>{cameraView}</View>
        )}
        {remixLayout === 'react' ? (
          <View
            style={[
              styles.pip,
              {
                width: canvasW * 0.38,
                height: (canvasW * 0.38 * 16) / 9,
                right: canvasW * 0.06,
                top: canvasH * 0.06,
                borderColor: colors.onMedia,
              },
            ]}
          >
            {original}
          </View>
        ) : null}
        {countdown !== null ? (
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Text style={{ color: colors.onMedia, fontSize: 96, fontWeight: '700' }}>
              {countdown}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Sound while recording (borrowed original audio follows the recorded length). */}
      {borrowed ? (
        <ReelPlayer
          source={borrowed}
          width={1}
          height={1}
          active={recording}
          seek={seekAt}
          audioOnly
        />
      ) : null}

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.top, { paddingHorizontal: spacing.lg }]}>
          <CamButton icon="close" label="Close" onPress={close} disabled={recording} />
          {recording ? (
            <View style={[styles.timerPill, { backgroundColor: colors.like }]}>
              <Text variant="captionBold" style={{ color: colors.onMedia }}>
                {secondsLabel(used)} / {secondsLabel(cap)}
              </Text>
            </View>
          ) : (
            <CamButton
              icon={FLASH_ICON[flash]}
              label={`Flash ${flash}`}
              onPress={() => setFlash((f) => FLASH_NEXT[f])}
            />
          )}
          <CamButton icon="flipCamera" label="Flip camera" onPress={flip} disabled={recording} />
        </View>

        {/* Left rail */}
        {!recording ? (
          <View style={[styles.rail, { left: spacing.lg, gap: spacing.lg }]}>
            <RailItem
              icon="music"
              label={
                state.music
                  ? state.music.title
                  : reel?.borrowedAudio
                    ? reel.borrowedAudio.title
                    : 'Audio'
              }
              active={!!state.music || !!reel?.borrowedAudio}
              onPress={() => router.push('/compose/music')}
            />
            <RailItem
              icon="length"
              label={secondsLabel(limit)}
              onPress={() => {
                const options = REEL_LENGTHS_MS.filter((l) => l >= length);
                const i = options.indexOf(limit as (typeof REEL_LENGTHS_MS)[number]);
                setLimit(options[(i + 1) % options.length] ?? MAX_REEL_MS);
              }}
            />
            <RailItem
              icon="speed"
              label={`${speed}×`}
              active={speed !== 1}
              onPress={() => setSpeedOpen((o) => !o)}
            />
            <RailItem
              icon="timer"
              label={timer ? `${timer}s` : 'Timer'}
              active={timer > 0}
              onPress={() => setTimerOpen(true)}
            />
            {state.items.length > 0 ? (
              <RailItem
                icon="align"
                label="Align"
                active={align}
                onPress={() => setAlign((a) => !a)}
              />
            ) : null}
            {reel?.remix ? (
              <RailItem
                icon={LAYOUTS.find((l) => l.layout === remixLayout)?.icon ?? 'remix'}
                label={LAYOUTS.find((l) => l.layout === remixLayout)?.label ?? 'Layout'}
                active
                onPress={() => {
                  if (state.items.length > 0) {
                    toast.show('Delete your clips to change the layout');
                    return;
                  }
                  const i = LAYOUTS.findIndex((l) => l.layout === remixLayout);
                  const next = LAYOUTS[(i + 1) % LAYOUTS.length].layout;
                  updateReel((r) => (r.remix ? { remix: { ...r.remix, layout: next } } : {}));
                  if (next === 'sequence')
                    toast.show('The original plays first — trim it in the editor');
                }}
              />
            ) : null}
          </View>
        ) : null}

        {speedOpen && !recording ? (
          <View
            style={[
              styles.speeds,
              { backgroundColor: colors.mediaScrim, marginHorizontal: spacing.xl },
            ]}
          >
            {SPEEDS.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setSpeed(s);
                  setSpeedOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: speed === s }}
                style={[
                  styles.speed,
                  { backgroundColor: speed === s ? colors.onMedia : 'transparent' },
                ]}
              >
                <Text
                  variant="captionBold"
                  style={{ color: speed === s ? colors.mediaBackground : colors.onMedia }}
                >
                  {s}×
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.bottom, { paddingHorizontal: spacing.xl }]}>
          <CamButton
            icon="image"
            label="Gallery"
            onPress={() => void openLibrary()}
            disabled={recording}
          />
          <Pressable
            onPress={shutterPress}
            onLongPress={() => {
              if (recording || timer > 0) return;
              holding.current = true;
              void startRecording();
            }}
            onPressOut={() => {
              if (holding.current) stopRecording();
            }}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Record'}
            accessibilityHint="Tap to start or stop, or hold to record"
            style={styles.shutterWrap}
          >
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={(RING - 6) / 2}
                stroke={colors.onMedia}
                strokeOpacity={0.5}
                strokeWidth={4}
                fill="none"
              />
              {/* Recorded segments, with a small gap after each one. */}
              {segs.map((d, i) => {
                const start = segs.slice(0, i).reduce((a, b) => a + b, 0) / cap;
                const frac = Math.max(0, d / cap - 0.006);
                return (
                  <Circle
                    key={i}
                    cx={RING / 2}
                    cy={RING / 2}
                    r={(RING - 6) / 2}
                    stroke={armedDelete && i === segs.length - 1 ? colors.danger : colors.primary}
                    strokeWidth={4}
                    fill="none"
                    strokeDasharray={`${circumference * frac} ${circumference}`}
                    rotation={-90 + start * 360}
                    origin={`${RING / 2}, ${RING / 2}`}
                  />
                );
              })}
              {recording ? (
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={(RING - 6) / 2}
                  stroke={colors.like}
                  strokeWidth={4}
                  fill="none"
                  strokeDasharray={`${circumference * Math.min(1, elapsed / speed / cap)} ${circumference}`}
                  rotation={-90 + (length / cap) * 360}
                  origin={`${RING / 2}, ${RING / 2}`}
                />
              ) : null}
            </Svg>
            <View
              style={[
                styles.shutter,
                {
                  backgroundColor: recording ? colors.like : colors.onMedia,
                  transform: [{ scale: recording ? 0.6 : 1 }],
                  borderRadius: recording ? 12 : 36,
                },
              ]}
            >
              {!recording ? <Icon name="reels" size={28} color={colors.like} /> : null}
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {state.items.length > 0 && !recording ? (
              <>
                <CamButton
                  icon="undoSegment"
                  label={armedDelete ? 'Delete last clip' : 'Select last clip'}
                  onPress={undoSegment}
                  danger={armedDelete}
                />
                <CamButton
                  icon="arrowForward"
                  label="Next"
                  onPress={() => router.push('/compose/reel/edit')}
                  solid
                />
              </>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
        </View>
        <Text
          variant="captionBold"
          style={{ color: colors.onMedia, textAlign: 'center', paddingBottom: spacing.md }}
        >
          {reel?.remix ? 'REMIX' : 'REEL'}
        </Text>
      </SafeAreaView>

      <BottomSheet visible={timerOpen} onClose={() => setTimerOpen(false)} title="Timer">
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {TIMERS.map((t) => (
              <View key={t} style={{ flex: 1 }}>
                <Button
                  title={t === 0 ? 'Off' : `${t}s`}
                  variant={timer === t ? 'primary' : 'secondary'}
                  fullWidth
                  onPress={() => setTimer(t)}
                />
              </View>
            ))}
          </View>
          <Text variant="bodyBold">
            Record until {secondsLabel(recordUntil ?? cap)} (of {secondsLabel(cap)})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {[5_000, 10_000, 15_000, 30_000, 60_000, 90_000, 180_000]
              .filter((ms) => ms > length && ms <= cap)
              .map((ms) => (
                <Button
                  key={ms}
                  title={secondsLabel(ms)}
                  size="sm"
                  variant={(recordUntil ?? cap) === ms ? 'primary' : 'secondary'}
                  onPress={() => setRecordUntil(ms)}
                />
              ))}
          </View>
          <Text variant="caption" color="textSecondary">
            After the countdown, recording stops by itself at this point of your reel.
          </Text>
          <Button title="Done" onPress={() => setTimerOpen(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

function RailItem({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.railItem, { gap: spacing.sm }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View
        style={[styles.railIcon, { backgroundColor: active ? colors.onMedia : colors.mediaScrim }]}
      >
        <Icon name={icon} size={20} color={active ? colors.mediaBackground : colors.onMedia} />
      </View>
      <Text
        variant="captionBold"
        numberOfLines={1}
        style={{ color: colors.onMedia, maxWidth: 110 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CamButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
  solid,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  solid?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.camButton,
        {
          backgroundColor: danger ? colors.danger : solid ? colors.onMedia : colors.mediaScrim,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Icon name={icon} size={22} color={solid ? colors.mediaBackground : colors.onMedia} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  rail: { position: 'absolute', top: 90 },
  railItem: { flexDirection: 'row', alignItems: 'center' },
  railIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speeds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 24,
    padding: 4,
    marginTop: 'auto',
    marginBottom: 12,
  },
  speed: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingBottom: 8,
  },
  camButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  timerPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pip: { position: 'absolute', overflow: 'hidden', borderRadius: 12, borderWidth: 2 },
});
