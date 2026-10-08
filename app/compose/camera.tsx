import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Icon, Text, useToast, type IconName } from '@/components';
import { useComposer } from '@/features/create/ComposerProvider';
import { videoPoster } from '@/features/create/media';
import { MAX_VIDEO_MS, type ComposerItem } from '@/features/create/types';
import { useOpenLibrary } from '@/features/create/useOpenLibrary';
import { openAppSettings } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

type Flash = 'off' | 'on' | 'auto';
const FLASH_NEXT: Record<Flash, Flash> = { off: 'on', on: 'auto', auto: 'off' };
const FLASH_ICON: Record<Flash, IconName> = { off: 'flashOff', on: 'flashOn', auto: 'flashAuto' };

const SHUTTER = 78;
const RING = 92;

/**
 * Page 33 — post camera: tap = photo, hold = video (up to 60 s, red progress ring), flip with the
 * button or a double-tap, flash off/on/auto, pinch to zoom, tap to refocus.
 */
export default function CameraScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const composer = useComposer();
  const openLibrary = useOpenLibrary();
  const camera = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<Flash>('off');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [zoom, setZoom] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const zoomSv = useSharedValue(0);
  const zoomStart = useSharedValue(0);
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);
  const focusO = useSharedValue(0);

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) void requestCam();
  }, [camPerm, requestCam]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(t);
  }, [recording]);

  function finishCapture(item: ComposerItem) {
    composer.reset();
    composer.setItems([item]);
    router.replace('/compose/edit');
  }

  async function takePhoto() {
    if (!camera.current || recording) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const photo = await camera.current.takePictureAsync({ quality: 1 }).catch(() => null);
    if (!photo) {
      toast.show("Couldn't take the photo.");
      return;
    }
    finishCapture({
      key: Crypto.randomUUID(),
      uri: photo.uri,
      type: 'image',
      width: photo.width,
      height: photo.height,
      crop: null,
      altText: '',
      tags: [],
    });
  }

  async function startRecording() {
    if (!camera.current || recording) return;
    let mic = micPerm;
    if (!mic?.granted) mic = await requestMic();
    if (!mic.granted) {
      toast.show('Allow microphone access to record videos.');
      return;
    }
    setMode('video');
    // Give the session a moment to switch to video.
    await new Promise((r) => setTimeout(r, 250));
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setElapsed(0);
    setRecording(true);
    const started = Date.now();
    const video = await camera.current
      .recordAsync({ maxDuration: MAX_VIDEO_MS / 1000 })
      .catch(() => null);
    setRecording(false);
    setMode('picture');
    if (!video?.uri) {
      toast.show("Couldn't record the video.");
      return;
    }
    // The poster frame gives the real video size.
    const poster = await videoPoster(video.uri).catch(() => null);
    finishCapture({
      key: Crypto.randomUUID(),
      uri: video.uri,
      type: 'video',
      width: poster?.width ?? 1080,
      height: poster?.height ?? 1920,
      durationMs: Date.now() - started,
      mimeType: 'video/mp4',
      crop: null,
      altText: '',
      tags: [],
    });
  }

  function stopRecording() {
    if (recording) camera.current?.stopRecording();
  }

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));
  // expo-camera focuses continuously and has no point-of-interest API: the tap shows Instagram's
  // focus square as feedback.
  const showFocus = (x: number, y: number) => {
    focusX.set(x);
    focusY.set(y);
    focusO.set(withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 900 })));
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => scheduleOnRN(flip));
  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap)
    .onEnd((e) => scheduleOnRN(showFocus, e.x, e.y));
  const pinch = Gesture.Pinch()
    .onStart(() => {
      zoomStart.set(zoomSv.get());
    })
    .onUpdate((e) => {
      const z = Math.min(1, Math.max(0, zoomStart.get() + (e.scale - 1) * 0.25));
      zoomSv.set(z);
      scheduleOnRN(setZoom, z);
    });

  const focusStyle = useAnimatedStyle(() => ({
    opacity: focusO.get(),
    left: focusX.get() - 30,
    top: focusY.get() - 30,
  }));

  if (!camPerm) return <View style={{ flex: 1, backgroundColor: colors.mediaBackground }} />;

  if (!camPerm.granted) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background, gap: spacing.md }]}
      >
        <Icon name="camera" size={48} />
        <Text variant="headline">Allow camera access</Text>
        <Text color="textSecondary" style={{ textAlign: 'center', paddingHorizontal: spacing.xl }}>
          To take photos and videos, allow Humans to use your camera.
        </Text>
        <Button
          title={camPerm.canAskAgain ? 'Allow' : 'Open Settings'}
          onPress={() => (camPerm.canAskAgain ? void requestCam() : void openAppSettings())}
        />
        <Button title="Not now" variant="text" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const progress = Math.min(1, elapsed / MAX_VIDEO_MS);
  const circumference = Math.PI * (RING - 6);

  return (
    <View style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <GestureDetector
        gesture={Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, singleTap))}
      >
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode={mode}
            zoom={zoom}
            autofocus="on"
            mirror={facing === 'front'}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.focus, { borderColor: colors.onMedia }, focusStyle]}
          />
        </View>
      </GestureDetector>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.top, { paddingHorizontal: spacing.lg }]}>
          <CamButton icon="close" label="Close" onPress={() => router.back()} />
          {recording ? (
            <View style={[styles.timer, { backgroundColor: colors.like }]}>
              <Text variant="captionBold" style={{ color: colors.onMedia }}>
                {Math.floor(elapsed / 1000)}s
              </Text>
            </View>
          ) : (
            <CamButton
              icon={FLASH_ICON[flash]}
              label={`Flash ${flash}`}
              onPress={() => setFlash((f) => FLASH_NEXT[f])}
            />
          )}
        </View>

        <View style={[styles.bottom, { paddingHorizontal: spacing.xl }]}>
          <CamButton
            icon="image"
            label="Gallery"
            onPress={() => void openLibrary()}
            disabled={recording}
          />
          <Pressable
            onPress={takePhoto}
            onLongPress={() => void startRecording()}
            onPressOut={stopRecording}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel="Shutter"
            accessibilityHint="Tap to take a photo, hold to record a video"
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
              {recording ? (
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
                  transform: [{ scale: recording ? 0.7 : 1 }],
                },
              ]}
            />
          </Pressable>
          <CamButton icon="flipCamera" label="Flip camera" onPress={flip} disabled={recording} />
        </View>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  camButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: SHUTTER, height: SHUTTER, borderRadius: SHUTTER / 2 },
  timer: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'center' },
  focus: { position: 'absolute', width: 60, height: 60, borderWidth: 1.5 },
});
