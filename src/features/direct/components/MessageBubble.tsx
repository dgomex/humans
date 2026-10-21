import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

import { Avatar, Icon, Text } from '@/components';
import { avatarUrl } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

import type { Message, ThemeKey } from '../api';
import { THEMES, isBigEmoji, linkPattern } from '../format';
import {
  EphemeralBubble,
  SharedAudioCard,
  SharedPostCard,
  SharedProfileCard,
  StoryPreview,
  Unavailable,
  VoiceBubble,
} from './MessageContent';

const MAX_W = 260;
const REPLY_DISTANCE = 64;

export type BubbleProps = {
  message: Message;
  me: string;
  mine: boolean;
  /** First / last bubble of a run from the same sender (rounding, avatar, name). */
  first: boolean;
  last: boolean;
  group: boolean;
  senderName: string;
  senderAvatar: string | null;
  theme: ThemeKey;
  names: Record<string, string>;
  /** Long-press menu, double-tap ❤️, swipe to reply, open media, tap reactions. */
  onMenu: (m: Message) => void;
  onDoubleTap: (m: Message) => void;
  onReply: (m: Message) => void;
  onOpenMedia: (m: Message) => void;
  onShowReactions: (m: Message) => void;
  onJumpTo: (id: string) => void;
  highlighted?: boolean;
};

