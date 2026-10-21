import { useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button, Icon, SearchField, Text, useToast } from '@/components';
import {
  directKeys,
  sendToTargets,
  useShareTargets,
  type Outgoing,
  type ShareTarget,
} from '@/features/direct/api';
import { ThreadAvatar } from '@/features/direct/components/ThreadAvatar';
import { threadTitle } from '@/features/direct/format';
import { ScreenSheet } from '@/features/feed/components/ScreenSheet';
import { BUCKETS, getSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useDebounced } from '@/lib/useDebounced';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * "Send to" (pages 48 / 64 / 52 / 62 / 23 → 76): pick chats or people, add a message, Send.
 * Params: ?post= | ?story= | ?profile= | ?audio= | ?forward=<message>&thread=<thread>.
 */
export default function SendScreen() {
  const params = useLocalSearchParams<{
    post?: string;
    story?: string;
    profile?: string;
    audio?: string;
    forward?: string;
  }>();
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim().toLowerCase(), 200);
  const targets = useShareTargets(query);
  const [picked, setPicked] = useState<Record<string, ShareTarget>>({});
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const keyOf = (t: ShareTarget) => t.thread_id ?? `u:${t.user_id}`;
  const data = useMemo(() => {
    const list = targets.data ?? [];
    // Keep selected targets visible while searching.
    const extra = Object.values(picked).filter((p) => !list.some((t) => keyOf(t) === keyOf(p)));
    return [...extra, ...list];
  }, [targets.data, picked]);
  const count = Object.keys(picked).length;

  async function content(): Promise<Outgoing | null> {
    if (params.post) return { kind: 'post', postId: params.post };
    if (params.story) return { kind: 'story', storyId: params.story };
    if (params.profile) return { kind: 'profile', profileId: params.profile };
    if (params.audio) return { kind: 'audio', audioId: params.audio };
    if (params.forward) return forwardable(params.forward);
    return null;
  }

  async function send() {
    setSending(true);
    try {
      const out = await content();
      const ids = await sendToTargets(Object.values(picked), out, note);
      void qc.invalidateQueries({ queryKey: directKeys.all });
      toast.show(ids.length === 1 ? 'Sent' : `Sent to ${ids.length} chats`);
      goBack('/direct');
    } catch {
      toast.show("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <ScreenSheet
      header={
        <Text variant="subhead" style={{ textAlign: 'center' }}>
          {params.forward ? 'Forward' : 'Send to'}
        </Text>
      }
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <SearchField value={search} onChangeText={setSearch} />
      </View>
      <FlatList
        data={data}
        numColumns={3}
        keyExtractor={keyOf}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.lg }}
        renderItem={({ item }) => {
          const key = keyOf(item);
          const on = !!picked[key];
          const members = item.thread_id
            ? item.members
            : [
                {
                  id: item.user_id!,
                  username: item.username!,
                  full_name: item.full_name ?? '',
                  avatar_path: item.avatar_path,
                  nickname: null,
                },
              ];
          const label = item.thread_id
            ? threadTitle({
                kind: item.kind,
                title: item.title,
                members,
                member_count: members.length + 1,
              })
            : item.full_name || item.username!;
          return (
            <Pressable
              onPress={() =>
                setPicked(({ [key]: had, ...rest }) => (had ? rest : { ...rest, [key]: item }))
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={label}
              style={[styles.cell, { padding: spacing.sm, gap: spacing.xs }]}
            >
              <View>
                <ThreadAvatar
                  kind={item.kind}
                  photoPath={item.photo_path}
                  members={members}
                  size={64}
                />
                {on ? (
                  <View
                    style={[
                      styles.check,
                      { backgroundColor: colors.primary, borderColor: colors.background },
                    ]}
                  >
                    <Icon name="check" size={14} color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
              <Text variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                {label}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          targets.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ textAlign: 'center', padding: spacing.xl }}>
              No one found.
            </Text>
          )
        }
      />
      {count > 0 ? (
        <View
          style={{
            padding: spacing.md,
            gap: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.separator,
          }}
        >
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Write a message..."
            placeholderTextColor={colors.textSecondary}
            maxLength={1000}
            style={[
              styles.note,
              {
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
              },
            ]}
          />
          <Button
            title={count > 1 ? `Send separately (${count})` : 'Send'}
            loading={sending}
            onPress={() => void send()}
          />
        </View>
      ) : null}
    </ScreenSheet>
  );
}

/** Forward an existing message: same post / story / profile / audio, text, or a copy of the file. */
async function forwardable(messageId: string): Promise<Outgoing | null> {
  const { data: m, error } = await supabase
    .from('messages')
    .select(
      'kind, body, post_id, story_id, profile_id, audio_id, media_type, media_path, thumb_path, width, height, duration_ms, waveform',
    )
    .eq('id', messageId)
    .single();
  if (error) throw error;
  switch (m.kind) {
    case 'text':
      return { kind: 'text', body: m.body ?? '' };
    case 'post':
      return m.post_id ? { kind: 'post', postId: m.post_id } : null;
    case 'story':
      return m.story_id ? { kind: 'story', storyId: m.story_id } : null;
    case 'profile':
      return m.profile_id ? { kind: 'profile', profileId: m.profile_id } : null;
    case 'audio':
      return m.audio_id ? { kind: 'audio', audioId: m.audio_id } : null;
    case 'media':
    case 'voice': {
      const paths = [m.media_path, m.thumb_path].filter(Boolean) as string[];
      const urls = await getSignedUrls(BUCKETS.messages, paths);
      const local = await toLocal(urls[m.media_path!]);
      const poster = m.thumb_path ? await toLocal(urls[m.thumb_path]) : null;
      if (m.kind === 'voice')
        return {
          kind: 'voice',
          uri: local,
          durationMs: m.duration_ms ?? 1000,
          waveform: (m.waveform as number[] | null) ?? [],
          mimeType: m.media_path!.endsWith('.webm') ? 'audio/webm' : 'audio/mp4',
        };
      return {
        kind: 'media',
        uri: local,
        mediaType: m.media_type === 'video' ? 'video' : 'image',
        width: m.width ?? 1080,
        height: m.height ?? 1080,
        durationMs: m.duration_ms,
        posterUri: poster,
        mimeType: m.media_type === 'video' ? 'video/mp4' : 'image/jpeg',
      };
    }
    default:
      return null;
  }
}

/** Web uploads straight from the signed URL; native needs a local file. */
async function toLocal(url: string | undefined) {
  if (!url) throw new Error('missing_file');
  if (Platform.OS === 'web') return url;
  const file = await File.downloadFileAsync(
    url,
    new File(Paths.cache, `fwd-${Crypto.randomUUID()}`),
  );
  return file.uri;
}

const styles = StyleSheet.create({
  cell: { width: '33.33%', alignItems: 'center' },
  check: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { height: 40 },
});
