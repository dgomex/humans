import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Icon, Text, useToast } from '@/components';
import { PickerPermissionError, pickFromLibrary } from '@/features/create/media';
import { ReelPlayer } from '@/features/reels/components/ReelPlayer';
import { useReelComposer } from '@/features/reels/composer';
import { segmentAt, sourceFromComposer } from '@/features/reels/source';
import { formatDuration } from '@/features/reels/types';
import { useTheme } from '@/theme';

/**
 * Page 61 → Edit cover: scrub to any frame of the reel or "Add from camera roll", then drag the
 * 3:4 window to choose how the cover looks on your profile grid.
 */
export default function ReelCoverScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { state, reel, updateReel } = useReelComposer();
  const source = useMemo(() => sourceFromComposer(state), [state]);
  const [mode, setMode] = useState<'frame' | 'grid'>('frame');
  const [atMs, setAtMs] = useState(reel?.cover?.atMs ?? 0);
  const [picked, setPicked] = useState<{ uri: string; width: number; height: number } | null>(
    reel?.cover?.kind === 'image' ? reel.cover : null,
  );
  const [offset, setOffset] = useState(reel?.coverOffset ?? 0.5);
  const [saving, setSaving] = useState(false);
  const seek = useMemo(() => ({ ms: atMs, key: Math.round(atMs) }), [atMs]);

  const previewH = Math.min(440, (width * 0.62 * 16) / 9);
  const previewW = (previewH * 9) / 16;
  const stripW = width - spacing.xl * 2;
  const dragStart = useSharedValue(0);

  const scrub = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(setAtMs, Math.max(0, Math.min(1, e.x / stripW)) * source.total))
    .onUpdate((e) => scheduleOnRN(setAtMs, Math.max(0, Math.min(1, e.x / stripW)) * source.total));

  // The 3:4 window covers the full width and 75% of the 9:16 height.
  const windowH = (previewW * 4) / 3;
  const travel = previewH - windowH;
  const moveWindow = Gesture.Pan()
    .onBegin(() => {
      dragStart.set(offset);
    })
    .onUpdate((e) =>
      scheduleOnRN(
        setOffset,
        Math.min(1, Math.max(0, dragStart.get() + e.translationY / Math.max(1, travel))),
      ),
    );

  async function fromLibrary() {
    try {
      const { items } = await pickFromLibrary(1);
      const img = items.find((i) => i.type === 'image');
      if (img) {
        setPicked({ uri: img.uri, width: img.width, height: img.height });
        setMode('grid');
      } else if (items.length) toast.show('Choose a photo');
    } catch (e) {
      toast.show(
        e instanceof PickerPermissionError
          ? 'Allow photo access to add a cover.'
          : "Couldn't open your library.",
      );
    }
  }

  async function done() {
    if (saving) return;
    setSaving(true);
    try {
      if (picked) {
        updateReel({ cover: { kind: 'image', ...picked }, coverOffset: offset });
      } else {
        // Grab the frame at the chosen time from its clip.
        const { index, offset: inSeg } = segmentAt(source.segments, atMs);
        const seg = source.segments[index];
        if (seg?.type === 'video' && seg.uri && Platform.OS !== 'web') {
          const thumb = await VideoThumbnails.getThumbnailAsync(seg.uri, {
            time: Math.round(seg.inMs + inSeg * seg.speed),
            quality: 0.9,
          });
          updateReel({
            cover: {
              kind: 'frame',
              uri: thumb.uri,
              width: thumb.width,
              height: thumb.height,
              atMs,
            },
            coverOffset: offset,
          });
        } else if (seg?.type === 'image' && seg.uri) {
          updateReel({
            cover: { kind: 'frame', uri: seg.uri, width: seg.width, height: seg.height, atMs },
            coverOffset: offset,
          });
        } else {
          updateReel({ coverOffset: offset });
        }
      }
      router.back();
    } catch {
      toast.show("Couldn't use this frame. Try another one.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Icon name="close" size={26} color={colors.onMedia} />
        </Pressable>
        <Text variant="subhead" style={{ color: colors.onMedia }}>
          Cover
        </Text>
        <Pressable onPress={() => void done()} hitSlop={10} accessibilityRole="button">
          <Text variant="bodyBold" color="primary">
            Done
          </Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.lg, flex: 1 }}>
        <View style={{ width: previewW, height: previewH, borderRadius: 10, overflow: 'hidden' }}>
          {picked ? (
            <Image
              source={{ uri: picked.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <ReelPlayer
              source={source}
              width={previewW}
              height={previewH}
              active
              paused
              seek={seek}
            />
          )}
          {mode === 'grid' ? (
            <GestureDetector gesture={moveWindow}>
              <View style={StyleSheet.absoluteFill}>
                <View style={{ height: offset * travel, backgroundColor: colors.mediaScrim }} />
                <View style={{ height: windowH, borderWidth: 2, borderColor: colors.onMedia }} />
                <View style={{ flex: 1, backgroundColor: colors.mediaScrim }} />
              </View>
            </GestureDetector>
          ) : null}
        </View>

        <View style={[styles.row, { gap: spacing.sm }]}>
          <Button
            title="Frame"
            size="sm"
            variant={mode === 'frame' && !picked ? 'primary' : 'secondary'}
            onPress={() => {
              setPicked(null);
              setMode('frame');
            }}
          />
          <Button
            title="Profile grid"
            size="sm"
            variant={mode === 'grid' ? 'primary' : 'secondary'}
            onPress={() => setMode('grid')}
          />
          <Button
            title="Add from camera roll"
            size="sm"
            variant="secondary"
            onPress={() => void fromLibrary()}
          />
        </View>

        {mode === 'frame' && !picked ? (
          <View style={{ gap: spacing.xs, alignItems: 'center' }}>
            <GestureDetector gesture={scrub}>
              <View style={[styles.strip, { width: stripW, backgroundColor: colors.mediaScrim }]}>
                <View
                  style={[
                    styles.thumb,
                    {
                      left: (atMs / Math.max(1, source.total)) * stripW - 14,
                      borderColor: colors.onMedia,
                    },
                  ]}
                />
              </View>
            </GestureDetector>
            <Text variant="caption" style={{ color: colors.onMedia }}>
              {formatDuration(atMs)} · Drag to choose a frame
            </Text>
          </View>
        ) : (
          <Text
            variant="caption"
            style={{ color: colors.onMedia, textAlign: 'center', paddingHorizontal: spacing.xl }}
          >
            Drag the frame up or down to choose what shows on your profile grid.
          </Text>
        )}
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
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  strip: { height: 48, borderRadius: 8 },
  thumb: { position: 'absolute', top: -4, width: 28, height: 56, borderRadius: 6, borderWidth: 3 },
});
