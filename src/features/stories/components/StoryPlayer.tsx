import { useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useVideoPlayer } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar, Icon, Text, useToast } from '@/components';
import { openHashtag } from '@/features/explore/format';
import { shortAge } from '@/features/feed/format';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { useTheme } from '@/theme';

import { markStoryViewed, useCancelReminder, useRespondSticker, type StoryCard } from '../api';
import { STICKER } from '../style';
import { BOOMERANG_MS, MUSIC_STORY_MS, PHOTO_MS } from '../types';
import { StoryBase, StoryElements, canvasHeight } from './StoryCanvas';
import { StickerView, type StickerActions } from './StickerView';
import { StoryFooter } from './StoryFooter';
import { AskSheet, ChainSheet, StoryOptionsSheet } from './StorySheets';

export type ReelHeader =
  | { kind: 'user' }
  | { kind: 'highlight'; highlightId: string; title: string; coverUri: string | null };

export type StoryPlayerProps = {
  stories: StoryCard[];
  initialIndex: number;
  /** The focused page of the pager (others render their first frame, paused). */
  active: boolean;
  header: ReelHeader;
  onNextReel: () => void;
  onPrevReel: () => void;
  onClose: () => void;
  /** Horizontal drag of the pager (cube transition) and vertical drag (swipe down to close). */
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onSwipeEnd: (dx: number, vx: number) => void;
  /** Own stories: open the viewers sheet (page 56) for a story. */
  onOpenViewers?: (story: StoryCard) => void;
  /** Extra pause from the screen (e.g. viewers sheet open). */
  externalPause?: boolean;
  /** Story index changes (screen keeps the current story for sheets). */
  onIndexChange?: (index: number) => void;
};

function durationOf(card: StoryCard, videoMs: number | null) {
  if (card.kind === 'video') return Math.max(1000, card.duration_ms ?? videoMs ?? PHOTO_MS);
  if (card.audio) return MUSIC_STORY_MS;
  if (card.kind === 'boomerang') return BOOMERANG_MS;
  return PHOTO_MS;
}

/**
 * Page 52 — plays one reel (a user's active stories or a highlight): progress bars, auto-advance,
 * tap left/right, hold to pause, swipe down to close, swipe up to reply / see viewers, stickers
 * answered in place. Music and video sound play while the story is on screen.
 */
