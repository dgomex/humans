import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { BottomSheet, Button, Icon, SearchField, Text, type IconName } from '@/components';
import { useTheme } from '@/theme';

import { SLIDER_EMOJIS } from '../../style';
import type { StickerData, StickerKind } from '../../types';

export type TrayKind = Exclude<StickerKind, 'post' | 'answer'>;

const TILES: { kind: TrayKind; label: string; icon: IconName }[] = [
  { kind: 'mention', label: 'Mention', icon: 'mention' },
  { kind: 'hashtag', label: 'Hashtag', icon: 'hashtag' },
  { kind: 'link', label: 'Link', icon: 'link' },
  { kind: 'poll', label: 'Poll', icon: 'poll' },
  { kind: 'quiz', label: 'Quiz', icon: 'quiz' },
  { kind: 'question', label: 'Questions', icon: 'question' },
  { kind: 'slider', label: 'Emoji slider', icon: 'slider' },
  { kind: 'countdown', label: 'Countdown', icon: 'countdown' },
  { kind: 'add_yours', label: 'Add Yours', icon: 'addYours' },
  { kind: 'time', label: 'Time', icon: 'time' },
  { kind: 'photo', label: 'Photo', icon: 'image' },
  { kind: 'music', label: 'Music', icon: 'music' },
];

