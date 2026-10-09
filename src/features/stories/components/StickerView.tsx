import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components';
import { usePostCard } from '@/features/feed/api';
import { avatarUrl } from '@/features/profile/avatar';

import type { CardSticker } from '../api';
import { STICKER } from '../style';
import type { StickerData } from '../types';

export type StickerActions = {
  onVote?: (stickerId: string, option: number) => void;
  onSlide?: (stickerId: string, value: number) => void;
  onAsk?: (stickerId: string, prompt: string) => void;
  onRemind?: (stickerId: string, on: boolean) => void;
  onAddYours?: (stickerId: string, chainId: string, prompt: string) => void;
  onOpenChain?: (chainId: string, prompt: string) => void;
  onMention?: (username: string) => void;
  onHashtag?: (tag: string) => void;
  onLink?: (url: string) => void;
  onPost?: (postId: string) => void;
};

export type StickerContext = {
  /** Server state of interactive stickers (viewer); absent in the editor. */
  card?: CardSticker | null;
  music?: { title: string; artist: string; cover_color?: string } | null;
  resolve?: (path: string) => string | null | undefined;
  /** Author avatar (question sticker). */
  authorAvatar?: string | null;
  actions?: StickerActions;
  /** Editor: stickers are only placed, not answered. */
  preview?: boolean;
};

const CARD_W = 760;

/** A Pressable only when there's an action: previews (editor, thumbnails) render plain views,
 * so a sticker never nests a button inside another one (archive tiles). */
function Tap({ onPress, children, ...rest }: PressableProps & { children: ReactNode }) {
  if (!onPress) return <View>{children}</View>;
  return (
    <Pressable onPress={onPress} {...rest}>
      {children}
    </Pressable>
  );
}

