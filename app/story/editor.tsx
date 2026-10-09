import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  ActionGroup,
  ActionRow,
  Avatar,
  BottomSheet,
  Icon,
  Text,
  useToast,
  type IconName,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { PickerPermissionError, pickFromLibrary } from '@/features/create/media';
import { MusicPicker } from '@/features/posts/components/MusicPicker';
import { PersonSearchSheet } from '@/features/posts/components/PersonSearchSheet';
import { avatarUrl } from '@/features/profile/avatar';
import { DrawTool } from '@/features/stories/components/editor/DrawTool';
import { EditableElement } from '@/features/stories/components/editor/EditableElement';
import {
  StickerForm,
  StickerTray,
  needsForm,
  type TrayKind,
} from '@/features/stories/components/editor/StickerTray';
import { TextTool } from '@/features/stories/components/editor/TextTool';
import {
  DrawingStrokes,
  StoryBase,
  TextBody,
  canvasHeight,
} from '@/features/stories/components/StoryCanvas';
import { StickerView } from '@/features/stories/components/StickerView';
import { saveStoryView } from '@/features/stories/saveMedia';
import { useStoryComposer, type DraftStory } from '@/features/stories/StoryComposer';
import { useStoryUploads } from '@/features/stories/StoryUploads';
import {
  CANVAS_H,
  CANVAS_W,
  INTERACTIVE,
  type StickerData,
  type StickerElement,
  type StoryAudience,
  type StoryElement,
  type TextElement,
  type Transform,
} from '@/features/stories/types';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

const DRAWING_ID = 'drawing';
const IDENTITY: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };

// The player is an imperative native object; mutating it outside render is how expo-video works.
function applyMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}
const MAX_MENTIONS = 10;

/**
 * Page 54 — story editor: the story full screen with Aa text, ☺ stickers, ♫ music, ✎ drawing and
 * ⋯ (save, sound); every item can be moved, pinched, rotated and dropped on the bin. Footer
 * (page 55): Your story · Close Friends · → share options. Several picked photos/videos are
 * edited one by one (strip at the bottom) and shared as separate stories.
 */