/** Page 54 — ☺ sticker tray (searchable). `disabled` maps a kind to why it can't be added. */
export function StickerTray({
  visible,
  onClose,
  onPick,
  disabled,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (kind: TrayKind) => void;
  disabled: Partial<Record<TrayKind, string>>;
}) {
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const tile = (width - spacing.lg * 2 - spacing.sm * 2) / 3;
  const shown = TILES.filter((t) => t.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search" />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.grid,
          { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
        ]}
      >
        {shown.map((t) => {
          const reason = disabled[t.kind];
          return (
            <Pressable
              key={t.kind}
              onPress={() => {
                setQuery('');
                onPick(t.kind);
              }}
              disabled={!!reason}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              accessibilityHint={reason}
              style={({ pressed }) => [
                styles.tile,
                {
                  width: tile,
                  borderRadius: radius.lg,
                  backgroundColor: pressed ? colors.backgroundPressed : colors.backgroundSecondary,
                  opacity: reason ? 0.4 : 1,
                },
              ]}
            >
              <Icon name={t.icon} size={28} />
              <Text variant="captionBold">{t.label}</Text>
              {reason ? (
                <Text variant="tiny" color="textSecondary" style={{ textAlign: 'center' }}>
                  {reason}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

type FormKind =
  'hashtag' | 'link' | 'poll' | 'quiz' | 'question' | 'slider' | 'countdown' | 'add_yours';

export const needsForm = (k: TrayKind): k is FormKind =>
  ['hashtag', 'link', 'poll', 'quiz', 'question', 'slider', 'countdown', 'add_yours'].includes(k);

const TITLES: Record<FormKind, string> = {
  hashtag: 'Hashtag',
  link: 'Add link',
  poll: 'Poll',
  quiz: 'Quiz',
  question: 'Questions',
  slider: 'Emoji slider',
  countdown: 'Countdown',
  add_yours: 'Add Yours',
};

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600_000);
}

/** Setup for stickers that need input. Quiz returns its answer separately (kept out of content). */
export function StickerForm({
  kind,
  onClose,
  onCreate,
}: {
  kind: FormKind | null;
  onClose: () => void;
  onCreate: (sticker: StickerData, quizAnswer?: number) => void;
}) {
  return (
    <BottomSheet visible={kind !== null} onClose={onClose} title={kind ? TITLES[kind] : undefined}>
      {kind ? <FormBody key={kind} kind={kind} onCreate={onCreate} /> : null}
    </BottomSheet>
  );
}

function FormBody({
  kind,
  onCreate,
}: {
  kind: FormKind;
  onCreate: (sticker: StickerData, quizAnswer?: number) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const [text, setText] = useState(kind === 'question' ? 'Ask me a question' : '');
  const [label, setLabel] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correct, setCorrect] = useState(0);
  const [emoji, setEmoji] = useState<string>(SLIDER_EMOJIS[0]);
  const [endsAt, setEndsAt] = useState<Date>(() => hoursFromNow(24));
  const id = () => Crypto.randomUUID();

  const field = {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.separator,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.text,
    fontSize: 16,
  } as const;
  const input = (
    value: string,
    set: (v: string) => void,
    placeholder: string,
    max: number,
    a11y?: string,
  ) => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      maxLength={max}
      style={field}
      accessibilityLabel={a11y ?? placeholder}
      autoCapitalize={kind === 'link' || kind === 'hashtag' ? 'none' : 'sentences'}
    />
  );

  const pollOptions = options.map(
    (o, i) => o.trim() || (kind === 'poll' ? (i === 0 ? 'Yes' : i === 1 ? 'No' : '') : ''),
  );

  let body: ReactNode = null;
  let valid = true;
  let create: () => void = () => {};

  switch (kind) {
    case 'hashtag': {
      const tag = text.replace(/^#/, '').trim();
      valid = /^[\p{L}\p{N}_]{1,100}$/u.test(tag);
      body = input(text, setText, '#hashtag', 101, 'Hashtag');
      create = () => onCreate({ kind: 'hashtag', tag: tag.toLowerCase() });
      break;
    }
    case 'link': {
      const url = /^https?:\/\//i.test(text.trim()) ? text.trim() : `https://${text.trim()}`;
      valid = /^https?:\/\/[^\s/?#]+\.[^\s]+$/i.test(url);
      body = (
        <>
          {input(text, setText, 'URL', 2048, 'Link URL')}
          {input(label, setLabel, 'Customize sticker text (optional)', 30)}
        </>
      );
      create = () => onCreate({ kind: 'link', url, label: label.trim() || undefined });
      break;
    }
    case 'poll':
    case 'quiz': {
      valid = pollOptions.every((o) => o.length > 0);
      body = (
        <>
          {input(
            text,
            setText,
            kind === 'quiz' ? 'Ask a question…' : 'Ask a question (optional)',
            120,
            'Question',
          )}
          {options.map((o, i) => (
            <View key={i} style={[styles.row, { gap: spacing.sm }]}>
              {kind === 'quiz' ? (
                <Pressable
                  onPress={() => setCorrect(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: correct === i }}
                  accessibilityLabel={`Mark option ${i + 1} as correct`}
                  hitSlop={8}
                >
                  <Icon
                    name={correct === i ? 'checkCircle' : 'radioOff'}
                    size={24}
                    color={correct === i ? colors.success : colors.textSecondary}
                  />
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                {input(
                  o,
                  (v) => setOptions(options.map((x, j) => (j === i ? v : x))),
                  kind === 'poll' && i < 2
                    ? i === 0
                      ? 'Yes'
                      : 'No'
                    : `Option ${String.fromCharCode(65 + i)}`,
                  40,
                )}
              </View>
              {options.length > 2 ? (
                <Pressable
                  onPress={() => {
                    setOptions(options.filter((_, j) => j !== i));
                    if (correct >= i && correct > 0) setCorrect(correct - 1);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove option ${i + 1}`}
                >
                  <Icon name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < 4 ? (
            <Button
              title="Add option"
              variant="text"
              size="sm"
              onPress={() => setOptions([...options, ''])}
            />
          ) : null}
        </>
      );
      create = () =>
        kind === 'quiz'
          ? onCreate(
              { kind: 'quiz', stickerId: id(), question: text.trim(), options: pollOptions },
              correct,
            )
          : onCreate({
              kind: 'poll',
              stickerId: id(),
              question: text.trim(),
              options: pollOptions,
            });
      break;
    }
    case 'question':
    case 'add_yours': {
      valid = text.trim().length > 0;
      body = input(
        text,
        setText,
        kind === 'add_yours' ? 'Prompt (e.g. Show your pet)' : 'Ask me a question',
        120,
      );
      create = () =>
        kind === 'question'
          ? onCreate({ kind: 'question', stickerId: id(), prompt: text.trim() })
          : onCreate({ kind: 'add_yours', stickerId: id(), prompt: text.trim() });
      break;
    }
    case 'slider': {
      body = (
        <>
          {input(text, setText, 'Ask a question (optional)', 120, 'Question')}
          <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
            {SLIDER_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityState={{ selected: emoji === e }}
                style={[
                  styles.emoji,
                  { borderColor: emoji === e ? colors.primary : 'transparent' },
                ]}
              >
                <RNText style={{ fontSize: 28 }}>{e}</RNText>
              </Pressable>
            ))}
          </View>
        </>
      );
      create = () => onCreate({ kind: 'slider', stickerId: id(), question: text.trim(), emoji });
      break;
    }
    case 'countdown': {
      // The server rejects end times in the past.
      valid = text.trim().length > 0;
      const presets: [string, number][] = [
        ['In 1 hour', 1],
        ['Tomorrow', 24],
        ['In 3 days', 72],
        ['In 1 week', 168],
      ];
      body = (
        <>
          {input(text, setText, 'Name your countdown', 40, 'Countdown name')}
          <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
            {presets.map(([l, h]) => (
              <Button
                key={l}
                title={l}
                variant="secondary"
                size="sm"
                onPress={() => setEndsAt(hoursFromNow(h))}
              />
            ))}
          </View>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={endsAt}
              mode="datetime"
              minimumDate={new Date()}
              onChange={(_e, d) => d && setEndsAt(d)}
            />
          ) : Platform.OS === 'android' ? (
            <Button
              title="Pick date and time"
              variant="text"
              size="sm"
              onPress={() =>
                DateTimePickerAndroid.open({
                  value: endsAt,
                  mode: 'date',
                  minimumDate: new Date(),
                  onChange: (_e, d) => {
                    if (!d) return;
                    DateTimePickerAndroid.open({
                      value: d,
                      mode: 'time',
                      onChange: (_e2, t) => t && setEndsAt(t),
                    });
                  },
                })
              }
            />
          ) : null}
          <Text color="textSecondary">Ends {endsAt.toLocaleString()}</Text>
        </>
      );
      create = () =>
        onCreate({
          kind: 'countdown',
          stickerId: id(),
          title: text.trim(),
          endsAt: endsAt.toISOString(),
        });
      break;
    }
  }

  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      {body}
      <Button title="Done" disabled={!valid} onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
