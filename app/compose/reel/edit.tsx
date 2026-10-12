import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Button,
  Icon,
  Text,
  useToast,
  type IconName,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSaveDraft } from '@/features/create/drafts';
import { useSaveDraftGuard } from '@/features/create/useSaveDraftGuard';
import { usePostCard } from '@/features/feed/api';
import { trackUrl } from '@/features/posts/api';
import { PersonSearchSheet } from '@/features/posts/components/PersonSearchSheet';
import { ReelPlayer } from '@/features/reels/components/ReelPlayer';
import { VolumeSlider } from '@/features/reels/components/VolumeSlider';
import { useReelComposer } from '@/features/reels/composer';
import { sourceFromComposer } from '@/features/reels/source';
import { MAX_REEL_MS, formatDuration, type ReelOverlay } from '@/features/reels/types';
import { DrawTool } from '@/features/stories/components/editor/DrawTool';
import { EditableElement } from '@/features/stories/components/editor/EditableElement';
import {
  StickerForm,
  StickerTray,
  needsForm,
  type TrayKind,
} from '@/features/stories/components/editor/StickerTray';
import { TextTool } from '@/features/stories/components/editor/TextTool';
import { DrawingStrokes, TextBody } from '@/features/stories/components/StoryCanvas';
import { StickerView } from '@/features/stories/components/StickerView';
import {
  CANVAS_H,
  CANVAS_W,
  type StickerData,
  type TextElement,
  type Transform,
} from '@/features/stories/types';
import { useTheme } from '@/theme';

const DRAWING_ID = 'drawing';
/** Reels take the display stickers; interactive ones (poll, quiz…) are for stories. */
const REEL_STICKERS: TrayKind[] = ['mention', 'hashtag', 'time'];

/**
 * Page 60 — reel preview + tools: ♫ audio, Aa text, ☺ stickers, ✎ draw, 🎙 voiceover, the audio
 * mixer and ⋯ (save draft). Text / stickers are placed here and timed in "Edit video" (the
 * timeline). Next → share details (page 61). Nothing is rendered into the video: the edit list
 * is played live (decision).
 */
