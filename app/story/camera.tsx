import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Icon, Text, useToast, type IconName } from '@/components';
import { PickerPermissionError, pickFromLibrary, videoPoster } from '@/features/create/media';
import { openAppSettings } from '@/features/profile/avatar';
import { canvasHeight } from '@/features/stories/components/StoryCanvas';
import {
  newDraft,
  useStoryComposer,
  type DraftStory,
  type LocalMedia,
} from '@/features/stories/StoryComposer';
import { STORY_GRADIENTS } from '@/features/stories/style';
import {
  CANVAS_H,
  CANVAS_W,
  LAYOUT_CELLS,
  MAX_STORY_VIDEO_MS,
  type LayoutGrid,
  type StickerElement,
} from '@/features/stories/types';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

type Mode = 'normal' | 'create' | 'boomerang' | 'layout' | 'handsfree';
type Flash = 'off' | 'on' | 'auto';
const FLASH_NEXT: Record<Flash, Flash> = { off: 'on', on: 'auto', auto: 'off' };
const FLASH_ICON: Record<Flash, IconName> = { off: 'flashOff', on: 'flashOn', auto: 'flashAuto' };
const GRIDS: LayoutGrid[] = ['split-v', 'split-h', 'thirds', 'quad', 'six'];
/** Boomerang: frames are captured while the shutter is held, up to this many (a few seconds). */
const BOOMERANG_MAX_FRAMES = 20;
const BOOMERANG_MIN_FRAMES = 3;
const RING = 86;

const MODES: { mode: Mode; icon: IconName; label: string }[] = [
  { mode: 'create', icon: 'createMode', label: 'Create' },
  { mode: 'boomerang', icon: 'boomerang', label: 'Boomerang' },
  { mode: 'layout', icon: 'layout', label: 'Layout' },
  { mode: 'handsfree', icon: 'handsFree', label: 'Hands-free' },
];

const centered = (sticker: StickerElement['sticker'], y = CANVAS_H / 2): StickerElement => ({
  id: Crypto.randomUUID(),
  type: 'sticker',
  sticker,
  x: CANVAS_W / 2,
  y,
  scale: 1,
  rotation: 0,
});

/**
 * Page 53 — story camera: tap = photo, hold = video (≤ 60 s), library (≤ 10, one story each),
 * Create (text on a gradient), Boomerang (10-frame burst played back and forth), Layout (2–6
 * photos in a grid) and Hands-free (tap to start / stop recording). Also the entry for "Add to
 * story" (post sticker), Add yours and sharing a question answer.
 */
