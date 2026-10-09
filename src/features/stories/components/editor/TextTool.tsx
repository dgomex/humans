import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar, Icon, Text, type IconName } from '@/components';
import { useHashtagSuggestions, useSearchProfiles } from '@/features/posts/api';
import { avatarUrl } from '@/features/profile/avatar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

import { FONTS, STICKER, STORY_COLORS, contrastOn, fontStyle } from '../../style';
import {
  CANVAS_H,
  CANVAS_W,
  type MentionRef,
  type TextAlign,
  type TextBackground,
  type TextElement,
} from '../../types';

const ALIGN_NEXT: Record<TextAlign, TextAlign> = { center: 'left', left: 'right', right: 'center' };
const ALIGN_ICON: Record<TextAlign, IconName> = {
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
};
const BG_NEXT: Record<TextBackground, TextBackground> = {
  none: 'solid',
  solid: 'soft',
  soft: 'none',
};
const MIN_SIZE = 40;
const MAX_SIZE = 160;

/** The token being typed at the end of the text (`@ann` / `#tri`), if any. */
function trailingToken(text: string): { kind: '@' | '#'; term: string } | null {
  const m = text.match(/(^|\s)([@#])([\p{L}\p{N}._]*)$/u);
  return m ? { kind: m[2] as '@' | '#', term: m[3] } : null;
}

/**
 * Page 54 — Aa text tool over the editor: type with live styling; fonts row, colors, alignment,
 * background (none / solid / soft), size slider, and @ / # suggestions. Done adds or updates the
 * element; an empty text removes it.
 */
export function TextTool({
  initial,
  onDone,
}: {
  initial: TextElement | null;
  onDone: (el: TextElement | null) => void;
}) {
  const { colors, spacing } = useTheme();
  const [text, setText] = useState(initial?.text ?? '');
  const [font, setFont] = useState(initial?.font ?? 'classic');
  const [color, setColor] = useState(initial?.color ?? STORY_COLORS[0]);
  const [background, setBackground] = useState<TextBackground>(initial?.background ?? 'none');
  const [align, setAlign] = useState<TextAlign>(initial?.align ?? 'center');
  const [size, setSize] = useState(initial?.size ?? 72);
  const [mentions, setMentions] = useState<MentionRef[]>(initial?.mentions ?? []);
  const [sliderH, setSliderH] = useState(200);

  const token = trailingToken(text);
  const term = useDebounced(token?.term ?? '', 200);
  const people = useSearchProfiles(term, token?.kind === '@' && term.length > 0);
  const tags = useHashtagSuggestions(term, token?.kind === '#' && term.length > 0);

  function complete(value: string, mention?: MentionRef) {
    if (!token) return;
    setText(text.slice(0, text.length - token.term.length) + value + ' ');
    if (mention && !mentions.some((m) => m.id === mention.id)) setMentions([...mentions, mention]);
  }

  function done() {
    const trimmed = text.trim();
    if (!trimmed) {
      onDone(null);
      return;
    }
    // Keep only mentions still present in the text.
    const kept = mentions.filter((m) => new RegExp(`@${m.username}\\b`, 'i').test(trimmed));
    onDone({
      id: initial?.id ?? Crypto.randomUUID(),
      type: 'text',
      text: trimmed,
      font,
      color,
      background,
      align,
      size,
      mentions: kept,
      x: initial?.x ?? CANVAS_W / 2,
      y: initial?.y ?? CANVAS_H * 0.4,
      scale: initial?.scale ?? 1,
      rotation: initial?.rotation ?? 0,
    });
  }

  const slide = (y: number) => {
    const f = 1 - Math.min(1, Math.max(0, y / sliderH));
    setSize(Math.round(MIN_SIZE + f * (MAX_SIZE - MIN_SIZE)));
  };
  const sizePan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(slide, e.y))
    .onUpdate((e) => scheduleOnRN(slide, e.y));

  const bg =
    background === 'solid' ? color : background === 'soft' ? STICKER.shadow : 'transparent';
  const fg = background === 'solid' ? contrastOn(color) : color;
  const shown = Math.round(size * 0.45);

  const suggestions =
    token?.kind === '@'
      ? (people.data ?? []).slice(0, 8).map((p) => ({
          key: p.id,
          label: p.username,
          avatar: avatarUrl(p.avatar_path),
          pick: () => complete(p.username, { id: p.id, username: p.username }),
        }))
      : token?.kind === '#'
        ? (tags.data ?? []).slice(0, 8).map((t) => ({
            key: t.name,
            label: `#${t.name}`,
            avatar: undefined,
            pick: () => complete(t.name),
          }))
        : [];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[
              styles.row,
              { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
            ]}
          >
            <ToolButton
              icon={ALIGN_ICON[align]}
              label="Alignment"
              onPress={() => setAlign(ALIGN_NEXT[align])}
            />
            <ToolButton
              icon="textBackground"
              label="Text background"
              active={background !== 'none'}
              onPress={() => setBackground(BG_NEXT[background])}
            />
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={done}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text variant="subhead" style={{ color: colors.onMedia }}>
                Done
              </Text>
            </Pressable>
          </View>

          <View style={[styles.row, { flex: 1 }]}>
            <GestureDetector gesture={sizePan}>
              <View
                onLayout={(e) => setSliderH(e.nativeEvent.layout.height)}
                style={[styles.slider, { marginLeft: spacing.md }]}
                accessibilityRole="adjustable"
                accessibilityLabel="Text size"
              >
                <View style={[styles.sliderTrack, { backgroundColor: colors.mediaGrid }]} />
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: colors.onMedia,
                      top: (1 - (size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * (sliderH - 20),
                    },
                  ]}
                />
              </View>
            </GestureDetector>
            <View style={[styles.center, { flex: 1, paddingHorizontal: spacing.lg }]}>
              <View
                style={{
                  backgroundColor: bg,
                  borderRadius: shown * 0.35,
                  paddingHorizontal: bg === 'transparent' ? 0 : shown * 0.35,
                }}
              >
                <TextInput
                  value={text}
                  onChangeText={setText}
                  autoFocus
                  multiline
                  maxLength={500}
                  placeholder="Start typing…"
                  placeholderTextColor={colors.mediaGrid}
                  selectionColor={colors.onMedia}
                  style={[
                    { color: fg, fontSize: shown, textAlign: align, minWidth: 40, padding: 0 },
                    fontStyle(font, color),
                  ]}
                  accessibilityLabel="Story text"
                />
              </View>
            </View>
          </View>

          {suggestions.length ? (
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
              style={{ flexGrow: 0, marginBottom: spacing.sm }}
            >
              {suggestions.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={s.pick}
                  style={[
                    styles.row,
                    styles.suggestion,
                    { backgroundColor: colors.mediaScrim, gap: spacing.xs },
                  ]}
                  accessibilityRole="button"
                >
                  {s.avatar !== undefined ? <Avatar uri={s.avatar} size={22} /> : null}
                  <Text variant="captionBold" style={{ color: colors.onMedia }}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
            style={{ flexGrow: 0 }}
          >
            {STORY_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityRole="button"
                accessibilityLabel={`Color ${c}`}
                accessibilityState={{ selected: color === c }}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: colors.onMedia,
                    borderWidth: color === c ? 3 : 2,
                  },
                ]}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
            style={{ flexGrow: 0 }}
          >
            {FONTS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFont(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: font === f.id }}
                style={[
                  styles.fontChip,
                  {
                    backgroundColor: font === f.id ? colors.onMedia : colors.mediaScrim,
                  },
                ]}
              >
                <Text
                  style={[
                    {
                      color: font === f.id ? colors.mediaBackground : colors.onMedia,
                      fontSize: 14,
                    },
                    fontStyle(f.id, font === f.id ? colors.mediaBackground : colors.onMedia),
                    { textShadowRadius: 0 },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tool, { backgroundColor: active ? colors.onMedia : colors.mediaScrim }]}
    >
      <Icon name={icon} size={20} color={active ? colors.mediaBackground : colors.onMedia} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  tool: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  slider: { width: 28, height: '50%', alignItems: 'center' },
  sliderTrack: { position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2 },
  sliderThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  fontChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  suggestion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
});
