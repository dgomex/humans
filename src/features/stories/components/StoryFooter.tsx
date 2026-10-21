import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text, useToast, type IconName } from '@/components';
import { formatCount } from '@/features/profile/format';
import { useTheme } from '@/theme';

import { useSendStoryReply, useToggleStoryLike, type StoryCard } from '../api';
import { QUICK_REACTIONS } from '../style';
import { HighlightPickerSheet } from './StorySheets';

/**
 * Bottom of the story viewer. Others' stories: "Send message" (replies stored now, DMs in
 * Phase 9) with quick reactions while focused, ♡ like, ✈ share. Own stories: Activity (viewers,
 * page 56), Highlight, More.
 */
export function StoryFooter({
  focusSignal,
  card,
  onTyping,
  onOpenViewers,
  onOpenOptions,
  highlightId,
}: {
  /** Increments when the viewer swipes up: focus the reply field. */
  focusSignal: number;
  card: StoryCard;
  onTyping: (typing: boolean) => void;
  onOpenViewers: () => void;
  onOpenOptions: () => void;
  highlightId: string | null;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const like = useToggleStoryLike();
  const reply = useSendStoryReply();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlightSheet, setHighlightSheet] = useState(false);

  useEffect(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);

  function send(body: string, isReaction = false) {
    const trimmed = body.trim();
    if (!trimmed) return;
    reply.mutate(
      { storyId: card.id, body: trimmed, isReaction },
      {
        onSuccess: () => toast.show(isReaction ? `Sent ${trimmed}` : 'Message sent'),
        onError: () => toast.show("Couldn't send. Try again."),
      },
    );
    setText('');
    input.current?.blur();
  }

  if (card.is_own) {
    return (
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.sm,
            gap: spacing.xl,
          },
        ]}
      >
        <Pressable
          onPress={onOpenViewers}
          style={[styles.row, { gap: 6, flex: 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Activity"
          accessibilityHint="Shows who viewed your story"
        >
          <Icon name="eye" size={22} color={colors.onMedia} />
          <Text variant="bodyBold" style={{ color: colors.onMedia }}>
            {card.view_count ? `Activity · ${formatCount(card.view_count)}` : 'Activity'}
          </Text>
        </Pressable>
        {highlightId ? null : (
          <FooterAction
            icon="addCircle"
            label="Highlight"
            onPress={() => setHighlightSheet(true)}
          />
        )}
        <FooterAction
          icon="sendPlane"
          label="Send"
          onPress={() => router.push({ pathname: '/direct/send', params: { story: card.id } })}
        />
        <FooterAction icon="more" label="More" onPress={onOpenOptions} />
        <HighlightPickerSheet
          visible={highlightSheet}
          storyId={card.id}
          onClose={() => setHighlightSheet(false)}
        />
      </View>
    );
  }

  const canReply = card.is_active && card.replies_allowed;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {focused && !text ? (
        // Quick reactions float above the field while it's focused and empty.
        <View style={[styles.reactions, { bottom: '100%', paddingHorizontal: spacing.xl }]}>
          <Text
            variant="bodyBold"
            style={{ color: colors.onMedia, textAlign: 'center', marginBottom: spacing.lg }}
          >
            Quick reactions
          </Text>
          <View style={[styles.grid, { gap: spacing.lg }]}>
            {QUICK_REACTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  if (Platform.OS !== 'web')
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  send(e, true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`React with ${e}`}
                style={styles.reaction}
              >
                <RNText style={{ fontSize: 40 }}>{e}</RNText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.sm,
            gap: spacing.md,
          },
        ]}
      >
        {canReply ? (
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            onFocus={() => {
              setFocused(true);
              onTyping(true);
            }}
            onBlur={() => {
              setFocused(false);
              onTyping(false);
            }}
            onSubmitEditing={() => send(text)}
            placeholder="Send message"
            placeholderTextColor={colors.onMedia}
            returnKeyType="send"
            maxLength={1000}
            style={[styles.field, { color: colors.onMedia, borderColor: colors.mediaGrid }]}
            accessibilityLabel={`Reply to ${card.author.username}`}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {text.trim() ? (
          <Pressable
            onPress={() => send(text)}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Text variant="bodyBold" style={{ color: colors.onMedia }}>
              Send
            </Text>
          </Pressable>
        ) : (
          <>
            {card.is_active ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web')
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  like.mutate({ id: card.id, liked: card.liked });
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={card.liked ? 'Unlike story' : 'Like story'}
                accessibilityState={{ selected: card.liked }}
              >
                <Icon
                  name={card.liked ? 'heartFilled' : 'heart'}
                  size={28}
                  color={card.liked ? colors.like : colors.onMedia}
                />
              </Pressable>
            ) : null}
            {card.author.is_private ? null : (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/direct/send', params: { story: card.id } })
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share"
              >
                <Icon name="share" size={26} color={colors.onMedia} />
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function FooterAction({
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
      style={{ alignItems: 'center', gap: 2 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={24} color={colors.onMedia} />
      <Text variant="tiny" style={{ color: colors.onMedia }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  field: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  reactions: { position: 'absolute', left: 0, right: 0, paddingBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  reaction: { width: 64, alignItems: 'center' },
});
