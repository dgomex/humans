import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, useToast, type IconName } from '@/components';
import { PickerPermissionError, pickFromLibrary } from '@/features/create/media';
import { usePostCard } from '@/features/feed/api';
import { trackUrl } from '@/features/posts/api';
import { useReelSource } from '@/features/reels/api';
import { RangeSlider } from '@/features/reels/components/RangeSlider';
import { ReelPlayer } from '@/features/reels/components/ReelPlayer';
import { clipItem, useReelComposer } from '@/features/reels/composer';
import { clipEditOf, sourceFromComposer } from '@/features/reels/source';
import {
  MAX_REEL_CLIPS,
  MAX_REEL_MS,
  SPEEDS,
  clipLength,
  formatDuration,
  secondsLabel,
  type ReelOverlay,
} from '@/features/reels/types';
import { useTheme } from '@/theme';

/** Timeline zoom: pixels per second of the reel. */
const PX_PER_S = 36;

type Selection =
  | { kind: 'clip'; key: string }
  | { kind: 'overlay'; id: string }
  | { kind: 'voiceover'; id: string }
  | { kind: 'original' }
  | null;

/**
 * Page 60 — "Edit video": the timeline. Clips (trim, speed, split at the playhead, delete,
 * move, add more), text / sticker timing, voiceover takes, and for sequence remixes the part of
 * the original that plays first. Preview with play / pause and the playhead.
 */