/** One sticker drawn at canvas scale `k` (units → pixels). */
export function StickerView({
  sticker,
  k,
  ctx,
}: {
  sticker: StickerData;
  k: number;
  ctx: StickerContext;
}) {
  const u = (n: number) => n * k;
  const act = ctx.preview ? undefined : ctx.actions;

  switch (sticker.kind) {
    case 'mention':
    case 'hashtag': {
      const label = sticker.kind === 'mention' ? `@${sticker.username}` : `#${sticker.tag}`;
      const onPress =
        sticker.kind === 'mention'
          ? act?.onMention && (() => act.onMention!(sticker.username))
          : act?.onHashtag && (() => act.onHashtag!(sticker.tag));
      return (
        <Tap
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole="link"
          accessibilityLabel={label}
        >
          <View
            style={[
              styles.pill,
              { paddingHorizontal: u(34), paddingVertical: u(18), borderRadius: u(22) },
            ]}
          >
            <RNText
              style={{
                fontSize: u(54),
                fontWeight: '800',
                color: sticker.kind === 'mention' ? STICKER.mention : STICKER.hashtag,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </RNText>
          </View>
        </Tap>
      );
    }
    case 'link': {
      const host = sticker.url.replace(/^https?:\/\//i, '').split('/')[0];
      const onPress = act?.onLink && (() => act.onLink!(sticker.url));
      return (
        <Tap
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole="link"
          accessibilityLabel={sticker.label || host}
        >
          <View
            style={[
              styles.pill,
              styles.row,
              { gap: u(14), paddingHorizontal: u(32), paddingVertical: u(20), borderRadius: u(22) },
            ]}
          >
            <Icon name="link" size={u(52)} color={STICKER.link} />
            <RNText
              numberOfLines={1}
              style={{ fontSize: u(46), fontWeight: '700', color: STICKER.link, maxWidth: u(640) }}
            >
              {(sticker.label || host).toUpperCase()}
            </RNText>
          </View>
        </Tap>
      );
    }
    case 'poll':
      return <PollSticker sticker={sticker} k={k} ctx={ctx} quiz={false} />;
    case 'quiz':
      return <PollSticker sticker={sticker} k={k} ctx={ctx} quiz />;
    case 'question': {
      const answered = (ctx.card?.mine?.length ?? 0) > 0;
      return (
        <View style={[styles.card, { width: u(CARD_W), borderRadius: u(36) }]}>
          <View style={{ alignItems: 'center', marginTop: u(-60) }}>
            <View
              style={[
                styles.avatarRing,
                { width: u(110), height: u(110), borderRadius: u(55), borderWidth: u(6) },
              ]}
            >
              {ctx.authorAvatar ? (
                <Image
                  source={{ uri: ctx.authorAvatar }}
                  style={{ width: u(98), height: u(98), borderRadius: u(49) }}
                />
              ) : (
                <View
                  style={{
                    width: u(98),
                    height: u(98),
                    borderRadius: u(49),
                    backgroundColor: STICKER.muted,
                  }}
                />
              )}
            </View>
          </View>
          <RNText style={[styles.prompt, { fontSize: u(48), padding: u(28), paddingTop: u(12) }]}>
            {sticker.prompt}
          </RNText>
          <Tap
            onPress={act?.onAsk && (() => act.onAsk!(sticker.stickerId, sticker.prompt))}
            disabled={!act?.onAsk}
            accessibilityRole="button"
            accessibilityLabel="Answer the question"
          >
            <View
              style={[
                styles.field,
                { margin: u(28), marginTop: 0, padding: u(26), borderRadius: u(20) },
              ]}
            >
              <RNText style={{ fontSize: u(40), color: STICKER.muted, textAlign: 'center' }}>
                {answered ? 'Sent! Tap to send another' : 'Type something...'}
              </RNText>
            </View>
          </Tap>
        </View>
      );
    }
    case 'slider':
      return <SliderSticker sticker={sticker} k={k} ctx={ctx} />;
    case 'countdown':
      return <CountdownSticker sticker={sticker} k={k} ctx={ctx} />;
    case 'add_yours': {
      const participants = ctx.card?.results?.participants ?? 0;
      const chainId = ctx.card?.chain_id ?? sticker.stickerId;
      return (
        <View
          style={[
            styles.card,
            { width: u(CARD_W), borderRadius: u(36), padding: u(30), gap: u(18) },
          ]}
        >
          <RNText
            style={{ fontSize: u(40), fontWeight: '800', color: STICKER.ink, textAlign: 'center' }}
          >
            Add Yours
          </RNText>
          <RNText style={[styles.prompt, { fontSize: u(50) }]}>{sticker.prompt}</RNText>
          {participants > 0 ? (
            <Tap
              onPress={act?.onOpenChain && (() => act.onOpenChain!(chainId, sticker.prompt))}
              disabled={!act?.onOpenChain}
              accessibilityRole="button"
            >
              <RNText style={{ fontSize: u(36), color: STICKER.muted, textAlign: 'center' }}>
                {participants === 1 ? '1 participant' : `${participants} participants`} ›
              </RNText>
            </Tap>
          ) : null}
          <Tap
            onPress={
              act?.onAddYours && (() => act.onAddYours!(sticker.stickerId, chainId, sticker.prompt))
            }
            disabled={!act?.onAddYours}
            accessibilityRole="button"
            accessibilityLabel="Add yours"
          >
            <View
              style={[
                styles.field,
                styles.row,
                { justifyContent: 'center', gap: u(10), padding: u(24), borderRadius: u(20) },
              ]}
            >
              <Icon name="add" size={u(46)} color={STICKER.ink} />
              <RNText style={{ fontSize: u(42), fontWeight: '700', color: STICKER.ink }}>
                Add yours
              </RNText>
            </View>
          </Tap>
        </View>
      );
    }
    case 'time': {
      const d = new Date(sticker.at);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return (
        <RNText
          style={{
            fontSize: u(150),
            fontWeight: '300',
            color: STICKER.onMedia,
            textShadowColor: STICKER.shadow,
            textShadowRadius: u(12),
            fontVariant: ['tabular-nums'],
          }}
        >
          {hh}:{mm}
        </RNText>
      );
    }
    case 'photo': {
      const uri = ctx.resolve?.(sticker.path) ?? sticker.path;
      const w = 520;
      const h = (w * sticker.height) / Math.max(1, sticker.width);
      return (
        <View style={[styles.photo, { padding: u(10), borderRadius: u(28) }]}>
          <Image
            source={{ uri }}
            style={{ width: u(w), height: u(h), borderRadius: u(20) }}
            contentFit="cover"
          />
        </View>
      );
    }
    case 'post':
      return <PostSticker postId={sticker.postId} k={k} onPress={act?.onPost} />;
    case 'music': {
      const m = ctx.music;
      if (!m) return null;
      return sticker.style === 'compact' ? (
        <View
          style={[
            styles.pill,
            styles.row,
            { gap: u(14), paddingHorizontal: u(28), paddingVertical: u(16), borderRadius: u(40) },
          ]}
        >
          <Icon name="musicFilled" size={u(42)} color={STICKER.ink} />
          <RNText
            numberOfLines={1}
            style={{ fontSize: u(40), fontWeight: '700', color: STICKER.ink, maxWidth: u(600) }}
          >
            {m.title} · {m.artist}
          </RNText>
        </View>
      ) : (
        <View
          style={[
            styles.card,
            styles.row,
            { width: u(640), padding: u(22), gap: u(24), borderRadius: u(30) },
          ]}
        >
          <View
            style={[
              styles.cover,
              {
                width: u(150),
                height: u(150),
                borderRadius: u(16),
                backgroundColor: m.cover_color ?? STICKER.accent,
              },
            ]}
          >
            <Icon name="musicFilled" size={u(70)} color={STICKER.onMedia} />
          </View>
          <View style={{ flex: 1 }}>
            <RNText
              numberOfLines={1}
              style={{ fontSize: u(46), fontWeight: '800', color: STICKER.ink }}
            >
              {m.title}
            </RNText>
            <RNText numberOfLines={1} style={{ fontSize: u(38), color: STICKER.muted }}>
              {m.artist}
            </RNText>
          </View>
        </View>
      );
    }
    case 'answer':
      return (
        <View style={[styles.card, { width: u(CARD_W), borderRadius: u(36), overflow: 'hidden' }]}>
          <View style={{ backgroundColor: STICKER.accent, padding: u(26) }}>
            <RNText
              style={{
                fontSize: u(42),
                fontWeight: '700',
                color: STICKER.onMedia,
                textAlign: 'center',
              }}
            >
              {sticker.prompt}
            </RNText>
          </View>
          <RNText style={[styles.prompt, { fontSize: u(50), padding: u(32) }]}>
            {sticker.body}
          </RNText>
        </View>
      );
  }
}

// ---------------------------------------------------------------------------------------------

function PollSticker({
  sticker,
  k,
  ctx,
  quiz,
}: {
  sticker: Extract<StickerData, { kind: 'poll' | 'quiz' }>;
  k: number;
  ctx: StickerContext;
  quiz: boolean;
}) {
  const u = (n: number) => n * k;
  const mine = ctx.card?.mine?.[0]?.option ?? null;
  const results = ctx.card?.results;
  const total = results?.total ?? 0;
  // Viewers see results after answering; the author (no onVote) always does.
  const showResults = !ctx.preview && (mine !== null || (results != null && !ctx.actions?.onVote));
  const correct = results?.correct ?? null;
  const onVote = !ctx.preview && mine === null ? ctx.actions?.onVote : undefined;

  return (
    <View style={[styles.card, { width: u(CARD_W), borderRadius: u(36), overflow: 'hidden' }]}>
      {sticker.question || quiz ? (
        quiz ? (
          <View style={{ backgroundColor: STICKER.quiz, padding: u(28) }}>
            <RNText
              style={{
                fontSize: u(46),
                fontWeight: '800',
                color: STICKER.onMedia,
                textAlign: 'center',
              }}
            >
              {sticker.question || 'Quiz'}
            </RNText>
          </View>
        ) : (
          <RNText
            style={[
              styles.prompt,
              { fontSize: u(50), paddingHorizontal: u(28), paddingTop: u(28) },
            ]}
          >
            {sticker.question}
          </RNText>
        )
      ) : null}
      <View style={{ padding: u(24), gap: u(16) }}>
        {sticker.options.map((label, i) => {
          const count = results?.counts?.[i] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMine = mine === i;
          const isCorrect = quiz && showResults && correct === i;
          const isWrong = quiz && showResults && isMine && correct !== null && correct !== i;
          const fill = isCorrect ? STICKER.correct : isWrong ? STICKER.wrong : STICKER.accentSoft;
          return (
            <Tap
              key={i}
              onPress={
                onVote
                  ? () => {
                      if (Platform.OS !== 'web') void Haptics.selectionAsync();
                      onVote(sticker.stickerId, i);
                    }
                  : undefined
              }
              disabled={!onVote}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isMine }}
            >
              <View style={[styles.option, { borderRadius: u(22), minHeight: u(96) }]}>
                {showResults ? (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        // Quiz: the right (and a wrongly picked) answer fills its row; polls show bars.
                        width: `${quiz ? (isCorrect || isWrong ? 100 : 0) : pct}%`,
                        backgroundColor: fill,
                        borderRadius: u(22),
                      },
                    ]}
                  />
                ) : null}
                <View style={[styles.row, { paddingHorizontal: u(28), gap: u(16), flex: 1 }]}>
                  {quiz ? (
                    <View
                      style={[styles.letter, { width: u(56), height: u(56), borderRadius: u(28) }]}
                    >
                      <RNText style={{ fontSize: u(30), fontWeight: '800', color: STICKER.ink }}>
                        {String.fromCharCode(65 + i)}
                      </RNText>
                    </View>
                  ) : null}
                  <RNText
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      fontSize: u(44),
                      fontWeight: '700',
                      color:
                        isCorrect || isWrong
                          ? STICKER.onMedia
                          : quiz || showResults
                            ? STICKER.ink
                            : STICKER.accent,
                      textAlign: quiz || showResults ? 'left' : 'center',
                    }}
                  >
                    {label}
                  </RNText>
                  {showResults ? (
                    <RNText
                      style={{
                        fontSize: u(38),
                        fontWeight: '700',
                        color: isCorrect || isWrong ? STICKER.onMedia : STICKER.ink,
                      }}
                    >
                      {pct}%
                    </RNText>
                  ) : null}
                </View>
              </View>
            </Tap>
          );
        })}
        {showResults && total > 0 ? (
          <RNText style={{ fontSize: u(32), color: STICKER.muted, textAlign: 'center' }}>
            {total === 1 ? '1 vote' : `${total} votes`}
          </RNText>
        ) : null}
      </View>
    </View>
  );
}