export default function ReelEditScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { profile } = useAuth();
  const { composer, state, reel, updateReel, length } = useReelComposer();
  const saveDraft = useSaveDraft(profile?.id);
  useSaveDraftGuard();

  const [tool, setTool] = useState<null | 'text' | 'draw' | 'mention' | 'mixer' | 'more'>(null);
  const [tray, setTray] = useState(false);
  const [form, setForm] = useState<TrayKind | null>(null);
  const [editingText, setEditingText] = useState<TextElement | null>(null);
  const [drag, setDrag] = useState({ active: false, overBin: false });

  // Nothing to edit (restored without state): back to the camera.
  useEffect(() => {
    if (state.items.length === 0) router.replace('/compose/reel/camera');
  }, [state.items.length]);

  const footerH = 72 + insets.bottom;
  const canvasH = Math.min((width * CANVAS_H) / CANVAS_W, height - insets.top - footerH);
  const canvasW = (canvasH * CANVAS_W) / CANVAS_H;
  const k = canvasW / CANVAS_W;

  const remixCard = usePostCard(reel?.remix?.postId);
  const borrowedCard = usePostCard(reel?.borrowedAudio?.originPostId);
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

  const overlays = reel?.overlays ?? [];
  const drawing = overlays.find((e) => e.type === 'drawing');
  const paused = tool !== null || tray || form !== null || drag.active;

  const setOverlays = (fn: (els: ReelOverlay[]) => ReelOverlay[]) =>
    updateReel((r) => ({ overlays: fn(r.overlays) }));
  const moveElement = (id: string, t: Transform) =>
    setOverlays((els) => {
      const el = els.find((e) => e.id === id);
      if (!el || el.type === 'drawing') return els;
      return [...els.filter((e) => e.id !== id), { ...el, ...t }];
    });
  const removeElement = (id: string) => setOverlays((els) => els.filter((e) => e.id !== id));
  const addSticker = (sticker: StickerData) =>
    setOverlays((els) => [
      ...els,
      {
        id: Crypto.randomUUID(),
        type: 'sticker',
        sticker,
        x: CANVAS_W / 2,
        y: CANVAS_H * 0.45,
        scale: 1,
        rotation: 0,
      },
    ]);

  const disabled: Partial<Record<TrayKind, string>> = {};
  for (const kind of [
    'link',
    'poll',
    'quiz',
    'question',
    'slider',
    'countdown',
    'add_yours',
    'photo',
    'music',
  ] as TrayKind[]) {
    disabled[kind] = kind === 'music' ? 'Use ♫ Audio' : 'Stories only';
  }

  function pickSticker(kind: TrayKind) {
    setTray(false);
    if (!REEL_STICKERS.includes(kind)) return;
    if (needsForm(kind)) setForm(kind);
    else if (kind === 'mention') setTool('mention');
    else if (kind === 'time') addSticker({ kind: 'time', at: new Date().toISOString() });
  }

  function next() {
    if (length > MAX_REEL_MS + 500) {
      toast.show('Reels can be up to 3 minutes. Trim your clips in Edit video.');
      return;
    }
    router.push('/compose/reel/details');
  }

  const volumes = reel?.volumes ?? { camera: 1, music: 1, voiceover: 1, original: 1 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View
        style={{
          position: 'absolute',
          top: insets.top,
          alignSelf: 'center',
          width: canvasW,
          height: canvasH,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <ReelPlayer
          source={source}
          width={canvasW}
          height={canvasH}
          active
          paused={paused}
          hideOverlays
        />
        {drawing && drawing.type === 'drawing' && tool !== 'draw' ? (
          <DrawingStrokes strokes={drawing.strokes} width={canvasW} />
        ) : null}
        {overlays.map((el) =>
          el.type === 'drawing' || (editingText && el.id === editingText.id) ? null : (
            <EditableElement
              key={el.id}
              el={el}
              k={k}
              binTop={height - footerH}
              onChange={(t) => moveElement(el.id, t)}
              onDelete={() => removeElement(el.id)}
              onDrag={setDrag}
              onTap={
                el.type === 'text'
                  ? () => {
                      setEditingText(el);
                      setTool('text');
                    }
                  : undefined
              }
            >
              {el.type === 'text' ? (
                <TextBody el={el} k={k} />
              ) : (
                <StickerView sticker={el.sticker} k={k} ctx={{ preview: true }} />
              )}
            </EditableElement>
          ),
        )}
        <View style={[styles.length, { backgroundColor: colors.mediaScrim }]} pointerEvents="none">
          <Text variant="captionBold" style={{ color: colors.onMedia }}>
            {formatDuration(source.total)}
          </Text>
        </View>
      </View>

      {!drag.active && tool !== 'text' && tool !== 'draw' ? (
        <View
          style={[
            styles.top,
            { top: insets.top + spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
          ]}
        >
          <ToolButton icon="back" label="Back" onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
          <ToolButton icon="music" label="Audio" onPress={() => router.push('/compose/music')} />
          <ToolButton icon="text" label="Text" onPress={() => setTool('text')} />
          <ToolButton icon="sticker" label="Stickers" onPress={() => setTray(true)} />
          <ToolButton icon="draw" label="Draw" onPress={() => setTool('draw')} />
          <ToolButton
            icon="mic"
            label="Voiceover"
            onPress={() => router.push('/compose/reel/voiceover')}
          />
          <ToolButton icon="mixer" label="Audio mixer" onPress={() => setTool('mixer')} />
          <ToolButton icon="more" label="More" onPress={() => setTool('more')} />
        </View>
      ) : null}

      {drag.active ? (
        <View style={[styles.bin, { bottom: insets.bottom + spacing.xl }]} pointerEvents="none">
          <View
            style={[
              styles.binCircle,
              {
                borderColor: colors.onMedia,
                backgroundColor: drag.overBin ? colors.danger : colors.mediaScrim,
                transform: [{ scale: drag.overBin ? 1.25 : 1 }],
              },
            ]}
          >
            <Icon name="trash" size={26} color={colors.onMedia} />
          </View>
        </View>
      ) : tool === 'text' || tool === 'draw' ? null : (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.sm,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            },
          ]}
        >
          <Pressable
            onPress={() => router.push('/compose/reel/timeline')}
            accessibilityRole="button"
            style={[styles.pill, { backgroundColor: colors.mediaScrim, gap: spacing.sm }]}
          >
            <Icon name="timeline" size={20} color={colors.onMedia} />
            <Text variant="bodyBold" style={{ color: colors.onMedia }}>
              Edit video
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={next}
            accessibilityRole="button"
            style={[styles.pill, { backgroundColor: colors.primary, gap: spacing.sm }]}
          >
            <Text variant="bodyBold" style={{ color: colors.onPrimary }}>
              Next
            </Text>
            <Icon name="arrowForward" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      )}

      {tool === 'text' ? (
        <TextTool
          initial={editingText}
          onDone={(el) => {
            if (editingText && !el) removeElement(editingText.id);
            else if (el)
              setOverlays((els) =>
                els.some((e) => e.id === el.id)
                  ? els.map((e) => (e.id === el.id ? { ...e, ...el } : e))
                  : [...els, el],
              );
            setEditingText(null);
            setTool(null);
          }}
        />
      ) : null}
      {tool === 'draw' ? (
        <DrawTool
          width={canvasW}
          height={canvasH}
          top={insets.top}
          initial={drawing && drawing.type === 'drawing' ? drawing.strokes : []}
          onDone={(strokes) => {
            setOverlays((els) => {
              const rest = els.filter((e) => e.id !== DRAWING_ID);
              if (strokes.length === 0) return rest;
              const el: ReelOverlay = { id: DRAWING_ID, type: 'drawing', strokes };
              return drawing ? els.map((e) => (e.id === DRAWING_ID ? el : e)) : [...rest, el];
            });
            setTool(null);
          }}
        />
      ) : null}

      <StickerTray
        visible={tray}
        onClose={() => setTray(false)}
        onPick={pickSticker}
        disabled={disabled}
      />
      <StickerForm
        kind={form && needsForm(form) ? form : null}
        onClose={() => setForm(null)}
        onCreate={(sticker) => {
          addSticker(sticker);
          setForm(null);
        }}
      />
      <PersonSearchSheet
        visible={tool === 'mention'}
        title="Mention"
        onClose={() => setTool(null)}
        exclude={profile ? [profile.id] : []}
        onPick={(p) => {
          addSticker({ kind: 'mention', userId: p.id, username: p.username });
          setTool(null);
        }}
      />

      <BottomSheet visible={tool === 'mixer'} onClose={() => setTool(null)} title="Audio mixer">
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.md }}>
          <VolumeSlider
            label="Camera audio"
            value={volumes.camera}
            onChange={(v) => updateReel((r) => ({ volumes: { ...r.volumes, camera: v } }))}
          />
          {state.music || reel?.borrowedAudio ? (
            <VolumeSlider
              label={state.music ? `Music · ${state.music.title}` : 'Original audio'}
              value={volumes.music}
              onChange={(v) => updateReel((r) => ({ volumes: { ...r.volumes, music: v } }))}
            />
          ) : null}
          {reel?.voiceovers.length ? (
            <VolumeSlider
              label="Voiceover"
              value={volumes.voiceover}
              onChange={(v) => updateReel((r) => ({ volumes: { ...r.volumes, voiceover: v } }))}
            />
          ) : null}
          {reel?.remix ? (
            <VolumeSlider
              label="Original reel"
              value={volumes.original}
              onChange={(v) => updateReel((r) => ({ volumes: { ...r.volumes, original: v } }))}
            />
          ) : null}
          <Button title="Done" onPress={() => setTool(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={tool === 'more'} onClose={() => setTool(null)}>
        <ActionGroup>
          <ActionRow
            icon="drafts"
            label="Save draft"
            onPress={() => {
              setTool(null);
              saveDraft.mutate(state, {
                onSuccess: (d) => {
                  composer.update({ draftId: d.id });
                  toast.show('Draft saved');
                },
                onError: () => toast.show("Couldn't save the draft."),
              });
            }}
          />
          {state.music || reel?.borrowedAudio ? (
            <ActionRow
              icon="remove"
              label="Remove audio"
              onPress={() => {
                setTool(null);
                composer.updateWith((s) => ({
                  music: null,
                  reel: s.reel ? { ...s.reel, borrowedAudio: null } : s.reel,
                }));
              }}
            />
          ) : null}
        </ActionGroup>
      </BottomSheet>
    </View>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tool, { backgroundColor: colors.mediaScrim }]}
    >
      <Icon name={icon} size={20} color={colors.onMedia} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  tool: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  length: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  bin: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  binCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