/** One message (page 76): bubble or card, reply quote, reactions, gestures. */
export const MessageBubble = memo(function MessageBubble(p: BubbleProps) {
  const { colors, spacing, radius } = useTheme();
  const { message: m, mine } = p;
  const dx = useSharedValue(0);
  const replied = useSharedValue(false);
  const own = THEMES[p.theme] ?? THEMES.default;
  const otherColor = colors.backgroundSecondary;

  const reply = () => {
    if (Platform.OS !== 'web')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    p.onReply(m);
  };

  const pan = Gesture.Pan()
    .activeOffsetX(mine ? [-15, 1000] : [-1000, 15])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const x = mine ? Math.min(0, e.translationX) : Math.max(0, e.translationX);
      dx.set(Math.sign(x) * Math.min(Math.abs(x), REPLY_DISTANCE * 1.4));
      if (Math.abs(x) >= REPLY_DISTANCE && !replied.get()) {
        replied.set(true);
        scheduleOnRN(reply);
      }
    })
    .onFinalize(() => {
      replied.set(false);
      dx.set(withSpring(0, { damping: 18 }));
    });
  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => scheduleOnRN(p.onMenu, m));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd(() => scheduleOnRN(p.onDoubleTap, m));
  const gesture = Gesture.Simultaneous(pan, Gesture.Exclusive(longPress, doubleTap));

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: dx.get() }] }));
  const hint = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(dx.get()), [10, REPLY_DISTANCE], [0, 1], 'clamp'),
  }));

  if (m.kind === 'system') return null;

  const r = radius.xl + 4;
  const corner = 6;
  const bubbleRadius = mine
    ? {
        borderTopLeftRadius: r,
        borderBottomLeftRadius: r,
        borderTopRightRadius: p.first ? r : corner,
        borderBottomRightRadius: p.last ? r : corner,
      }
    : {
        borderTopRightRadius: r,
        borderBottomRightRadius: r,
        borderTopLeftRadius: p.first ? r : corner,
        borderBottomLeftRadius: p.last ? r : corner,
      };
  const fg = mine ? colors.onPrimary : colors.text;

  const textBubble = (body: string) =>
    isBigEmoji(body) ? (
      <Text style={styles.bigEmoji}>{body}</Text>
    ) : (
      <Bubble mine={mine} theme={p.theme} otherColor={otherColor} style={bubbleRadius}>
        <LinkedText text={body} color={fg} />
      </Bubble>
    );

  let content: React.ReactNode;
  let label: string | null = null;
  switch (m.kind) {
    case 'text':
      if (m.data?.story_reply) {
        label = m.data.reaction
          ? mine
            ? 'You reacted to their story'
            : `Reacted to your story`
          : mine
            ? 'You replied to their story'
            : 'Replied to your story';
        content = (
          <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: spacing.xs }}>
            <StoryPreview message={m} small />
            {m.data.reaction ? (
              <Text style={styles.reaction}>{m.body}</Text>
            ) : (
              textBubble(m.body ?? '')
            )}
          </View>
        );
      } else if (m.data?.note) {
        label = mine ? 'You replied to their note' : 'Replied to your note';
        content = (
          <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: spacing.xs }}>
            <View
              style={[
                styles.quote,
                { borderColor: colors.separator, borderRadius: r, padding: spacing.sm },
              ]}
            >
              <Text color="textSecondary" numberOfLines={2}>
                {m.data.note.body ?? `♪ ${m.data.note.audio ?? ''}`}
              </Text>
            </View>
            {textBubble(m.body ?? '')}
          </View>
        );
      } else {
        content = textBubble(m.body ?? '');
      }
      break;
    case 'media':
      content =
        m.view_mode !== 'keep' ? (
          <EphemeralBubble
            message={m}
            mine={mine}
            me={p.me}
            color={mine ? own.colors[1] : otherColor}
            onOpen={() => p.onOpenMedia(m)}
          />
        ) : (
          <MediaThumb message={m} onPress={() => p.onOpenMedia(m)} />
        );
      break;
    case 'voice':
      content = <VoiceBubble message={m} mine={mine} color={mine ? own.colors[1] : otherColor} />;
      break;
    case 'post':
      content = <SharedPostCard postId={m.post_id} />;
      break;
    case 'story':
      content = m.story ? (
        <View style={{ gap: spacing.xs }}>
          <StoryPreview message={m} />
        </View>
      ) : (
        <Unavailable label="Story unavailable" />
      );
      break;
    case 'profile':
      content = m.profile ? (
        <SharedProfileCard profile={m.profile} />
      ) : (
        <Unavailable label="Account unavailable" />
      );
      break;
    case 'audio':
      content = m.audio ? (
        <SharedAudioCard audio={m.audio} />
      ) : (
        <Unavailable label="Audio unavailable" />
      );
      break;
  }

  const reactions = groupReactions(m.reactions);

  return (
    <View
      style={[
        styles.row,
        {
          justifyContent: mine ? 'flex-end' : 'flex-start',
          paddingHorizontal: spacing.md,
          marginTop: p.first ? spacing.sm : 2,
          marginBottom: reactions.length ? spacing.md : 0,
        },
        p.highlighted && { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      {!mine ? (
        <View style={{ width: 28, marginRight: spacing.sm, justifyContent: 'flex-end' }}>
          {p.last ? <Avatar uri={avatarUrl(p.senderAvatar)} size={28} /> : null}
        </View>
      ) : null}
      <Animated.View style={[styles.replyHint, mine ? { right: -36 } : { left: 4 }, hint]}>
        <Icon name="reply" size={18} color={colors.textSecondary} />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[{ maxWidth: MAX_W + 40, alignItems: mine ? 'flex-end' : 'flex-start' }, slide]}
        >
          {p.group && !mine && p.first ? (
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginLeft: spacing.md, marginBottom: 2 }}
            >
              {p.senderName}
            </Text>
          ) : null}
          {label ? (
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginBottom: 2, marginHorizontal: spacing.sm }}
            >
              {label}
            </Text>
          ) : null}
          {m.reply_to ? (
            <ReplyQuote
              quote={m.reply_to}
              mine={mine}
              me={p.me}
              names={p.names}
              thumbUrl={m.replyThumbUrl}
              onPress={() => p.onJumpTo(m.reply_to!.id)}
            />
          ) : null}
          <View>
            {content}
            {reactions.length ? (
              <Pressable
                onPress={() => p.onShowReactions(m)}
                accessibilityRole="button"
                accessibilityLabel={`Reactions: ${reactions.map((x) => x.emoji).join(' ')}`}
                style={[
                  styles.reactions,
                  mine ? { right: 8 } : { left: 8 },
                  { backgroundColor: colors.backgroundElevated, borderColor: colors.background },
                ]}
              >
                <Text variant="caption">
                  {reactions.map((x) => x.emoji).join('')}
                  {m.reactions.length > 1 ? ` ${m.reactions.length}` : ''}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {m.edited_at ? (
            <Text
              variant="tiny"
              color="textSecondary"
              style={{ marginTop: 2, marginHorizontal: spacing.sm }}
            >
              Edited
            </Text>
          ) : null}
          {m.pinned_at ? (
            <View style={[styles.pinned, { marginHorizontal: spacing.sm }]}>
              <Icon name="pin" size={11} color={colors.textSecondary} />
              <Text variant="tiny" color="textSecondary">
                Pinned
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

function Bubble({
  mine,
  theme,
  otherColor,
  style,
  children,
}: {
  mine: boolean;
  theme: ThemeKey;
  otherColor: string;
  style: object;
  children: React.ReactNode;
}) {
  const { spacing } = useTheme();
  const pad = { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1, maxWidth: MAX_W };
  if (!mine) return <View style={[pad, style, { backgroundColor: otherColor }]}>{children}</View>;
  const t = THEMES[theme] ?? THEMES.default;
  return (
    <LinearGradient
      colors={t.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[pad, style]}
    >
      {children}
    </LinearGradient>
  );
}

/** Text with tappable links. */
export function LinkedText({ text, color }: { text: string; color: string }) {
  const parts = text.split(linkPattern);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 20 }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text
            key={i}
            style={{ color, textDecorationLine: 'underline', fontSize: 15, lineHeight: 20 }}
            onPress={() => void Linking.openURL(part.startsWith('http') ? part : `https://${part}`)}
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function MediaThumb({ message, onPress }: { message: Message; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const ratio = (message.width ?? 1) / (message.height ?? 1);
  const w = ratio >= 1 ? MAX_W : Math.max(150, MAX_W * Math.max(ratio, 0.6));
  const h = Math.min(360, w / ratio);
  const uri = message.media_type === 'video' ? (message.thumbUrl ?? null) : message.mediaUrl;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={message.media_type === 'video' ? 'Video' : 'Photo'}
    >
      <Image
        source={uri ? { uri } : null}
        style={{ width: w, height: h, borderRadius: radius.xl, backgroundColor: colors.skeleton }}
        contentFit="cover"
        transition={120}
      />
      {message.media_type === 'video' ? (
        <View style={styles.play}>
          <Icon name="play" size={36} color={colors.onMedia} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ReplyQuote({
  quote,
  mine,
  me,
  names,
  thumbUrl,
  onPress,
}: {
  quote: NonNullable<Message['reply_to']>;
  mine: boolean;
  me: string;
  names: Record<string, string>;
  thumbUrl: string | null;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const toWhom =
    quote.sender_id === me ? (mine ? 'yourself' : 'you') : (names[quote.sender_id] ?? 'them');
  const who = mine ? `You replied to ${toWhom}` : `Replied to ${toWhom}`;
  const text =
    quote.kind === 'text'
      ? quote.body
      : quote.kind === 'voice'
        ? 'Voice message'
        : quote.kind === 'media'
          ? quote.view_mode === 'keep'
            ? null
            : quote.media_type === 'video'
              ? 'Video'
              : 'Photo'
          : quote.kind === 'post'
            ? 'Post'
            : 'Attachment';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${who}: ${text ?? 'photo'}`}
    >
      <Text
        variant="caption"
        color="textSecondary"
        style={{
          marginBottom: 2,
          marginHorizontal: spacing.sm,
          textAlign: mine ? 'right' : 'left',
        }}
      >
        {who}
      </Text>
      {thumbUrl && !text ? (
        <Image
          source={{ uri: thumbUrl }}
          style={{
            width: 80,
            height: 100,
            borderRadius: radius.lg,
            opacity: 0.6,
            marginBottom: -8,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.quote,
            {
              borderColor: colors.separator,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              paddingBottom: spacing.md,
              marginBottom: -8,
              maxWidth: MAX_W - 20,
            },
          ]}
        >
          <Text color="textSecondary" numberOfLines={2}>
            {text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function groupReactions(list: Message['reactions']) {
  const seen = new Map<string, number>();
  for (const r of list) seen.set(r.emoji, (seen.get(r.emoji) ?? 0) + 1);
  return [...seen.entries()].slice(0, 3).map(([emoji, count]) => ({ emoji, count }));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  bigEmoji: { fontSize: 44, lineHeight: 52 },
  reaction: { fontSize: 36, lineHeight: 44 },
  quote: { borderWidth: StyleSheet.hairlineWidth, opacity: 0.85 },
  reactions: {
    position: 'absolute',
    bottom: -14,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 2,
  },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  play: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  replyHint: { position: 'absolute', alignSelf: 'center' },
});