function SliderSticker({
  sticker,
  k,
  ctx,
}: {
  sticker: Extract<StickerData, { kind: 'slider' }>;
  k: number;
  ctx: StickerContext;
}) {
  const u = (n: number) => n * k;
  const trackW = u(CARD_W - 120);
  const mine = ctx.card?.mine?.[0]?.value ?? null;
  const average = ctx.card?.results?.average ?? null;
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? mine ?? 0;
  const canSlide = !ctx.preview && mine === null && !!ctx.actions?.onSlide;

  const clamp = (x: number) => Math.min(1, Math.max(0, x / trackW));
  const commit = (v: number) => {
    setDrag(null);
    ctx.actions?.onSlide?.(sticker.stickerId, Math.round(v * 100) / 100);
  };
  const pan = Gesture.Pan()
    .enabled(canSlide)
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(setDrag, clamp(e.x)))
    .onUpdate((e) => scheduleOnRN(setDrag, clamp(e.x)))
    .onEnd((e) => scheduleOnRN(commit, clamp(e.x)));

  return (
    <View
      style={[styles.card, { width: u(CARD_W), borderRadius: u(36), padding: u(36), gap: u(30) }]}
    >
      {sticker.question ? (
        <RNText style={[styles.prompt, { fontSize: u(48) }]}>{sticker.question}</RNText>
      ) : null}
      <GestureDetector gesture={pan}>
        <View
          style={{ height: u(110), justifyContent: 'center', marginHorizontal: u(24) }}
          accessibilityRole="adjustable"
        >
          <View style={[styles.track, { height: u(18), borderRadius: u(9) }]}>
            <LinearGradient
              colors={[STICKER.sliderFrom, STICKER.sliderTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: value * trackW, height: '100%', borderRadius: u(9) }}
            />
          </View>
          {average !== null && mine !== null ? (
            <View
              style={[
                styles.avgDot,
                {
                  left: average * trackW - u(22),
                  width: u(44),
                  height: u(44),
                  borderRadius: u(22),
                },
              ]}
            />
          ) : null}
          <RNText
            style={{
              position: 'absolute',
              left: value * trackW - u(45),
              fontSize: u(drag !== null ? 110 : 80),
            }}
          >
            {sticker.emoji}
          </RNText>
        </View>
      </GestureDetector>
      {average !== null && mine !== null ? (
        <RNText style={{ fontSize: u(32), color: STICKER.muted, textAlign: 'center' }}>
          Average answer
        </RNText>
      ) : null}
    </View>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CountdownSticker({
  sticker,
  k,
  ctx,
}: {
  sticker: Extract<StickerData, { kind: 'countdown' }>;
  k: number;
  ctx: StickerContext;
}) {
  const u = (n: number) => n * k;
  const now = useNow(1000);
  const left = Math.max(0, new Date(sticker.endsAt).getTime() - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const mins = Math.floor((left % 3_600_000) / 60_000);
  const secs = Math.floor((left % 60_000) / 1000);
  const reminded = (ctx.card?.mine?.length ?? 0) > 0;
  const onRemind = !ctx.preview && left > 0 ? ctx.actions?.onRemind : undefined;
  const cells: [number, string][] =
    days > 0
      ? [
          [days, 'days'],
          [hours, 'hours'],
          [mins, 'minutes'],
        ]
      : [
          [hours, 'hours'],
          [mins, 'minutes'],
          [secs, 'seconds'],
        ];

  return (
    <LinearGradient
      colors={[STICKER.countdownFrom, STICKER.countdownTo]}
      style={{ width: u(CARD_W), borderRadius: u(36), padding: u(34), gap: u(22) }}
    >
      <RNText
        style={{ fontSize: u(46), fontWeight: '800', color: STICKER.onMedia, textAlign: 'center' }}
      >
        {sticker.title.toUpperCase()}
      </RNText>
      {left > 0 ? (
        <View style={[styles.row, { justifyContent: 'center', gap: u(18) }]}>
          {cells.map(([n, label]) => (
            <View key={label} style={{ alignItems: 'center' }}>
              <View
                style={[
                  styles.digit,
                  { paddingHorizontal: u(20), paddingVertical: u(10), borderRadius: u(16) },
                ]}
              >
                <RNText
                  style={{
                    fontSize: u(80),
                    fontWeight: '300',
                    color: STICKER.onMedia,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {String(n).padStart(2, '0')}
                </RNText>
              </View>
              <RNText style={{ fontSize: u(28), color: STICKER.onMedia, opacity: 0.8 }}>
                {label}
              </RNText>
            </View>
          ))}
        </View>
      ) : (
        <RNText style={{ fontSize: u(44), color: STICKER.onMedia, textAlign: 'center' }}>
          Countdown ended
        </RNText>
      )}
      {onRemind ? (
        <Tap
          onPress={() => onRemind(sticker.stickerId, !reminded)}
          accessibilityRole="switch"
          accessibilityState={{ checked: reminded }}
        >
          <View
            style={[
              styles.row,
              styles.remind,
              { justifyContent: 'center', gap: u(12), padding: u(18), borderRadius: u(20) },
            ]}
          >
            <Icon name={reminded ? 'bellFilled' : 'bell'} size={u(42)} color={STICKER.onMedia} />
            <RNText style={{ fontSize: u(38), fontWeight: '700', color: STICKER.onMedia }}>
              {reminded ? 'Reminder set' : 'Remind me'}
            </RNText>
          </View>
        </Tap>
      ) : null}
    </LinearGradient>
  );
}

function PostSticker({
  postId,
  k,
  onPress,
}: {
  postId: string;
  k: number;
  onPress?: (postId: string) => void;
}) {
  const u = (n: number) => n * k;
  const card = usePostCard(postId);
  const post = card.data;
  const first = post?.media[0];
  const uri = first ? (first.type === 'video' ? first.thumbUrl : first.url) : null;
  const w = 600;
  const h = post ? w / Math.max(0.75, Math.min(1.91, post.aspect_ratio)) : w;
  return (
    <Tap
      onPress={onPress && post ? () => onPress(postId) : undefined}
      disabled={!onPress || !post}
      accessibilityRole="button"
      accessibilityLabel="Open post"
    >
      <View
        style={[styles.card, { width: u(w + 40), borderRadius: u(30), padding: u(20), gap: u(16) }]}
      >
        {post ? (
          <>
            <View style={[styles.row, { gap: u(16) }]}>
              {post.author.avatar_path ? (
                <Image
                  source={{ uri: avatarUrl(post.author.avatar_path) ?? undefined }}
                  style={{ width: u(60), height: u(60), borderRadius: u(30) }}
                />
              ) : (
                <View
                  style={{
                    width: u(60),
                    height: u(60),
                    borderRadius: u(30),
                    backgroundColor: STICKER.muted,
                  }}
                />
              )}
              <RNText style={{ fontSize: u(38), fontWeight: '700', color: STICKER.ink }}>
                {post.author.username}
              </RNText>
            </View>
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: u(w), height: u(h), borderRadius: u(12) }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: u(w),
                  height: u(h),
                  borderRadius: u(12),
                  backgroundColor: STICKER.muted,
                }}
              />
            )}
            {post.caption ? (
              <RNText numberOfLines={2} style={{ fontSize: u(34), color: STICKER.ink }}>
                <RNText style={{ fontWeight: '700' }}>{post.author.username} </RNText>
                {post.caption}
              </RNText>
            ) : null}
          </>
        ) : (
          <RNText
            style={{ fontSize: u(38), color: STICKER.muted, padding: u(40), textAlign: 'center' }}
          >
            {card.isPending ? 'Loading post…' : 'This post is unavailable'}
          </RNText>
        )}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { backgroundColor: STICKER.paper },
  card: { backgroundColor: STICKER.paper },
  prompt: { color: STICKER.ink, fontWeight: '700', textAlign: 'center' },
  field: { backgroundColor: STICKER.field },
  option: {
    backgroundColor: STICKER.field,
    justifyContent: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  letter: { backgroundColor: STICKER.paper, alignItems: 'center', justifyContent: 'center' },
  track: { backgroundColor: STICKER.field, overflow: 'hidden' },
  avgDot: {
    position: 'absolute',
    backgroundColor: STICKER.accent,
    borderWidth: 2,
    borderColor: STICKER.paper,
  },
  digit: { backgroundColor: STICKER.glass },
  remind: { backgroundColor: STICKER.glass },
  avatarRing: {
    backgroundColor: STICKER.paper,
    borderColor: STICKER.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { backgroundColor: STICKER.paper },
  cover: { alignItems: 'center', justifyContent: 'center' },
});
