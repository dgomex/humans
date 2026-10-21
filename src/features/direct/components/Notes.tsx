import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Avatar, BottomSheet, Button, Icon, Text, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { avatarUrl } from '@/features/profile/avatar';
import { getPublicUrl, BUCKETS } from '@/lib/storage';
import { useTheme } from '@/theme';

import {
  directThreadWith,
  invalidateThread,
  sendMessage,
  useNoteActions,
  useNoteLikers,
  useNotes,
  type NoteItem,
} from '../api';
import { shortTime } from '../format';
import { useQueryClient } from '@tanstack/react-query';

/** Speech bubble above an avatar (notes row, profile header). */
export function NoteBubble({
  body,
  song,
  placeholder,
  maxWidth = 86,
}: {
  body?: string | null;
  song?: string | null;
  placeholder?: string;
  maxWidth?: number;
}) {
  const { colors, spacing, radius } = useTheme();
  const empty = !body && !song;
  return (
    <View style={styles.bubbleWrap}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.backgroundElevated,
            borderColor: colors.separator,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            maxWidth,
          },
        ]}
      >
        {song ? (
          <View style={styles.song}>
            <Icon name="musicFilled" size={10} color={colors.textSecondary} />
            <Text variant="tiny" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {song}
            </Text>
          </View>
        ) : null}
        {body || empty ? (
          <Text
            variant="tiny"
            color={empty ? 'textSecondary' : 'text'}
            numberOfLines={2}
            style={{ textAlign: 'center' }}
          >
            {body || placeholder}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.tail,
          { backgroundColor: colors.backgroundElevated, borderColor: colors.separator },
        ]}
      />
    </View>
  );
}

/** Inbox notes row (page 81): your bubble first, then notes from mutuals / Close Friends. */
export function NotesRow() {
  const { profile } = useAuth();
  const { spacing } = useTheme();
  const notes = useNotes();
  const [open, setOpen] = useState<NoteItem | null>(null);
  const mine = notes.data?.find((n) => n.author_id === profile?.id) ?? null;
  const others = (notes.data ?? []).filter((n) => n.author_id !== profile?.id);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          gap: spacing.md,
          paddingTop: spacing.sm,
        }}
      >
        <NoteItemView
          label={mine ? 'Your note' : 'Your note'}
          avatar={profile?.avatar_path ?? null}
          body={mine?.body}
          song={mine?.audio ? `${mine.audio.title}` : null}
          placeholder="Note..."
          onPress={() => (mine ? setOpen(mine) : router.push('/direct/note'))}
        />
        {others.map((n) => (
          <NoteItemView
            key={n.id}
            label={n.username}
            avatar={n.avatar_path}
            body={n.body}
            song={n.audio ? `${n.audio.title}` : null}
            closeFriends={n.audience === 'close_friends'}
            onPress={() => setOpen(n)}
          />
        ))}
        {notes.isPending ? <ActivityIndicator style={{ marginLeft: spacing.md }} /> : null}
      </ScrollView>
      <NoteSheet note={open} onClose={() => setOpen(null)} />
    </>
  );
}