export function StoryPlayer(props: StoryPlayerProps) {
  const { stories, active, header, onNextReel, onPrevReel, onClose, dragX, dragY } = props;
  const { colors, spacing } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const canvasH = Math.min(canvasHeight(width), windowHeight - insets.top - insets.bottom);
  const canvasW = (canvasH * 9) / 16;

  const [rawIndex, setIndex] = useState(() => Math.max(0, props.initialIndex));
  // Stories may disappear (deleted / expired): keep the index valid.
  const index = Math.min(rawIndex, Math.max(0, stories.length - 1));
  const card = stories[index] as StoryCard | undefined;
  // Readiness and video length belong to one story; a new story starts not ready.
  const [readyId, setReadyId] = useState<string | null>(null);
  const ready = !!card && readyId === card.id;
  const [holding, setHolding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<null | 'options' | 'ask' | 'chain'>(null);
  const [askFor, setAskFor] = useState<{ stickerId: string; prompt: string } | null>(null);
  const [chainFor, setChainFor] = useState<{ chainId: string; prompt: string } | null>(null);
  const [appActive, setAppActive] = useState(true);
  const [video, setVideo] = useState<{ id: string; ms: number } | null>(null);
  const videoMs = card && video?.id === card.id ? video.ms : null;
  const [replySignal, setReplySignal] = useState(0);
  const progress = useSharedValue(0);

  const paused =
    !active ||
    holding ||
    dragging ||
    typing ||
    sheet !== null ||
    !appActive ||
    !!props.externalPause;
  const running = !paused && ready && !!card;

  const { onIndexChange } = props;
  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // --- media players -----------------------------------------------------------------------
  const videoUri = card?.kind === 'video' && card.media_path ? card.urls[card.media_path] : null;
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0;
  });
  const audio = useAudioPlayer(null);

  const cardId = card?.id ?? null;
  useEffect(() => {
    progress.set(0);
    if (videoUri) void player.replaceAsync({ uri: videoUri });
    else player.pause();
  }, [cardId, videoUri, player, progress]);

  useEffect(() => {
    if (!videoUri || !cardId) return;
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        if (player.duration > 0) setVideo({ id: cardId, ms: player.duration * 1000 });
        setReadyId(cardId);
      }
    });
    return () => sub.remove();
  }, [player, videoUri, cardId]);

  useEffect(() => {
    if (!videoUri) return;
    if (running) player.play();
    else player.pause();
  }, [running, videoUri, player]);

  const audioUrl = card?.audioUrl ?? null;
  useEffect(() => {
    if (!audioUrl || !card) {
      audio.pause();
      return;
    }
    audio.replace({ uri: audioUrl });
    void audio.seekTo((card.audio_start_ms ?? 0) / 1000);
  }, [audioUrl, card?.id, card?.audio_start_ms, audio, card]);

  useEffect(() => {
    if (!audioUrl) return;
    if (running) audio.play();
    else audio.pause();
  }, [running, audioUrl, audio]);

  // --- navigation --------------------------------------------------------------------------
  const goNext = useCallback(() => {
    if (index < stories.length - 1) setIndex(index + 1);
    else onNextReel();
  }, [index, stories.length, onNextReel]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex(index - 1);
    else if (header.kind === 'user') onPrevReel();
    else {
      // First item of a highlight: restart it.
      progress.set(0);
    }
  }, [index, header.kind, onPrevReel, progress]);

  // --- timer ---------------------------------------------------------------------------------
  const duration = card ? durationOf(card, videoMs) : PHOTO_MS;
  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(50, (1 - progress.get()) * duration);
    progress.set(
      withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(goNext);
      }),
    );
    return () => cancelAnimation(progress);
  }, [running, duration, progress, goNext]);

  useEffect(() => {
    if (card && active && ready) markStoryViewed(qc, card);
  }, [card, active, ready, qc]);

  // --- gestures ------------------------------------------------------------------------------
  const onTap = (x: number) => {
    if (typing) {
      Keyboard.dismiss();
      return;
    }
    if (x < width / 3) goPrev();
    else goNext();
  };
  const onVerticalEnd = (dy: number, vy: number) => {
    if (dy > 120 || vy > 900) {
      onClose();
      return;
    }
    dragY.set(withTiming(0, { duration: 180 }));
    if (dy < -60 || vy < -700) {
      if (card?.is_own) props.onOpenViewers?.(card);
      else setReplySignal((n) => n + 1);
    }
  };

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e, ok) => {
      if (ok) scheduleOnRN(onTap, e.x);
    });
  const hold = Gesture.LongPress()
    .minDuration(220)
    .onStart(() => scheduleOnRN(setHolding, true))
    .onFinalize(() => scheduleOnRN(setHolding, false));
  const hPan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart(() => scheduleOnRN(setDragging, true))
    .onUpdate((e) => dragX.set(e.translationX))
    .onEnd((e) => scheduleOnRN(props.onSwipeEnd, e.translationX, e.velocityX))
    .onFinalize(() => scheduleOnRN(setDragging, false));
  const vPan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-14, 14])
    .onStart(() => scheduleOnRN(setDragging, true))
    .onUpdate((e) => dragY.set(Math.max(0, e.translationY)))
    .onEnd((e) => scheduleOnRN(onVerticalEnd, e.translationY, e.velocityY))
    .onFinalize(() => scheduleOnRN(setDragging, false));
  const gestures = Gesture.Race(hPan, vPan, hold, tap);

  // --- stickers ------------------------------------------------------------------------------
  const respond = useRespondSticker();
  const cancelReminder = useCancelReminder();
  const own = !!card?.is_own;
  const live = !!card?.is_active;
  const actions: StickerActions = {
    onVote:
      own || !live
        ? undefined
        : (stickerId, option) => respond.mutate({ storyId: card!.id, stickerId, option }),
    onSlide:
      own || !live
        ? undefined
        : (stickerId, value) => respond.mutate({ storyId: card!.id, stickerId, value }),
    onAsk:
      own || !live
        ? undefined
        : (stickerId, prompt) => {
            setAskFor({ stickerId, prompt });
            setSheet('ask');
          },
    onRemind:
      own || !live
        ? undefined
        : (stickerId, on) => {
            if (on) respond.mutate({ storyId: card!.id, stickerId });
            else cancelReminder.mutate({ storyId: card!.id, stickerId });
            toast.show(on ? "We'll remind you when the countdown ends" : 'Reminder removed');
          },
    onAddYours: (_stickerId, chainId, prompt) => {
      onClose();
      router.push({ pathname: '/story/camera', params: { chain: chainId, prompt } });
    },
    onOpenChain: (chainId, prompt) => {
      setChainFor({ chainId, prompt });
      setSheet('chain');
    },
    onMention: (username) => {
      onClose();
      openProfile(username);
    },
    onHashtag: (tag) => {
      onClose();
      openHashtag(tag);
    },
    onLink: (url) => {
      setHolding(true);
      void WebBrowser.openBrowserAsync(url).finally(() => setHolding(false));
    },
    onPost: (postId) => {
      onClose();
      router.push({ pathname: '/p/[id]', params: { id: postId } });
    },
  };

  const markReady = useCallback(() => setReadyId(cardId), [cardId]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  if (!card) return <View style={[styles.fill, { backgroundColor: colors.mediaBackground }]} />;

  const resolve = (p: string) => card.urls[p] ?? null;
  const authorAvatar = avatarUrl(card.author.avatar_path);
  const headerAvatar = header.kind === 'highlight' ? header.coverUri : authorAvatar;
  const headerTitle = header.kind === 'highlight' ? header.title : card.author.username;

  return (
    <View
      style={[styles.fill, { backgroundColor: colors.mediaBackground, paddingTop: insets.top }]}
    >
      <View
        style={{
          width: canvasW,
          height: canvasH,
          alignSelf: 'center',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <StoryBase
          source={{
            kind: card.kind,
            content: card.content,
            mediaUri: card.media_path ? resolve(card.media_path) : null,
            posterUri: card.thumb_path ? resolve(card.thumb_path) : null,
            mediaSize:
              card.width && card.height ? { width: card.width, height: card.height } : null,
            resolve,
          }}
          width={canvasW}
          player={videoUri ? player : null}
          paused={paused}
          onReady={card.kind === 'video' ? undefined : markReady}
        />
        {/* Gesture layer sits between the media and the stickers so stickers keep their taps. */}
        <GestureDetector gesture={gestures}>
          <View
            style={StyleSheet.absoluteFill}
            accessible
            accessibilityLabel="Story"
            accessibilityHint="Tap right for next, left for previous, hold to pause"
          />
        </GestureDetector>
        <View style={StyleSheet.absoluteFill} pointerEvents={holding ? 'none' : 'box-none'}>
          <StoryElements
            elements={card.content.elements}
            width={canvasW}
            renderSticker={(el, k) => (
              <StickerView
                sticker={el.sticker}
                k={k}
                ctx={{
                  card:
                    'stickerId' in el.sticker
                      ? (card.stickers.find(
                          (s) => s.id === (el.sticker as { stickerId: string }).stickerId,
                        ) ?? null)
                      : null,
                  music: card.audio,
                  resolve,
                  authorAvatar,
                  actions,
                }}
              />
            )}
          />
        </View>

        {/* Header (hidden while holding, like Instagram). */}
        {holding ? null : (
          <View style={[styles.header, { paddingHorizontal: spacing.sm }]} pointerEvents="box-none">
            <View style={[styles.bars, { gap: 3 }]}>
              {stories.map((s, i) => (
                <View key={s.id} style={[styles.bar, { backgroundColor: colors.mediaGrid }]}>
                  {i < index ? (
                    <View
                      style={[styles.barFill, { width: '100%', backgroundColor: colors.onMedia }]}
                    />
                  ) : null}
                  {i === index ? (
                    <Animated.View
                      style={[styles.barFill, { backgroundColor: colors.onMedia }, progressStyle]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
            <View style={[styles.headerRow, { gap: spacing.sm, marginTop: spacing.sm }]}>
              <Pressable
                onPress={() => {
                  if (header.kind === 'user') {
                    onClose();
                    openProfile(card.author.username);
                  }
                }}
                style={[styles.headerRow, { gap: spacing.sm, flexShrink: 1 }]}
                accessibilityRole="button"
                accessibilityLabel={headerTitle}
              >
                {headerAvatar ? (
                  <Image source={{ uri: headerAvatar }} style={styles.headerAvatar} />
                ) : (
                  <Avatar uri={null} size={32} />
                )}
                <Text
                  variant="bodyBold"
                  numberOfLines={1}
                  style={[styles.shadow, { color: colors.onMedia, flexShrink: 1 }]}
                >
                  {headerTitle}
                </Text>
                <Text style={[styles.shadow, { color: colors.onMedia, opacity: 0.85 }]}>
                  {shortAge(card.published_at)}
                </Text>
              </Pressable>
              {card.audience === 'close_friends' ? (
                <View style={[styles.cfBadge, { backgroundColor: colors.closeFriends }]}>
                  <Icon name="star" size={11} color={colors.onMedia} />
                  <Text variant="tiny" style={{ color: colors.onMedia, fontWeight: '700' }}>
                    Close Friends
                  </Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <HeaderButton icon="more" label="More options" onPress={() => setSheet('options')} />
              <HeaderButton icon="close" label="Close" onPress={onClose} />
            </View>
            {card.audio ? (
              <View style={[styles.headerRow, { gap: 4, marginTop: 2, marginLeft: 40 }]}>
                <Icon name="musicFilled" size={12} color={colors.onMedia} />
                <Text
                  variant="caption"
                  numberOfLines={1}
                  style={[styles.shadow, { color: colors.onMedia }]}
                >
                  {card.audio.title} · {card.audio.artist}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {holding ? null : (
        <StoryFooter
          focusSignal={replySignal}
          card={card}
          onTyping={setTyping}
          onOpenViewers={() => props.onOpenViewers?.(card)}
          onOpenOptions={() => setSheet('options')}
          highlightId={header.kind === 'highlight' ? header.highlightId : null}
        />
      )}

      <StoryOptionsSheet
        visible={sheet === 'options'}
        onClose={() => setSheet(null)}
        card={card}
        highlightId={header.kind === 'highlight' ? header.highlightId : null}
        onCloseViewer={onClose}
      />
      <AskSheet
        visible={sheet === 'ask'}
        prompt={askFor?.prompt ?? ''}
        onClose={() => setSheet(null)}
        onSend={(body) => {
          if (askFor) respond.mutate({ storyId: card.id, stickerId: askFor.stickerId, body });
          setSheet(null);
          toast.show('Sent');
        }}
      />
      <ChainSheet
        visible={sheet === 'chain'}
        chainId={chainFor?.chainId}
        prompt={chainFor?.prompt ?? ''}
        onClose={() => setSheet(null)}
        onOpenStory={(id) => {
          setSheet(null);
          onClose();
          router.push({ pathname: '/stories/view', params: { ids: id } });
        }}
      />
    </View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: 'more' | 'close';
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ padding: 4 }}
    >
      <Icon name={icon} size={26} color={colors.onMedia} />
    </Pressable>
  );
}

/** Placeholder page while a reel loads (dark, with a spinner-free progress strip). */
export function StoryLoading({ children }: { children?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.fill, { backgroundColor: colors.mediaBackground }]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { position: 'absolute', top: 8, left: 0, right: 0 },
  bars: { flexDirection: 'row' },
  bar: { flex: 1, height: 2.5, borderRadius: 2, overflow: 'hidden' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  shadow: { textShadowColor: STICKER.shadow, textShadowRadius: 4 },
  cfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
});
