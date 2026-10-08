import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount } from '@/features/profile/format';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

import { useHashtagSuggestions, useSearchProfiles } from '../api';

export const MAX_CAPTION = 2200;
export const MAX_HASHTAGS = 30;
export const MAX_MENTIONS = 20;

// The @/# word that ends at the cursor.
export const ACTIVE_TOKEN = /(^|\s)([@#])([\p{L}\p{N}._]*)$/u;

export function captionProblems(caption: string): string | null {
  if (caption.length > MAX_CAPTION) return `Captions can be up to ${MAX_CAPTION} characters.`;
  if ((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > MAX_HASHTAGS) {
    return `You can use up to ${MAX_HASHTAGS} hashtags.`;
  }
  if ((caption.match(/@[A-Za-z0-9._]+/g) ?? []).length > MAX_MENTIONS) {
    return `You can mention up to ${MAX_MENTIONS} accounts.`;
  }
  return null;
}

type Selection = { start: number; end: number };

/** Cursor position after `before` became `after` (end of the inserted text / deletion point). */
export function cursorAfterEdit(before: string, after: string) {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  return after.length >= before.length ? i + (after.length - before.length) : i;
}

/**
 * Caption field (pages 36 and 41). Typing @ or # opens suggestions (accounts you follow first /
 * popular hashtags); picking one completes the word. `onSuggesting` lets the screen hide its other
 * rows while the list is open, like Instagram.
 */
export function CaptionInput({
  value,
  onChangeText,
  onSuggesting,
  autoFocus,
  placeholder = 'Add a caption...',
  leading,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSuggesting?: (active: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
  leading?: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const [selection, setSelection] = useState<Selection>({ start: value.length, end: value.length });
  const [forced, setForced] = useState<Selection | undefined>(undefined);

  const beforeCursor = value.slice(0, selection.start);
  const match = selection.start === selection.end ? beforeCursor.match(ACTIVE_TOKEN) : null;
  const kind = match ? (match[2] === '@' ? 'mention' : 'hashtag') : null;
  const term = useDebounced(match?.[3] ?? '', 150);
  const people = useSearchProfiles(term, kind === 'mention');
  const tags = useHashtagSuggestions(term, kind === 'hashtag');
  const active = !!kind;
  const problem = captionProblems(value);

  useEffect(() => {
    onSuggesting?.(active);
  }, [active, onSuggesting]);

  function complete(word: string) {
    if (!match) return;
    const tokenStart = selection.start - match[3].length - 1;
    const insert = `${match[2]}${word} `;
    const next = value.slice(0, tokenStart) + insert + value.slice(selection.end);
    const cursor = tokenStart + insert.length;
    onChangeText(next);
    setSelection({ start: cursor, end: cursor });
    setForced({ start: cursor, end: cursor });
  }

  return (
    <View>
      <View style={[styles.row, { gap: spacing.md, padding: spacing.lg }]}>
        {leading}
        <TextInput
          value={value}
          onChangeText={(t) => {
            setForced(undefined);
            // Not every platform reports the cursor while typing (web): infer it from the edit.
            const cursor = cursorAfterEdit(value, t);
            setSelection({ start: cursor, end: cursor });
            onChangeText(t);
          }}
          onSelectionChange={(e) => {
            setForced(undefined);
            setSelection(e.nativeEvent.selection);
          }}
          selection={forced}
          multiline
          autoFocus={autoFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Caption"
          style={[styles.input, { color: colors.text }]}
        />
      </View>
      {problem || value.length > MAX_CAPTION - 200 ? (
        <View style={[styles.meta, { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }]}>
          <Text variant="caption" color={problem ? 'danger' : 'textSecondary'} style={{ flex: 1 }}>
            {problem ?? ''}
          </Text>
          <Text variant="caption" color={value.length > MAX_CAPTION ? 'danger' : 'textSecondary'}>
            {value.length}/{MAX_CAPTION}
          </Text>
        </View>
      ) : null}
      {kind === 'mention' ? (
        <View
          style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}
        >
          {people.isPending ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          {(people.data ?? []).slice(0, 8).map((p) => (
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
              <Avatar uri={avatarUrl(p.avatar_path)} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyBold">{p.username}</Text>
                {p.full_name ? <Text color="textSecondary">{p.full_name}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {kind === 'hashtag' ? (
        <View
          style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}
        >
          {term && !(tags.data ?? []).some((t) => t.name === term.toLowerCase()) ? (
            <HashtagRow name={term.toLowerCase()} detail="New hashtag" onPress={complete} />
          ) : null}
          {(tags.data ?? []).map((t) => (
            <HashtagRow
              key={t.name}
              name={t.name}
              detail={`${formatCount(t.post_count)} ${t.post_count === 1 ? 'post' : 'posts'}`}
              onPress={complete}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function HashtagRow({
  name,
  detail,
  onPress,
}: {
  name: string;
  detail: string;
  onPress: (name: string) => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(name)}
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
      <View style={[styles.hash, { borderColor: colors.separator }]}>
        <Text variant="subhead">#</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">#{name}</Text>
        <Text color="textSecondary">{detail}</Text>
      </View>
      <Icon name="forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  input: { flex: 1, fontSize: 15, minHeight: 64, maxHeight: 200, textAlignVertical: 'top' },
  meta: { flexDirection: 'row', alignItems: 'center' },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  hash: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
