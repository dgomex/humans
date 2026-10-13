import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Avatar, Icon, Text } from '@/components';
import { useHashtagSuggestions, useSearchProfiles } from '@/features/posts/api';
import {
  ACTIVE_TOKEN,
  cursorAfterEdit,
  HashtagRow,
} from '@/features/posts/components/CaptionInput';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount } from '@/features/profile/format';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

/** Instagram's quick emoji bar above the comment field. */
const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];
export const MAX_COMMENT = 2200;
const MAX_COMMENT_MENTIONS = 5;

export type CommentComposerHandle = { focus: () => void; setText: (t: string) => void };

/**
 * Page 46 — bottom composer: emoji bar, "Replying to …" strip, @/# suggestions (shown above the
 * field), own avatar, field and Post button.
 */
export const CommentComposer = forwardRef<
  CommentComposerHandle,
  {
    avatarPath: string | null | undefined;
    authorUsername: string;
    replyingTo: string | null;
    onCancelReply: () => void;
    onSubmit: (text: string) => void;
    autoFocus?: boolean;
    /** Prefilled text (e.g. "@user " when opened to reply from Activity). */
    initialText?: string;
  }
>(function CommentComposer(
  { avatarPath, authorUsername, replyingTo, onCancelReply, onSubmit, autoFocus, initialText },
  ref,
) {
  const { colors, spacing, radius, hairline } = useTheme();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState(initialText ?? '');
  const [selection, setSelection] = useState(() => {
    const end = initialText?.length ?? 0;
    return { start: end, end };
  });
  const [forced, setForced] = useState<{ start: number; end: number } | undefined>();

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    setText: (t: string) => {
      setText(t);
      setSelection({ start: t.length, end: t.length });
      setForced({ start: t.length, end: t.length });
    },
  }));

  const beforeCursor = text.slice(0, selection.start);
  const match = selection.start === selection.end ? beforeCursor.match(ACTIVE_TOKEN) : null;
  const kind = match ? (match[2] === '@' ? 'mention' : 'hashtag') : null;
  const term = useDebounced(match?.[3] ?? '', 150);
  const people = useSearchProfiles(term, kind === 'mention');
  const tags = useHashtagSuggestions(term, kind === 'hashtag');

  const mentions = (text.match(/@[A-Za-z0-9._]+/g) ?? []).length;
  const problem =
    text.length > MAX_COMMENT
      ? `Comments can be up to ${MAX_COMMENT} characters.`
      : mentions > MAX_COMMENT_MENTIONS
        ? `You can mention up to ${MAX_COMMENT_MENTIONS} accounts in a comment.`
        : null;
  const canPost = text.trim().length > 0 && !problem;

  function insert(snippet: string) {
    const next = text.slice(0, selection.start) + snippet + text.slice(selection.end);
    const cursor = selection.start + snippet.length;
    setText(next);
    setSelection({ start: cursor, end: cursor });
    setForced({ start: cursor, end: cursor });
  }

  function complete(word: string) {
    if (!match) return;
    const tokenStart = selection.start - match[3].length - 1;
    const piece = `${match[2]}${word} `;
    const next = text.slice(0, tokenStart) + piece + text.slice(selection.end);
    const cursor = tokenStart + piece.length;
    setText(next);
    setSelection({ start: cursor, end: cursor });
    setForced({ start: cursor, end: cursor });
  }

  function submit() {
    if (!canPost) return;
    onSubmit(text.trim());
    setText('');
    setSelection({ start: 0, end: 0 });
    setForced({ start: 0, end: 0 });
  }

  return (
    <View style={{ borderTopWidth: hairline, borderTopColor: colors.separator }}>
      {kind ? (
        <ScrollView
          style={{ maxHeight: 220, borderBottomWidth: hairline, borderColor: colors.separator }}
          keyboardShouldPersistTaps="always"
        >
          {kind === 'mention' ? (
            <>
              {people.isPending ? <ActivityIndicator style={{ margin: spacing.md }} /> : null}
              {(people.data ?? []).slice(0, 6).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => complete(p.username)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.suggestion,
                    {
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      backgroundColor: pressed ? colors.backgroundPressed : 'transparent',
                    },
                  ]}
                >
                  <Avatar uri={avatarUrl(p.avatar_path)} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyBold">{p.username}</Text>
                    {p.full_name ? <Text color="textSecondary">{p.full_name}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </>
          ) : (
            (tags.data ?? []).map((t) => (
              <HashtagRow
                key={t.name}
                name={t.name}
                detail={`${formatCount(t.post_count)} ${t.post_count === 1 ? 'post' : 'posts'}`}
                onPress={complete}
              />
            ))
          )}
        </ScrollView>
      ) : null}

      {replyingTo ? (
        <View
          style={[
            styles.row,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
        >
          <Text color="textSecondary" style={{ flex: 1 }}>
            Replying to {replyingTo}
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={10} accessibilityLabel="Cancel reply">
            <Icon name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.row,
          styles.emoji,
          { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
        ]}
      >
        {QUICK_EMOJI.map((e) => (
          <Pressable key={e} onPress={() => insert(e)} hitSlop={4} accessibilityLabel={`Add ${e}`}>
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>

      {problem ? (
        <Text variant="caption" color="danger" style={{ paddingHorizontal: spacing.lg }}>
          {problem}
        </Text>
      ) : null}

      <View style={[styles.row, { gap: spacing.sm, padding: spacing.md }]}>
        <Avatar uri={avatarUrl(avatarPath)} size={36} />
        <View
          style={[
            styles.field,
            {
              borderColor: colors.separator,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <TextInput
            ref={input}
            value={text}
            onChangeText={(t) => {
              setForced(undefined);
              const cursor = cursorAfterEdit(text, t);
              setSelection({ start: cursor, end: cursor });
              setText(t);
            }}
            onSelectionChange={(e) => {
              setForced(undefined);
              setSelection(e.nativeEvent.selection);
            }}
            selection={forced}
            autoFocus={autoFocus}
            multiline
            placeholder={
              replyingTo ? `Reply to ${replyingTo}…` : `Add a comment for ${authorUsername}…`
            }
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Comment"
            style={[styles.input, { color: colors.text }]}
          />
          {canPost ? (
            <Pressable
              onPress={submit}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Icon name="sendPlane" size={16} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { justifyContent: 'space-between' },
  emojiText: { fontSize: 26, lineHeight: 32 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8, maxHeight: 110 },
  send: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
