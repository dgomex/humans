import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ActionGroup, ActionRow, BottomSheet, Button, Icon, Text, useToast } from '@/components';
import { useTheme } from '@/theme';

import type { Message } from '../api';

export type ComposerMode =
  | { kind: 'normal' }
  /** Message requests: one text message until accepted. */
  | { kind: 'textOnly' }
  | { kind: 'blocked'; text: string };

const VOICE_MAX_MS = 300_000;
const WAVE_BARS = 40;

/**
 * Chat composer (page 76): 📷 camera, "Message…", 🎤 voice (tap to record, then send or bin),
 * 🖼 gallery, Send (long-press → schedule). Shows the reply / edit bar above.
 */
export function Composer({
  mode,
  replyTo,
  replyName,
  editing,
  onCancelReply,
  onCancelEdit,
  onSendText,
  onSchedule,
  onEdit,
  onCamera,
  onGallery,
  onVoice,
  onTyping,
  vanish,
}: {
  mode: ComposerMode;
  replyTo: Message | null;
  replyName: string;
  editing: Message | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSendText: (body: string) => void;
  onSchedule: (body: string, at: Date) => void;
  onEdit: (m: Message, body: string) => void;
  onCamera: () => void;
  onGallery: () => void;
  onVoice: (v: { uri: string; durationMs: number; waveform: number[]; mimeType: string }) => void;
  onTyping: () => void;
  vanish: boolean;
}) {
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const [text, setText] = useState('');
  const [schedule, setSchedule] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const take = useRef({ active: false, levels: [] as number[], duration: 0 });

  // Editing fills the field with the message text.
  const [editingId, setEditingId] = useState<string | null>(null);
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    setText(editing?.body ?? '');
  }

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    },
    [],
  );

  async function startRecording() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      toast.show('Allow microphone access to send voice messages.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    take.current = { active: true, levels: [], duration: 0 };
    recorder.record();
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecording(true);
    setElapsed(0);
    setLevels([]);
    // Poll the recorder for the timer and the live waveform; stop at 5 minutes.
    ticker.current = setInterval(() => {
      const st = recorder.getStatus();
      const m = st.metering;
      take.current.duration = st.durationMillis;
      take.current.levels.push(
        typeof m === 'number' ? Math.max(0, Math.min(1, (m + 60) / 60)) : 0.4,
      );
      setElapsed(st.durationMillis);
      setLevels(take.current.levels.slice(-30));
      if (st.durationMillis >= VOICE_MAX_MS) void stopRecording(true);
    }, 100);
  }

  async function stopRecording(send: boolean) {
    if (!take.current.active) return;
    take.current.active = false;
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setRecording(false);
    const duration = take.current.duration;
    await recorder.stop();
    void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    if (!send || !uri) return;
    if (duration < 500) {
      toast.show('Hold on — record a little longer.');
      return;
    }
    onVoice({
      uri,
      durationMs: Math.min(duration, VOICE_MAX_MS),
      waveform: downsample(take.current.levels, WAVE_BARS),
      mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
    });
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    if (editing) onEdit(editing, body);
    else onSendText(body);
    setText('');
  }

  if (mode.kind === 'blocked') {
    return (
      <View style={[styles.blocked, { padding: spacing.lg, borderTopColor: colors.separator }]}>
        <Text color="textSecondary" style={{ textAlign: 'center' }}>
          {mode.text}
        </Text>
      </View>
    );
  }

  const textOnly = mode.kind === 'textOnly';
  const hasText = text.trim().length > 0;

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
      {replyTo || editing ? (
        <View
          style={[
            styles.replyBar,
            { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, gap: spacing.sm },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="captionBold">
              {editing ? 'Editing message' : `Replying to ${replyName}`}
            </Text>
            {replyTo ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {replyTo.body ??
                  (replyTo.kind === 'voice'
                    ? 'Voice message'
                    : replyTo.kind === 'media'
                      ? 'Photo'
                      : 'Attachment')}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={editing ? onCancelEdit : onCancelReply}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Icon name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {recording ? (
        <View
          style={[
            styles.bar,
            {
              backgroundColor: colors.backgroundSecondary,
              borderRadius: radius.pill,
              padding: spacing.xs,
              gap: spacing.sm,
            },
          ]}
        >
          <Pressable
            onPress={() => void stopRecording(false)}
            style={[styles.round, { backgroundColor: colors.background }]}
            accessibilityRole="button"
            accessibilityLabel="Delete recording"
          >
            <Icon name="trash" size={20} color={colors.danger} />
          </Pressable>
          <View style={[styles.recDot, { backgroundColor: colors.danger }]} />
          <Text variant="bodyBold">{formatMs(elapsed)}</Text>
          <View style={styles.liveWave}>
            {levels.map((l, i) => (
              <View
                key={i}
                style={{
                  width: 2.5,
                  borderRadius: 2,
                  height: 4 + l * 20,
                  backgroundColor: colors.text,
                }}
              />
            ))}
          </View>
          <Pressable
            onPress={() => void stopRecording(true)}
            style={[styles.round, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Send voice message"
          >
            <Icon name="sendFilled" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      ) : (
        <View
          style={[
            styles.bar,
            {
              backgroundColor: vanish ? colors.backgroundPressed : colors.backgroundSecondary,
              borderRadius: 24,
              padding: spacing.xs,
              gap: spacing.sm,
            },
          ]}
        >
          {!textOnly && !editing ? (
            <Pressable
              onPress={onCamera}
              style={[styles.round, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Camera"
            >
              <Icon name="cameraFilled" size={18} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <View style={{ width: spacing.sm }} />
          )}
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (t) onTyping();
            }}
            placeholder={vanish ? 'Message in vanish mode…' : 'Message...'}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel="Message"
            onKeyPress={(e) => {
              // Web: Enter sends, Shift+Enter adds a line.
              const ev = e.nativeEvent as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                submit();
              }
            }}
          />
          {hasText ? (
            <Pressable
              onPress={submit}
              onLongPress={() => (!editing && !vanish && !textOnly ? setSchedule(true) : undefined)}
              delayLongPress={400}
              hitSlop={8}
              style={{ paddingHorizontal: spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Save edit' : 'Send'}
              accessibilityHint={editing ? undefined : 'Long press to schedule'}
            >
              <Text variant="bodyBold" color="primary">
                {editing ? 'Save' : 'Send'}
              </Text>
            </Pressable>
          ) : !textOnly ? (
            <View style={[styles.tools, { gap: spacing.md, paddingRight: spacing.sm }]}>
              <Pressable
                onPress={() => void startRecording()}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Record voice message"
              >
                <Icon name="mic" size={24} />
              </Pressable>
              <Pressable
                onPress={onGallery}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Send photos or videos"
              >
                <Icon name="image" size={24} />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
      <ScheduleSheet
        visible={schedule}
        onClose={() => setSchedule(false)}
        onPick={(at) => {
          setSchedule(false);
          const body = text.trim();
          if (!body) return;
          onSchedule(body, at);
          setText('');
        }}
      />
    </View>
  );
}

/** Long-press Send → "Schedule message" (1 minute … 29 days ahead, text only). */
function ScheduleSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (at: Date) => void;
}) {
  const { spacing } = useTheme();
  const [custom, setCustom] = useState<Date | null>(null);
  const now = new Date();
  const inHour = new Date(now.getTime() + 3600_000);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const max = new Date(now.getTime() + 29 * 86400_000);
  const fmt = (d: Date) =>
    d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  function pickCustom() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: inHour,
        mode: 'date',
        minimumDate: now,
        maximumDate: max,
        onChange: (_e, date) => {
          if (!date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (_e2, time) => time && onPick(time),
          });
        },
      });
    } else {
      setCustom(inHour);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Schedule message">
      {custom && Platform.OS === 'ios' ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <DateTimePicker
            value={custom}
            mode="datetime"
            display="inline"
            minimumDate={now}
            maximumDate={max}
            onChange={(_e, d) => d && setCustom(d)}
          />
          <Button title="Schedule" onPress={() => onPick(custom)} />
        </View>
      ) : (
        <ActionGroup>
          <ActionRow
            icon="schedule"
            label={`In 1 hour · ${fmt(inHour)}`}
            onPress={() => onPick(inHour)}
          />
          {tonight.getTime() - now.getTime() > 30 * 60_000 ? (
            <ActionRow
              icon="schedule"
              label={`Tonight · ${fmt(tonight)}`}
              onPress={() => onPick(tonight)}
            />
          ) : null}
          <ActionRow
            icon="schedule"
            label={`Tomorrow morning · ${fmt(tomorrow)}`}
            onPress={() => onPick(tomorrow)}
          />
          {Platform.OS !== 'web' ? (
            <ActionRow icon="calendar" label="Pick date and time" onPress={pickCustom} />
          ) : null}
        </ActionGroup>
      )}
    </BottomSheet>
  );
}

function downsample(values: number[], n: number) {
  if (values.length === 0) return Array.from({ length: n }, () => 0.4);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * values.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * values.length) / n));
    const slice = values.slice(from, to);
    out.push(Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100);
  }
  return out;
}

const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 8 },
  tools: { flexDirection: 'row', alignItems: 'center' },
  replyBar: { flexDirection: 'row', alignItems: 'center' },
  blocked: { borderTopWidth: StyleSheet.hairlineWidth },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  liveWave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
    overflow: 'hidden',
  },
});