export default function StoryEditorScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { profile } = useAuth();
  const composer = useStoryComposer();
  const uploads = useStoryUploads();
  const params = useLocalSearchParams<{ tool?: string }>();
  const draft = composer.current;

  const footerH = 72 + insets.bottom + (composer.items.length > 1 ? 64 : 0);
  const canvasH = Math.min(canvasHeight(width), height - insets.top - footerH);
  const canvasW = (canvasH * CANVAS_W) / CANVAS_H;
  const k = canvasW / CANVAS_W;
  const canvasTop = insets.top;
  const canvasRef = useRef<View>(null);

  const [tool, setTool] = useState<null | 'text' | 'draw' | 'music' | 'mention' | 'more'>(
    params.tool === 'text' ? 'text' : null,
  );
  const [tray, setTray] = useState(false);
  const [form, setForm] = useState<TrayKind | null>(null);
  const [editingText, setEditingText] = useState<TextElement | null>(null);
  const [drag, setDrag] = useState({ active: false, overBin: false });
  // Media transform at the start of a gesture (the gesture adds its deltas to it).
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRot = useSharedValue(0);

  // Nothing to edit (e.g. the screen was restored without state): back to the camera.
  useEffect(() => {
    if (!draft) router.replace('/story/camera');
  }, [draft]);

  const videoUri = draft?.kind === 'video' ? (draft.media?.uri ?? null) : null;
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.play();
  });
  useEffect(() => {
    applyMuted(player, !!draft?.muted);
  }, [player, draft?.muted]);

  if (!draft) return <View style={{ flex: 1, backgroundColor: colors.mediaBackground }} />;

  const elements = draft.content.elements;
  const drawing = elements.find((e) => e.type === 'drawing');
  const stickers = elements.filter((e): e is StickerElement => e.type === 'sticker');
  const mentionCount =
    stickers.filter((s) => s.sticker.kind === 'mention').length +
    elements.reduce((n, e) => n + (e.type === 'text' ? (e.mentions?.length ?? 0) : 0), 0);

  // --- element helpers --------------------------------------------------------------------
  const setElements = composer.setElements;
  const updateElement = (id: string, t: Transform) =>
    // Moving an item brings it to the front, like Instagram.
    setElements((els) => {
      const el = els.find((e) => e.id === id);
      if (!el || el.type === 'drawing') return els;
      return [...els.filter((e) => e.id !== id), { ...el, ...t }];
    });
  const removeElement = (id: string) => {
    const el = elements.find((e) => e.id === id);
    setElements((els) => els.filter((e) => e.id !== id));
    if (el?.type === 'sticker') {
      const s = el.sticker;
      if (s.kind === 'music') composer.updateCurrent({ music: null });
      if (s.kind === 'quiz') {
        const answers = { ...draft.quizAnswers };
        delete answers[s.stickerId];
        composer.updateCurrent({ quizAnswers: answers });
      }
    }
  };
  const addSticker = (sticker: StickerData, y = CANVAS_H * 0.45) =>
    setElements((els) => [
      ...els,
      {
        id: Crypto.randomUUID(),
        type: 'sticker',
        sticker,
        x: CANVAS_W / 2,
        y,
        scale: 1,
        rotation: 0,
      },
    ]);

  // --- stickers ----------------------------------------------------------------------------
  const disabled: Partial<Record<TrayKind, string>> = {};
  for (const s of stickers) {
    if (INTERACTIVE.includes(s.sticker.kind))
      disabled[s.sticker.kind as TrayKind] = 'Already added';
    if (s.sticker.kind === 'link') disabled.link = 'One link per story';
  }
  if (draft.music) disabled.music = 'Already added';
  if (draft.kind === 'video') disabled.music = 'Not on videos';
  if (mentionCount >= MAX_MENTIONS) disabled.mention = 'Up to 10 mentions';
  if (draft.chainId) disabled.add_yours = 'Already added';

  async function pickSticker(kind: TrayKind) {
    setTray(false);
    if (needsForm(kind)) {
      setForm(kind);
      return;
    }
    if (kind === 'mention') setTool('mention');
    else if (kind === 'music') setTool('music');
    else if (kind === 'time') addSticker({ kind: 'time', at: new Date().toISOString() });
    else if (kind === 'photo') {
      try {
        const { items } = await pickFromLibrary(1);
        const img = items.find((i) => i.type === 'image');
        if (img) addSticker({ kind: 'photo', path: img.uri, width: img.width, height: img.height });
        else if (items.length) toast.show('Choose a photo');
      } catch (e) {
        toast.show(
          e instanceof PickerPermissionError
            ? 'Allow photo access to add a photo.'
            : "Couldn't open your library.",
        );
      }
    }
  }

  // --- media gestures (move / zoom / rotate the photo or video) ---------------------------
  const media = draft.content.media ?? IDENTITY;
  const canMoveMedia =
    draft.kind === 'photo' || draft.kind === 'video' || draft.kind === 'boomerang';
  const setMedia = (t: Transform) =>
    composer.updateCurrent((d) => ({ content: { ...d.content, media: t } }));
  const { x: mx, y: my, scale: ms, rotation: mr } = media;
  const mediaPan = Gesture.Pan()
    .enabled(canMoveMedia)
    .averageTouches(true)
    .onStart(() => {
      startX.set(mx);
      startY.set(my);
    })
    .onUpdate((e) =>
      scheduleOnRN(setMedia, {
        x: startX.get() + e.translationX / k,
        y: startY.get() + e.translationY / k,
        scale: ms,
        rotation: mr,
      }),
    );
  const mediaPinch = Gesture.Pinch()
    .enabled(canMoveMedia)
    .onStart(() => {
      startScale.set(ms);
    })
    .onUpdate((e) =>
      scheduleOnRN(setMedia, {
        x: mx,
        y: my,
        scale: Math.min(6, Math.max(0.3, startScale.get() * e.scale)),
        rotation: mr,
      }),
    );
  const mediaRotate = Gesture.Rotation()
    .enabled(canMoveMedia)
    .onStart(() => {
      startRot.set(mr);
    })
    .onUpdate((e) =>
      scheduleOnRN(setMedia, {
        x: mx,
        y: my,
        scale: ms,
        rotation: startRot.get() + (e.rotation * 180) / Math.PI,
      }),
    );
  const tapCanvas = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(setTool, 'text');
  });
  const canvasGesture = Gesture.Exclusive(
    Gesture.Simultaneous(mediaPan, mediaPinch, mediaRotate),
    tapCanvas,
  );

  // --- leaving / sharing --------------------------------------------------------------------
  const dirty = composer.items.some(
    (d) => d.media || d.frames.length || d.cells.some(Boolean) || d.content.elements.length,
  );
  const leave = () => {
    if (!dirty) {
      goBack('/');
      return;
    }
    showDialog('Discard story?', "If you go back now, you'll lose your edits.", [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          composer.reset();
          router.replace('/story/camera');
        },
      },
    ]);
  };

  const shareTo = (audience: StoryAudience) => {
    const ready = composer.items.filter((d) => d.kind !== 'text' || d.content.elements.length > 0);
    if (ready.length === 0) {
      toast.show('Add some text or stickers first');
      return;
    }
    void uploads.enqueue(ready, audience);
    // Closing the modal drops the composer (resetting it first would bounce to the camera).
    router.dismissTo('/');
  };

  const music = draft.music ? { title: draft.music.title, artist: draft.music.artist } : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View
        ref={canvasRef}
        collapsable={false}
        style={{
          position: 'absolute',
          top: canvasTop,
          alignSelf: 'center',
          width: canvasW,
          height: canvasH,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <GestureDetector gesture={canvasGesture}>
          <View style={StyleSheet.absoluteFill}>
            <StoryBase
              source={{
                kind: draft.kind,
                content: {
                  ...draft.content,
                  layout: draft.grid
                    ? { grid: draft.grid, cells: draft.cells.map((c) => c?.uri ?? null) }
                    : undefined,
                  boomerang: draft.frames.length
                    ? { frames: draft.frames.map((f) => f.uri), fps: 12 }
                    : undefined,
                },
                mediaUri: draft.kind === 'photo' ? draft.media?.uri : null,
                mediaSize: draft.media ?? draft.frames[0] ?? null,
                resolve: (p) => p,
              }}
              width={canvasW}
              player={videoUri ? player : null}
            />
          </View>
        </GestureDetector>
        {drawing && tool !== 'draw' ? (
          <DrawingStrokes strokes={drawing.strokes} width={canvasW} />
        ) : null}
        {elements.map((el) =>
          el.type === 'drawing' || (editingText && el.id === editingText.id) ? null : (
            <EditableElement
              key={el.id}
              el={el}
              k={k}
              binTop={height - footerH}
              onChange={(t) => updateElement(el.id, t)}
              onDelete={() => removeElement(el.id)}
              onDrag={setDrag}
              onTap={
                el.type === 'text'
                  ? () => {
                      setEditingText(el);
                      setTool('text');
                    }
                  : el.sticker.kind === 'music'
                    ? () =>
                        setElements((els) =>
                          els.map((e) =>
                            e.id === el.id && e.type === 'sticker' && e.sticker.kind === 'music'
                              ? {
                                  ...e,
                                  sticker: {
                                    kind: 'music',
                                    style: e.sticker.style === 'card' ? 'compact' : 'card',
                                  },
                                }
                              : e,
                          ),
                        )
                    : undefined
              }
            >
              {el.type === 'text' ? (
                <TextBody el={el} k={k} />
              ) : (
                <StickerView
                  sticker={el.sticker}
                  k={k}
                  ctx={{
                    preview: true,
                    music,
                    authorAvatar: avatarUrl(profile?.avatar_path),
                    resolve: (p) => p,
                  }}
                />
              )}
            </EditableElement>
          ),
        )}
      </View>

      {/* Top tools (hidden while dragging or using a tool). */}
      {!drag.active && tool !== 'text' && tool !== 'draw' ? (
        <View style={[styles.top, { top: canvasTop + spacing.sm, paddingHorizontal: spacing.md }]}>
          <TopButton icon="back" label="Back" onPress={leave} />
          <View style={{ flex: 1 }} />
          <TopButton icon="text" label="Text" onPress={() => setTool('text')} />
          <TopButton icon="sticker" label="Stickers" onPress={() => setTray(true)} />
          <TopButton
            icon="music"
            label="Music"
            onPress={() => (disabled.music ? toast.show(disabled.music) : setTool('music'))}
          />
          <TopButton icon="draw" label="Draw" onPress={() => setTool('draw')} />
          <TopButton icon="more" label="More" onPress={() => setTool('more')} />
        </View>
      ) : null}

      {/* Bin while dragging. */}
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
        <View style={[styles.footerWrap, { paddingBottom: insets.bottom + spacing.sm }]}>
          {composer.items.length > 1 ? (
            <ScrollView
              horizontal
              contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
              style={{ flexGrow: 0, marginBottom: spacing.sm }}
            >
              {composer.items.map((d, i) => (
                <Pressable
                  key={d.key}
                  onPress={() => composer.setIndex(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Story ${i + 1}`}
                  accessibilityState={{ selected: i === composer.index }}
                  style={{
                    borderWidth: 2,
                    borderColor: i === composer.index ? colors.onMedia : 'transparent',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  <DraftThumb draft={d} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={[styles.footer, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
            <Pressable
              onPress={() => shareTo('everyone')}
              style={[styles.pill, { backgroundColor: colors.mediaScrim, gap: spacing.sm }]}
              accessibilityRole="button"
              accessibilityLabel="Share to your story"
            >
              <Avatar uri={avatarUrl(profile?.avatar_path)} size={26} />
              <Text variant="bodyBold" style={{ color: colors.onMedia }}>
                Your story
              </Text>
            </Pressable>
            <Pressable
              onPress={() => shareTo('close_friends')}
              style={[styles.pill, { backgroundColor: colors.mediaScrim, gap: spacing.sm }]}
              accessibilityRole="button"
              accessibilityLabel="Share to Close Friends"
            >
              <View style={[styles.cf, { backgroundColor: colors.closeFriends }]}>
                <Icon name="star" size={14} color={colors.onMedia} />
              </View>
              <Text variant="bodyBold" style={{ color: colors.onMedia }}>
                Close Friends
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => router.push('/story/share')}
              style={[styles.next, { backgroundColor: colors.onMedia }]}
              accessibilityRole="button"
              accessibilityLabel="More share options"
            >
              <Icon name="arrowForward" size={22} color={colors.mediaBackground} />
            </Pressable>
          </View>
        </View>
      )}

      {tool === 'text' ? (
        <TextTool
          initial={editingText}
          onDone={(el) => {
            if (editingText && !el) removeElement(editingText.id);
            else if (el)
              setElements((els) =>
                els.some((e) => e.id === el.id)
                  ? els.map((e) => (e.id === el.id ? el : e))
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
          top={canvasTop}
          initial={drawing?.strokes ?? []}
          onDone={(strokes) => {
            setElements((els) => {
              const rest = els.filter((e) => e.id !== DRAWING_ID);
              if (strokes.length === 0) return rest;
              const el: StoryElement = { id: DRAWING_ID, type: 'drawing', strokes };
              // Keep the drawing where it was in the stack; new drawings go on top.
              return drawing ? els.map((e) => (e.id === DRAWING_ID ? el : e)) : [...rest, el];
            });
            setTool(null);
          }}
        />
      ) : null}

      <StickerTray
        visible={tray}
        onClose={() => setTray(false)}
        onPick={(k) => void pickSticker(k)}
        disabled={disabled}
      />
      <StickerForm
        kind={form && needsForm(form) ? form : null}
        onClose={() => setForm(null)}
        onCreate={(sticker, answer) => {
          addSticker(sticker);
          if (sticker.kind === 'quiz' && answer !== undefined) {
            composer.updateCurrent((d) => ({
              quizAnswers: { ...d.quizAnswers, [sticker.stickerId]: answer },
            }));
          }
          setForm(null);
        }}
      />
      <PersonSearchSheet
        visible={tool === 'mention'}
        title="Mention"
        onClose={() => setTool(null)}
        exclude={[
          ...(profile ? [profile.id] : []),
          ...stickers.flatMap((s) => (s.sticker.kind === 'mention' ? [s.sticker.userId] : [])),
        ]}
        onPick={(p) => {
          addSticker({ kind: 'mention', userId: p.id, username: p.username });
          setTool(null);
        }}
      />
      <Modal visible={tool === 'music'} animationType="slide" onRequestClose={() => setTool(null)}>
        <MusicPicker
          onClose={() => setTool(null)}
          onDone={(m) => {
            composer.updateCurrent({ music: m });
            addSticker({ kind: 'music', style: 'card' }, CANVAS_H * 0.7);
            setTool(null);
          }}
        />
      </Modal>
      <BottomSheet visible={tool === 'more'} onClose={() => setTool(null)}>
        <ActionGroup>
          <ActionRow
            icon="download"
            label="Save"
            onPress={async () => {
              setTool(null);
              const r = await saveStoryView(canvasRef).catch(() => 'error' as const);
              toast.show(
                r === 'saved'
                  ? 'Saved to your photos'
                  : r === 'denied'
                    ? 'Allow photo access to save'
                    : r === 'unsupported'
                      ? 'Saving is available in the app'
                      : "Couldn't save",
              );
            }}
          />
          {draft.kind === 'video' ? (
            <ActionRow
              icon={draft.muted ? 'volumeOn' : 'volumeOff'}
              label={draft.muted ? 'Turn sound on' : 'Mute sound'}
              onPress={() => {
                composer.updateCurrent({ muted: !draft.muted });
                setTool(null);
              }}
            />
          ) : null}
          <ActionRow
            icon="settings"
            label="Story settings"
            onPress={() => {
              setTool(null);
              router.push('/story-settings');
            }}
          />
        </ActionGroup>
      </BottomSheet>
    </View>
  );
}

function DraftThumb({ draft }: { draft: DraftStory }) {
  const w = 40;
  return (
    <View style={{ width: w, height: (w * 16) / 9 }} pointerEvents="none">
      <StoryBase
        source={{
          kind: draft.kind === 'video' ? 'photo' : draft.kind,
          content: draft.content,
          mediaUri: draft.media?.type === 'image' ? draft.media.uri : null,
          mediaSize: draft.media,
          resolve: (p) => p,
        }}
        width={w}
        paused
      />
    </View>
  );
}

function TopButton({
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
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.topButton, { backgroundColor: colors.mediaScrim }]}
    >
      <Icon name={icon} size={22} color={colors.onMedia} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footer: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
  },
  cf: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  next: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