export default function ReelTimelineScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const rc = useReelComposer();
  const { composer, state, reel, updateReel, setClip, addClips, removeClip, splitClip, length } =
    rc;
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [seek, setSeek] = useState<{ ms: number; key: number } | null>(null);
  const [sel, setSel] = useState<Selection>(null);

  const remixCard = usePostCard(reel?.remix?.postId);
  const borrowedCard = usePostCard(reel?.borrowedAudio?.originPostId);
  const remixSource = useReelSource(remixCard.data);
  const musicUrl = state.music ? trackUrl({ audio_path: state.music.audioPath }) : null;
  const source = useMemo(
    () =>
      sourceFromComposer(state, {
        original: remixCard.data ?? null,
        audioOrigin: borrowedCard.data ?? null,
        musicUrl,
      }),
    [state, remixCard.data, borrowedCard.data, musicUrl],
  );
  const previewH = Math.min(360, (width * 0.55 * 16) / 9);
  const previewW = (previewH * 9) / 16;
  const ownTime = Math.max(0, time - source.ownOffset);

  const seekTo = (ms: number) => setSeek((s) => ({ ms, key: (s?.key ?? 0) + 1 }));

  // Clip boundaries on the reel's own timeline.
  const clips = state.items.map((item) => {
    const e = clipEditOf(state, item);
    return { item, edit: e, dur: clipLength({ in_ms: e.inMs, out_ms: e.outMs, speed: e.speed }) };
  });
  const starts = clips.map((_, i) => clips.slice(0, i).reduce((n, c) => n + c.dur, 0));
  const selectedIndex = sel?.kind === 'clip' ? clips.findIndex((c) => c.item.key === sel.key) : -1;
  const selected = selectedIndex >= 0 ? clips[selectedIndex] : null;
  const overlay = sel?.kind === 'overlay' ? reel?.overlays.find((o) => o.id === sel.id) : null;
  const voiceover =
    sel?.kind === 'voiceover' ? reel?.voiceovers.find((v) => v.id === sel.id) : null;
  const isSequence = reel?.remix?.layout === 'sequence';

  async function addMore() {
    try {
      const room = MAX_REEL_CLIPS - state.items.length;
      const { items, tooLong } = await pickFromLibrary(Math.min(10, room), MAX_REEL_MS);
      if (tooLong) toast.show('Clips must be 3 minutes or shorter.');
      if (items.length) addClips(items.map((i) => clipItem(i)));
    } catch (e) {
      toast.show(
        e instanceof PickerPermissionError
          ? 'Allow photo access to add clips.'
          : "Couldn't open your library.",
      );
    }
  }

  const setOverlayTime = (id: string, start: number, end: number) =>
    updateReel((r) => ({
      overlays: r.overlays.map((o) =>
        o.id === id ? ({ ...o, start_ms: start, end_ms: end } as ReelOverlay) : o,
      ),
    }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="back" size={26} color={colors.onMedia} />
        </Pressable>
        <Text variant="subhead" style={{ color: colors.onMedia }}>
          Edit video
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text variant="bodyBold" color="primary">
            Done
          </Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: previewW, height: previewH, borderRadius: 10, overflow: 'hidden' }}>
          <ReelPlayer
            source={source}
            width={previewW}
            height={previewH}
            active
            paused={!playing}
            seek={seek}
            onTime={setTime}
          />
        </View>
        <View style={[styles.row, { gap: spacing.md }]}>
          <Pressable
            onPress={() => setPlaying((p) => !p)}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={24} color={colors.onMedia} />
          </Pressable>
          <Text variant="captionBold" style={{ color: colors.onMedia }}>
            {formatDuration(time)} / {formatDuration(source.total)}
          </Text>
          {length > MAX_REEL_MS ? (
            <Text variant="captionBold" color="danger">
              Over 3:00 — trim to share
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      >
        {/* Clips lane */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.row, { gap: 2 }]}>
            {isSequence ? (
              <Pressable
                onPress={() => setSel({ kind: 'original' })}
                style={[
                  styles.clip,
                  {
                    width: Math.max(48, (source.ownOffset / 1000) * PX_PER_S),
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: sel?.kind === 'original' ? colors.primary : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Original reel"
              >
                <Icon name="remix" size={18} color={colors.onMedia} />
              </Pressable>
            ) : null}
            {clips.map(({ item, dur, edit }, i) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  setSel({ kind: 'clip', key: item.key });
                  seekTo(source.ownOffset + starts[i]);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Clip ${i + 1}, ${secondsLabel(dur)}`}
                style={[
                  styles.clip,
                  {
                    width: Math.max(40, (dur / 1000) * PX_PER_S),
                    borderColor:
                      sel?.kind === 'clip' && sel.key === item.key ? colors.primary : 'transparent',
                  },
                ]}
              >
                {item.type === 'image' ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: colors.backgroundElevated },
                    ]}
                  />
                )}
                <Text variant="tiny" style={[styles.clipLabel, { color: colors.onMedia }]}>
                  {secondsLabel(dur)}
                  {edit.speed !== 1 ? ` · ${edit.speed}×` : ''}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => void addMore()}
              accessibilityRole="button"
              accessibilityLabel="Add clips"
              style={[styles.clip, styles.add, { borderColor: colors.onMedia }]}
            >
              <Icon name="add" size={22} color={colors.onMedia} />
            </Pressable>
          </View>
        </ScrollView>

        {/* Text / stickers lane */}
        {reel?.overlays.some((o) => o.type !== 'drawing') ? (
          <View style={[styles.row, { flexWrap: 'wrap', gap: spacing.sm }]}>
            {reel.overlays.map((o) =>
              o.type === 'drawing' ? null : (
                <Lane
                  key={o.id}
                  icon={o.type === 'text' ? 'text' : 'sticker'}
                  label={
                    o.type === 'text'
                      ? o.text.slice(0, 18) || 'Text'
                      : o.sticker.kind === 'mention'
                        ? `@${o.sticker.username}`
                        : o.sticker.kind === 'hashtag'
                          ? `#${o.sticker.tag}`
                          : 'Sticker'
                  }
                  detail={
                    o.start_ms !== undefined || o.end_ms !== undefined
                      ? `${secondsLabel(o.start_ms ?? 0)}–${secondsLabel(o.end_ms ?? length)}`
                      : 'Whole reel'
                  }
                  selected={sel?.kind === 'overlay' && sel.id === o.id}
                  onPress={() => setSel({ kind: 'overlay', id: o.id })}
                />
              ),
            )}
          </View>
        ) : null}

        {/* Voiceover lane */}
        {reel?.voiceovers.length ? (
          <View style={[styles.row, { flexWrap: 'wrap', gap: spacing.sm }]}>
            {reel.voiceovers.map((v, i) => (
              <Lane
                key={v.id}
                icon="mic"
                label={`Voiceover ${i + 1}`}
                detail={`${secondsLabel(v.atMs)} · ${secondsLabel(v.durationMs)}`}
                selected={sel?.kind === 'voiceover' && sel.id === v.id}
                onPress={() => {
                  setSel({ kind: 'voiceover', id: v.id });
                  seekTo(source.ownOffset + v.atMs);
                }}
              />
            ))}
          </View>
        ) : null}

        {/* Tools for the selection */}
        <View
          style={[styles.panel, { backgroundColor: colors.backgroundElevated, gap: spacing.md }]}
        >
          {selected ? (
            <>
              <RangeSlider
                label={`Trim clip ${selectedIndex + 1}`}
                max={
                  selected.item.type === 'video'
                    ? (selected.item.durationMs ?? selected.edit.outMs)
                    : 15_000
                }
                start={selected.edit.inMs}
                end={selected.edit.outMs}
                onChange={(a, b) => setClip(selected.item.key, { inMs: a, outMs: b })}
              />
              <View style={[styles.row, { gap: spacing.xs, flexWrap: 'wrap' }]}>
                {SPEEDS.map((s) => (
                  <Button
                    key={s}
                    title={`${s}×`}
                    size="sm"
                    variant={selected.edit.speed === s ? 'primary' : 'secondary'}
                    onPress={() => setClip(selected.item.key, { speed: s })}
                  />
                ))}
              </View>
              <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
                <Tool
                  icon="split"
                  label="Split"
                  onPress={() => {
                    const at = ownTime - starts[selectedIndex];
                    if (at <= 300 || at >= selected.dur - 300) {
                      toast.show('Move the playhead inside the clip to split it');
                      return;
                    }
                    splitClip(selected.item.key, at);
                  }}
                />
                <Tool
                  icon="back"
                  label="Move left"
                  disabled={selectedIndex === 0}
                  onPress={() => composer.moveItem(selectedIndex, selectedIndex - 1)}
                />
                <Tool
                  icon="forward"
                  label="Move right"
                  disabled={selectedIndex === clips.length - 1}
                  onPress={() => composer.moveItem(selectedIndex, selectedIndex + 1)}
                />
                <Tool
                  icon="trash"
                  label="Delete"
                  danger
                  disabled={clips.length === 1}
                  onPress={() => {
                    removeClip(selected.item.key);
                    setSel(null);
                  }}
                />
              </View>
            </>
          ) : overlay ? (
            <>
              <RangeSlider
                label="Show from – to"
                max={Math.max(1000, length)}
                start={overlay.start_ms ?? 0}
                end={Math.min(overlay.end_ms ?? length, Math.max(1000, length))}
                onChange={(a, b) => setOverlayTime(overlay.id, a, b)}
              />
              <View style={[styles.row, { gap: spacing.sm }]}>
                <Tool
                  icon="expand"
                  label="Whole reel"
                  onPress={() =>
                    updateReel((r) => ({
                      overlays: r.overlays.map((o) =>
                        o.id === overlay.id
                          ? ({ ...o, start_ms: undefined, end_ms: undefined } as ReelOverlay)
                          : o,
                      ),
                    }))
                  }
                />
                <Tool
                  icon="trash"
                  label="Delete"
                  danger
                  onPress={() => {
                    updateReel((r) => ({
                      overlays: r.overlays.filter((o) => o.id !== overlay.id),
                    }));
                    setSel(null);
                  }}
                />
              </View>
            </>
          ) : voiceover ? (
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Text style={{ color: colors.text, flex: 1 }}>
                Starts at {secondsLabel(voiceover.atMs)}, {secondsLabel(voiceover.durationMs)} long
              </Text>
              <Tool
                icon="trash"
                label="Delete"
                danger
                onPress={() => {
                  updateReel((r) => ({
                    voiceovers: r.voiceovers.filter((v) => v.id !== voiceover.id),
                  }));
                  setSel(null);
                }}
              />
            </View>
          ) : sel?.kind === 'original' && remixSource ? (
            <RangeSlider
              label="Part of the original that plays first"
              max={remixSource.total}
              start={reel?.remix?.in_ms ?? 0}
              end={reel?.remix?.out_ms ?? remixSource.total}
              minGap={1000}
              onChange={(a, b) =>
                updateReel((r) => (r.remix ? { remix: { ...r.remix, in_ms: a, out_ms: b } } : {}))
              }
            />
          ) : (
            <Text color="textSecondary">
              Tap a clip to trim it, change its speed, split it or move it. Tap a text, sticker or
              voiceover to time it.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Lane({
  icon,
  label,
  detail,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.lane,
        {
          backgroundColor: colors.backgroundElevated,
          borderColor: selected ? colors.primary : 'transparent',
        },
      ]}
    >
      <Icon name={icon} size={14} />
      <Text variant="captionBold" numberOfLines={1} style={{ maxWidth: 120 }}>
        {label}
      </Text>
      <Text variant="caption" color="textSecondary">
        {detail}
      </Text>
    </Pressable>
  );
}

function Tool({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.tool,
        { opacity: disabled ? 0.4 : 1, backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.icon} />
      <Text variant="captionBold" color={danger ? 'danger' : 'text'}>
        {label}
      </Text>
    </Pressable>
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
  clip: {
    height: 56,
    borderRadius: 6,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipLabel: { position: 'absolute', bottom: 2, left: 4 },
  add: { width: 44, borderStyle: 'dashed' },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 2,
  },
  panel: { borderRadius: 12, padding: 12 },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