function NoteItemView({
  label,
  avatar,
  body,
  song,
  placeholder,
  closeFriends,
  onPress,
}: {
  label: string;
  avatar: string | null;
  body?: string | null;
  song?: string | null;
  placeholder?: string;
  closeFriends?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${body ? `: ${body}` : ''}`}
      style={styles.item}
    >
      <NoteBubble body={body} song={song} placeholder={placeholder} />
      <View style={{ marginTop: -6 }}>
        <Avatar uri={avatarUrl(avatar)} size={64} ring={closeFriends ? 'closeFriends' : 'none'} />
      </View>
      <Text
        variant="caption"
        numberOfLines={1}
        style={{ maxWidth: 76, color: placeholder ? colors.textSecondary : colors.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Note bubble above a profile picture (page 81): yours ("Note…" when empty) or a visible one. */
export function ProfileNote({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const notes = useNotes();
  const [open, setOpen] = useState<NoteItem | null>(null);
  const note = notes.data?.find((n) => n.author_id === userId) ?? null;
  if (!note && !isOwn) return null;
  return (
    <>
      <Pressable
        onPress={() => (note ? setOpen(note) : router.push('/direct/note'))}
        accessibilityRole="button"
        accessibilityLabel={note ? `Note: ${note.body ?? note.audio?.title ?? ''}` : 'Leave a note'}
        style={styles.profileNote}
      >
        <NoteBubble
          body={note?.body}
          song={note?.audio ? note.audio.title : null}
          placeholder="Note..."
        />
      </Pressable>
      <NoteSheet note={open} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * Tapping a note: someone's note → ♥ like + reply (a DM to them); your note → likes list,
 * Leave a new note, Delete note. Songs preview while the sheet is open.
 */
export function NoteSheet({ note, onClose }: { note: NoteItem | null; onClose: () => void }) {
  const { profile } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const actions = useNoteActions();
  const own = !!note && note.author_id === profile?.id;
  const likers = useNoteLikers(own ? note?.id : undefined);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState(false);
  const [sending, setSending] = useState(false);
  const player = useAudioPlayer(null);

  // Reset per note + preview its song.
  const [shownId, setShownId] = useState<string | null>(null);
  if ((note?.id ?? null) !== shownId) {
    setShownId(note?.id ?? null);
    setLiked(!!note?.liked);
    setReply('');
  }
  useEffect(() => {
    if (!note?.audio?.audio_path) {
      player.pause();
      return;
    }
    playLoop(player, getPublicUrl(BUCKETS.audio, note.audio.audio_path), note.audio.start_ms ?? 0);
    return () => player.pause();
  }, [note?.audio?.audio_path, note?.audio?.start_ms, player]);

  async function sendReply() {
    if (!note || !reply.trim()) return;
    setSending(true);
    try {
      const thread = await directThreadWith(note.author_id);
      await sendMessage(thread, { kind: 'text', body: reply.trim(), noteId: note.id });
      invalidateThread(qc, thread);
      toast.show('Sent');
      onClose();
    } catch {
      toast.show("Couldn't send your reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet visible={!!note} onClose={onClose}>
      {note ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            <NoteBubble
              body={note.body}
              song={
                note.audio
                  ? `${note.audio.title}${note.audio.artist ? ` · ${note.audio.artist}` : ''}`
                  : null
              }
              maxWidth={240}
            />
            <Avatar uri={avatarUrl(note.avatar_path)} size={88} />
            <Text variant="bodyBold">{own ? 'Your note' : note.username}</Text>
            <Text variant="caption" color="textSecondary">
              {shortTime(note.created_at)} ·{' '}
              {note.audience === 'close_friends' ? 'Close Friends' : 'Followers you follow back'}
            </Text>
          </View>
          {own ? (
            <View style={{ paddingTop: spacing.lg }}>
              <Text variant="bodyBold" style={{ paddingHorizontal: spacing.lg }}>
                Likes
              </Text>
              {(likers.data ?? []).length === 0 ? (
                <Text color="textSecondary" style={{ padding: spacing.lg }}>
                  No likes yet.
                </Text>
              ) : (
                (likers.data ?? []).map((l) => (
                  <View key={l.user_id} style={{ paddingHorizontal: spacing.lg }}>
                    <UserRow
                      username={l.username}
                      subtitle={l.full_name}
                      avatarUri={avatarUrl(l.avatar_path)}
                      trailing={<Icon name="heartFilled" size={18} color={colors.like} />}
                    />
                  </View>
                ))
              )}
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <Button
                  title="Leave a new note"
                  onPress={() => {
                    onClose();
                    router.push('/direct/note');
                  }}
                />
                <Button
                  title="Delete note"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    actions
                      .remove(note.id)
                      .then(() => toast.show('Note deleted'))
                      .catch(() => toast.show("Couldn't delete the note."));
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.replyBar, { padding: spacing.lg, gap: spacing.md }]}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder={`Reply to ${note.username}...`}
                placeholderTextColor={colors.textSecondary}
                maxLength={1000}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.separator,
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.lg,
                  },
                ]}
                onSubmitEditing={sendReply}
                returnKeyType="send"
              />
              {reply.trim() ? (
                <Pressable onPress={sendReply} disabled={sending} accessibilityRole="button">
                  <Text variant="bodyBold" color="primary">
                    Send
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    const next = !liked;
                    setLiked(next);
                    actions.like(note.id, next, profile!.id).catch(() => {
                      setLiked(!next);
                      toast.show("Couldn't like the note.");
                    });
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={liked ? 'Unlike note' : 'Like note'}
                >
                  <Icon
                    name={liked ? 'heartFilled' : 'heart'}
                    size={28}
                    color={liked ? colors.like : undefined}
                  />
                </Pressable>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      ) : null}
    </BottomSheet>
  );
}

/** Song preview for a note: loop from the chosen start. */
function playLoop(player: AudioPlayer, uri: string, startMs: number) {
  player.replace({ uri });
  player.loop = true;
  void player.seekTo(startMs / 1000);
  player.play();
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', width: 80, gap: 4 },
  profileNote: { position: 'absolute', top: -34, left: -6, zIndex: 2 },
  bubbleWrap: { alignItems: 'center', zIndex: 1 },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minWidth: 52,
    minHeight: 28,
    justifyContent: 'center',
  },
  tail: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
    marginLeft: -18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  song: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  replyBar: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, height: 44, borderWidth: StyleSheet.hairlineWidth },
});
