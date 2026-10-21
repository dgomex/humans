import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ComposerMusic } from '@/features/create/types';
import { useNoteActions } from '@/features/direct/api';
import { MusicPicker } from '@/features/posts/components/MusicPicker';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

const MAX = 60;

/** Page 81 — New note: ≤60 characters and/or a song, for mutuals or Close Friends, 24 hours. */
export default function NewNoteScreen() {
  const { colors, spacing, radius } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const actions = useNoteActions();
  const [body, setBody] = useState('');
  const [music, setMusic] = useState<ComposerMusic | null>(null);
  const [audience, setAudience] = useState<'mutuals' | 'close_friends'>('mutuals');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const canShare = (body.trim().length > 0 || !!music) && !busy;

  async function share() {
    setBusy(true);
    try {
      await actions.share({
        body: body.trim() || null,
        audioTrackId: music?.trackId ?? null,
        audioStartMs: music?.startMs ?? 0,
        audience,
      });
      toast.show('Note shared');
      goBack('/direct');
    } catch {
      toast.show("Couldn't share your note.");
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="New note"
        center
        right={
          <Pressable
            onPress={() => void share()}
            disabled={!canShare}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text variant="bodyBold" color={canShare ? 'primary' : 'textTertiary'}>
              Share
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: colors.backgroundSecondary,
                borderRadius: radius.xl,
                padding: spacing.md,
              },
            ]}
          >
            {music ? (
              <Pressable
                onPress={() => setMusic(null)}
                style={styles.song}
                accessibilityRole="button"
                accessibilityLabel="Remove song"
              >
                <Icon name="musicFilled" size={14} />
                <Text variant="captionBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {music.title} · {music.artist}
                </Text>
                <Icon name="close" size={14} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.replace(/\n/g, ' ').slice(0, MAX))}
              placeholder="Share a thought..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              multiline
              maxLength={MAX}
              style={[styles.input, { color: colors.text }]}
              accessibilityLabel="Note"
            />
          </View>
          <Avatar uri={avatarUrl(profile?.avatar_path)} size={96} />
          <Text variant="caption" color="textSecondary">
            {body.length}/{MAX}
          </Text>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            style={[
              styles.pill,
              {
                borderColor: colors.separator,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                gap: spacing.xs,
              },
            ]}
          >
            <Icon name="music" size={18} />
            <Text variant="bodyBold">{music ? 'Change music' : 'Add music'}</Text>
          </Pressable>
        </View>
        <View style={[styles.audience, { padding: spacing.lg, gap: spacing.sm }]}>
          <Text variant="captionBold" color="textSecondary">
            Share with
          </Text>
          <View style={[styles.row, { gap: spacing.sm }]}>
            {(
              [
                { key: 'mutuals', label: 'Followers you follow back', icon: 'people' },
                { key: 'close_friends', label: 'Close Friends', icon: 'closeFriends' },
              ] as const
            ).map((o) => (
              <Pressable
                key={o.key}
                onPress={() => setAudience(o.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: audience === o.key }}
                style={[
                  styles.option,
                  {
                    borderRadius: radius.lg,
                    padding: spacing.sm,
                    gap: spacing.xs,
                    borderColor: audience === o.key ? colors.primary : colors.separator,
                  },
                ]}
              >
                <Icon
                  name={o.icon}
                  size={18}
                  color={o.key === 'close_friends' ? colors.closeFriends : undefined}
                />
                <Text variant="caption" numberOfLines={2} style={{ flex: 1 }}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color="textSecondary">
            Notes appear at the top of their inbox and on your profile for 24 hours. People
            won&apos;t be notified.
          </Text>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <MusicPicker
          onClose={() => setPicking(false)}
          onDone={(m) => {
            setMusic(m);
            setPicking(false);
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  bubble: { minWidth: 180, maxWidth: 280, alignItems: 'center' },
  input: { fontSize: 16, textAlign: 'center', minHeight: 24, width: 240 },
  song: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 240 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
  },
  audience: { marginTop: 'auto' },
  row: { flexDirection: 'row' },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