export default function StoryCameraScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const composer = useStoryComposer();
  const params = useLocalSearchParams<{
    chain?: string;
    prompt?: string;
    postId?: string;
    answerPrompt?: string;
    answerBody?: string;
  }>();
  const { width, height } = useWindowDimensions();
  const camera = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [mode, setMode] = useState<Mode>('normal');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<Flash>('off');
  const [zoom, setZoom] = useState(0);
  const [recording, setRecording] = useState(false);
  // The camera session must be in video mode before recordAsync (switching takes a moment).
  const [videoMode, setVideoMode] = useState(false);
  const holding = useRef(false);
  const recordingRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [burst, setBurst] = useState<number | null>(null);
  const [grid, setGrid] = useState<LayoutGrid>('quad');
  const [cells, setCells] = useState<(LocalMedia | null)[]>(() => Array(4).fill(null));
  const [gradient, setGradient] = useState(0);
  const zoomStart = useRef(0);

  const canvasH = Math.min(canvasHeight(width), height);
  const canvasW = (canvasH * CANVAS_W) / CANVAS_H;

  // Shortcuts that skip the camera: post sticker (share sheet) and a question answer (page 56).
  const shortcutDone = useRef(false);
  useEffect(() => {
    if (shortcutDone.current) return;
    if (params.postId) {
      shortcutDone.current = true;
      start([
        newDraft('text', {
          resharedPostId: params.postId,
          content: {
            v: 1,
            background: STORY_GRADIENTS[0],
            elements: [centered({ kind: 'post', postId: params.postId })],
          },
        }),
      ]);
    } else if (params.answerPrompt) {
      shortcutDone.current = true;
      start([
        newDraft('text', {
          content: {
            v: 1,
            background: STORY_GRADIENTS[1],
            elements: [
              centered(
                { kind: 'answer', prompt: params.answerPrompt, body: params.answerBody ?? '' },
                CANVAS_H * 0.42,
              ),
            ],
          },
        }),
      ]);
    }
  });

  useEffect(() => {
    if (
      camPerm &&
      !camPerm.granted &&
      camPerm.canAskAgain &&
      !params.postId &&
      !params.answerPrompt
    ) {
      void requestCam();
    }
  }, [camPerm, requestCam, params.postId, params.answerPrompt]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(t);
  }, [recording]);

  /** Hand drafts to the editor (Add yours adds its sticker to the first story). */
  function start(drafts: DraftStory[]) {
    if (params.chain && params.prompt && drafts[0]) {
      const first = drafts[0];
      drafts[0] = {
        ...first,
        chainId: params.chain,
        content: {
          ...first.content,
          elements: [
            ...first.content.elements,
            centered(
              { kind: 'add_yours', stickerId: Crypto.randomUUID(), prompt: params.prompt },
              CANVAS_H * 0.72,
            ),
          ],
        },
      };
    }
    composer.setItems(drafts);
    router.replace('/story/editor');
  }

  const haptic = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  async function snap(quality = 1): Promise<LocalMedia | null> {
    const photo = await camera.current
      ?.takePictureAsync({ quality, shutterSound: false, skipProcessing: quality < 1 })
      .catch(() => null);
    if (!photo) return null;
    return { uri: photo.uri, width: photo.width, height: photo.height, type: 'image' };
  }

  async function takePhoto() {
    if (recording || burst !== null) return;
    haptic();
    const photo = await snap();
    if (!photo) {
      toast.show("Couldn't take the photo.");
      return;
    }
    if (mode === 'layout') {
      const i = cells.findIndex((c) => c === null);
      const next = cells.map((c, j) => (j === i ? photo : c));
      setCells(next);
      if (next.every(Boolean)) finishLayout(next);
      return;
    }
    start([newDraft('photo', { media: photo })]);
  }

  /** Hold to record: burst photos until the shutter is released (or the cap is reached). */
  async function shootBoomerang() {
    if (burst !== null) return;
    haptic();
    setBurst(0);
    const frames: LocalMedia[] = [];
    let failures = 0;
    while (holding.current && frames.length < BOOMERANG_MAX_FRAMES && failures < 3) {
      const f = await snap(0.4);
      if (f) frames.push(f);
      else failures++;
      setBurst(frames.length / BOOMERANG_MAX_FRAMES);
    }
    holding.current = false;
    setBurst(null);
    if (frames.length < BOOMERANG_MIN_FRAMES) {
      toast.show(
        failures ? "Couldn't record the Boomerang." : 'Hold the button to record a Boomerang',
      );
      return;
    }
    start([newDraft('boomerang', { frames, media: null })]);
  }

  async function startRecording() {
    if (!camera.current || recordingRef.current) return;
    let mic = micPerm;
    if (!mic?.granted) mic = await requestMic();
    if (!mic.granted) {
      toast.show('Allow microphone access to record videos.');
      return;
    }
    if (mode !== 'handsfree' && !videoMode) {
      setVideoMode(true);
      await new Promise((r) => setTimeout(r, 300));
    }
    // Hold-to-record: the finger left before recording could start.
    if (mode === 'normal' && !holding.current) {
      setVideoMode(false);
      toast.show('Hold the button to record a video');
      return;
    }
    if (!camera.current) return;
    haptic();
    setElapsed(0);
    recordingRef.current = true;
    setRecording(true);
    const started = Date.now();
    const video = await camera.current
      .recordAsync({ maxDuration: MAX_STORY_VIDEO_MS / 1000 })
      .catch((e: unknown) => {
        console.warn('[story camera] recordAsync failed', e);
        return null;
      });
    recordingRef.current = false;
    setRecording(false);
    setVideoMode(false);
    if (!video?.uri) {
      toast.show("Couldn't record the video.");
      return;
    }
    const poster = await videoPoster(video.uri).catch(() => null);
    start([
      newDraft('video', {
        media: {
          uri: video.uri,
          type: 'video',
          width: poster?.width ?? 1080,
          height: poster?.height ?? 1920,
          durationMs: Date.now() - started,
          mimeType: 'video/mp4',
        },
      }),
    ]);
  }

  const stopRecording = () => {
    holding.current = false;
    if (recordingRef.current) camera.current?.stopRecording();
  };

  function finishLayout(filled: (LocalMedia | null)[]) {
    start([newDraft('layout', { grid, cells: filled, media: null })]);
  }

  async function openLibrary() {
    try {
      const single = mode === 'layout';
      const { items, tooLong } = await pickFromLibrary(single ? 1 : 10);
      if (tooLong) toast.show('Videos longer than 60 seconds were skipped.');
      if (items.length === 0) return;
      const media: LocalMedia[] = items.map((i) => ({
        uri: i.uri,
        width: i.width,
        height: i.height,
        type: i.type,
        durationMs: i.durationMs,
        mimeType: i.mimeType,
      }));
      if (single) {
        const i = cells.findIndex((c) => c === null);
        const next = cells.map((c, j) => (j === i ? media[0] : c));
        setCells(next);
        if (next.every(Boolean)) finishLayout(next);
        return;
      }
      start(media.map((m) => newDraft(m.type === 'video' ? 'video' : 'photo', { media: m })));
    } catch (e) {
      if (e instanceof PickerPermissionError)
        toast.show('Allow photo access to add from your library.');
      else toast.show("Couldn't open your library.");
    }
  }

  function openCreate() {
    composer.setItems([
      newDraft('text', {
        content: { v: 1, background: STORY_GRADIENTS[gradient], elements: [] },
      }),
    ]);
    router.replace({ pathname: '/story/editor', params: { tool: 'text' } });
  }

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => scheduleOnRN(flip));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      zoomStart.current = zoom;
    })
    .onUpdate((e) => setZoom(Math.min(1, Math.max(0, zoomStart.current + (e.scale - 1) * 0.25))));

  const shortcut = !!params.postId || !!params.answerPrompt;
  if (shortcut) return <View style={{ flex: 1, backgroundColor: colors.mediaBackground }} />;

  if (mode !== 'create' && camPerm && !camPerm.granted) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background, gap: spacing.md }]}
      >
        <Icon name="camera" size={48} />
        <Text variant="headline">Allow camera access</Text>
        <Text color="textSecondary" style={{ textAlign: 'center', paddingHorizontal: spacing.xl }}>
          To share stories, allow Humans to use your camera. You can also add photos and videos from
          your library or create a text story.
        </Text>
        <Button
          title={camPerm.canAskAgain ? 'Allow' : 'Open Settings'}
          onPress={() => (camPerm.canAskAgain ? void requestCam() : void openAppSettings())}
        />
        <Button title="Add from library" variant="secondary" onPress={() => void openLibrary()} />
        <Button title="Create a text story" variant="text" onPress={() => setMode('create')} />
        <Button title="Not now" variant="text" onPress={() => goBack('/')} />
      </SafeAreaView>
    );
  }

  const progress =
    burst !== null ? burst : recording ? Math.min(1, elapsed / MAX_STORY_VIDEO_MS) : 0;
  const circumference = Math.PI * (RING - 6);
  const layoutCells = LAYOUT_CELLS[grid];
  const nextCell = cells.findIndex((c) => c === null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View
        style={{
          width: canvasW,
          height: canvasH,
          alignSelf: 'center',
          overflow: 'hidden',
          borderRadius: 12,
        }}
      >
        {mode === 'create' ? (
          <Pressable
            onPress={openCreate}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Tap to type"
          >
            <LinearGradient
              colors={STORY_GRADIENTS[gradient]}
              style={[StyleSheet.absoluteFill, styles.center]}
            >
              <Text variant="title" style={{ color: colors.onMedia, opacity: 0.85 }}>
                Tap to type
              </Text>
            </LinearGradient>
          </Pressable>
        ) : camPerm?.granted ? (
          <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
            <View style={StyleSheet.absoluteFill}>
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing={facing}
                flash={flash}
                mode={videoMode || mode === 'handsfree' ? 'video' : 'picture'}
                zoom={zoom}
                mirror={facing === 'front'}
              />
              {mode === 'layout'
                ? layoutCells.map(([x, y, w, h], i) => (
                    <Pressable
                      key={i}
                      onPress={() =>
                        cells[i] && setCells(cells.map((c, j) => (j === i ? null : c)))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={cells[i] ? `Retake photo ${i + 1}` : `Photo ${i + 1}`}
                      style={{
                        position: 'absolute',
                        left: x * canvasW,
                        top: y * canvasH,
                        width: w * canvasW,
                        height: h * canvasH,
                        borderWidth: i === nextCell ? 3 : StyleSheet.hairlineWidth * 2,
                        borderColor: i === nextCell ? colors.onMedia : colors.mediaGrid,
                        backgroundColor:
                          cells[i] || i === nextCell ? 'transparent' : colors.mediaScrim,
                      }}
                    >
                      {cells[i] ? (
                        <Image
                          source={{ uri: cells[i]!.uri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : null}
                    </Pressable>
                  ))
                : null}
            </View>
          </GestureDetector>
        ) : null}
      </View>

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.top, { paddingHorizontal: spacing.lg }]}>
          <CamButton icon="close" label="Close" onPress={() => goBack('/')} />
          {recording ? (
            <View style={[styles.timer, { backgroundColor: colors.like }]}>
              <Text variant="captionBold" style={{ color: colors.onMedia }}>
                {Math.floor(elapsed / 1000)}s
              </Text>
            </View>
          ) : mode === 'create' ? null : (
            <CamButton
              icon={FLASH_ICON[flash]}
              label={`Flash ${flash}`}
              onPress={() => setFlash((f) => FLASH_NEXT[f])}
            />
          )}
          <CamButton
            icon="settings"
            label="Story settings"
            onPress={() => router.push('/story-settings')}
          />
        </View>

        {/* Left rail: modes (tap again to go back to the normal camera). */}
        <View style={[styles.rail, { left: spacing.lg, gap: spacing.lg }]}>
          {MODES.map((m) => (
            <Pressable
              key={m.mode}
              onPress={() => setMode((cur) => (cur === m.mode ? 'normal' : m.mode))}
              disabled={recording || burst !== null}
              style={[styles.railItem, { gap: spacing.sm }]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m.mode }}
              accessibilityLabel={m.label}
            >
              <View
                style={[
                  styles.railIcon,
                  { backgroundColor: mode === m.mode ? colors.onMedia : colors.mediaScrim },
                ]}
              >
                <Icon
                  name={m.icon}
                  size={22}
                  color={mode === m.mode ? colors.mediaBackground : colors.onMedia}
                />
              </View>
              {mode === m.mode ? (
                <Text variant="captionBold" style={{ color: colors.onMedia }}>
                  {m.label}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {mode === 'layout' ? (
            <Pressable
              onPress={() => {
                const next = GRIDS[(GRIDS.indexOf(grid) + 1) % GRIDS.length];
                setGrid(next);
                setCells(Array(LAYOUT_CELLS[next].length).fill(null));
              }}
              style={[styles.railItem, { gap: spacing.sm }]}
              accessibilityRole="button"
              accessibilityLabel="Change grid"
            >
              <View style={[styles.railIcon, { backgroundColor: colors.mediaScrim }]}>
                <Icon name="grid" size={20} color={colors.onMedia} />
              </View>
              <Text variant="captionBold" style={{ color: colors.onMedia }}>
                Change grid
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.bottom, { paddingHorizontal: spacing.xl }]}>
          <CamButton
            icon="image"
            label="Gallery"
            onPress={() => void openLibrary()}
            disabled={recording || burst !== null || mode === 'create'}
          />
          {mode === 'create' ? (
            <Pressable
              onPress={() => setGradient((g) => (g + 1) % STORY_GRADIENTS.length)}
              accessibilityRole="button"
              accessibilityLabel="Change background"
              style={styles.shutterWrap}
            >
              <LinearGradient
                colors={STORY_GRADIENTS[(gradient + 1) % STORY_GRADIENTS.length]}
                style={[styles.gradientDot, { borderColor: colors.onMedia }]}
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={
                mode === 'boomerang'
                  ? undefined
                  : mode === 'handsfree'
                    ? () => (recording ? stopRecording() : void startRecording())
                    : () => void takePhoto()
              }
              onPressIn={() => {
                holding.current = true;
                // Boomerang records while held, like a video (no long-press delay).
                if (mode === 'boomerang') void shootBoomerang();
              }}
              onLongPress={mode === 'normal' ? () => void startRecording() : undefined}
              onPressOut={
                mode === 'normal'
                  ? stopRecording
                  : mode === 'boomerang'
                    ? () => {
                        holding.current = false;
                      }
                    : undefined
              }
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel="Shutter"
              accessibilityHint={
                mode === 'normal'
                  ? 'Tap to take a photo, hold to record a video'
                  : mode === 'handsfree'
                    ? 'Tap to start or stop recording'
                    : mode === 'boomerang'
                      ? 'Hold to record a Boomerang'
                      : 'Tap to take the next photo'
              }
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
                {progress > 0 ? (
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={(RING - 6) / 2}
                    stroke={colors.like}
                    strokeWidth={4}
                    fill="none"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference * (1 - progress)}
                    rotation={-90}
                    origin={`${RING / 2}, ${RING / 2}`}
                  />
                ) : null}
              </Svg>
              <View
                style={[
                  styles.shutter,
                  {
                    backgroundColor: recording ? colors.like : colors.onMedia,
                    transform: [{ scale: recording || burst !== null ? 0.7 : 1 }],
                  },
                ]}
              >
                {mode === 'boomerang' ? (
                  <Icon name="boomerang" size={30} color={colors.mediaBackground} />
                ) : null}
                {mode === 'handsfree' && !recording ? (
                  <View style={[styles.recDot, { backgroundColor: colors.like }]} />
                ) : null}
              </View>
            </Pressable>
          )}
          <CamButton
            icon="flipCamera"
            label="Flip camera"
            onPress={flip}
            disabled={recording || mode === 'create'}
          />
        </View>
        <Text
          variant="captionBold"
          style={{ color: colors.onMedia, textAlign: 'center', paddingBottom: spacing.md }}
        >
          {mode === 'create'
            ? 'CREATE'
            : mode === 'boomerang'
              ? 'BOOMERANG'
              : mode === 'layout'
                ? `LAYOUT · ${cells.filter(Boolean).length}/${layoutCells.length}`
                : mode === 'handsfree'
                  ? 'HANDS-FREE'
                  : 'STORY'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

function CamButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
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
        { backgroundColor: colors.mediaScrim, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} size={24} color={colors.onMedia} />
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
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recDot: { width: 22, height: 22, borderRadius: 11 },
  gradientDot: { width: 64, height: 64, borderRadius: 32, borderWidth: 3 },
  timer: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
});
