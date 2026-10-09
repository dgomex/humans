import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  ActionGroup,
  ActionRow,
  Avatar,
  BottomSheet,
  Button,
  Icon,
  Text,
  useToast,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHighlights } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { PUBLIC_WEB_ORIGIN } from '@/features/profile/format';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

import {
  highlightCoverUrl,
  useAddToHighlight,
  useAddYoursChain,
  useDeleteHighlight,
  useDeleteStory,
  useRemoveFromHighlight,
  useSaveHighlight,
  type StoryCard,
} from '../api';
import { saveStoryMedia } from '../saveMedia';

export const storyUrl = (username: string, id: string) =>
  `${PUBLIC_WEB_ORIGIN}/stories/${username}/${id}`;
export const highlightUrl = (id: string) => `${PUBLIC_WEB_ORIGIN}/stories/highlights/${id}`;

/** ⋯ on a story: own (delete, save, settings, highlight actions) or others' (report, link…). */
export function StoryOptionsSheet({
  visible,
  onClose,
  card,
  highlightId,
  onCloseViewer,
}: {
  visible: boolean;
  onClose: () => void;
  card: StoryCard;
  highlightId: string | null;
  onCloseViewer: () => void;
}) {
  const toast = useToast();
  const del = useDeleteStory();
  const removeItem = useRemoveFromHighlight();
  const deleteHighlight = useDeleteHighlight();
  const { profile } = useAuth();
  const highlights = useHighlights(profile?.id, visible && !!highlightId && card.is_own);
  const highlight = highlights.data?.find((h) => h.id === highlightId);

  const copy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    onClose();
    toast.show('Link copied');
  };

  const mediaUrl = card.media_path ? card.urls[card.media_path] : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {card.is_own ? (
        <>
          {highlightId ? (
            <ActionGroup>
              <ActionRow
                icon="edit"
                label="Edit highlight"
                onPress={() => {
                  onClose();
                  onCloseViewer();
                  router.push({ pathname: '/highlights/[id]/edit', params: { id: highlightId } });
                }}
              />
              <ActionRow
                icon="remove"
                label="Remove from highlight"
                onPress={() =>
                  removeItem.mutate(
                    { highlightId, storyId: card.id },
                    {
                      onSuccess: () => {
                        onClose();
                        toast.show('Removed from highlight');
                      },
                    },
                  )
                }
              />
              <ActionRow
                icon="link"
                label="Copy link"
                onPress={() => void copy(highlightUrl(highlightId))}
              />
              <ActionRow
                icon="trash"
                label="Delete highlight"
                destructive
                onPress={() =>
                  showDialog('Delete highlight?', 'The stories stay in your archive.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        deleteHighlight.mutate(
                          { id: highlightId, cover_path: highlight?.cover_path ?? null },
                          {
                            onSuccess: () => {
                              onClose();
                              onCloseViewer();
                              toast.show('Highlight deleted');
                            },
                          },
                        ),
                    },
                  ])
                }
              />
            </ActionGroup>
          ) : null}
          <ActionGroup>
            {mediaUrl && (card.kind === 'photo' || card.kind === 'video') ? (
              <ActionRow
                icon="download"
                label={card.kind === 'video' ? 'Save video' : 'Save photo'}
                onPress={async () => {
                  onClose();
                  const r = await saveStoryMedia(
                    mediaUrl,
                    card.kind === 'video' ? 'mp4' : 'jpg',
                  ).catch(() => 'error' as const);
                  toast.show(
                    r === 'saved'
                      ? 'Saved'
                      : r === 'denied'
                        ? 'Allow photo access to save'
                        : r === 'unsupported'
                          ? 'Saving is available in the app'
                          : "Couldn't save",
                  );
                }}
              />
            ) : null}
            <ActionRow
              icon="settings"
              label="Story settings"
              onPress={() => {
                onClose();
                router.push('/story-settings');
              }}
            />
            <ActionRow
              icon="trash"
              label="Delete"
              destructive
              onPress={() =>
                showDialog(
                  'Delete story?',
                  "You can't undo this. It will also be removed from your highlights.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        del.mutate(card, {
                          onSuccess: () => {
                            onClose();
                            toast.show('Story deleted');
                          },
                          onError: () => toast.show("Couldn't delete. Try again."),
                        }),
                    },
                  ],
                )
              }
            />
          </ActionGroup>
        </>
      ) : (
        <ActionGroup>
          <ActionRow
            icon="report"
            label="Report"
            destructive
            onPress={() => {
              onClose();
              router.push({ pathname: '/report', params: { type: 'story', id: card.id } });
            }}
          />
          <ActionRow icon="mute" label="Mute" onPress={() => toast.show('Muting is coming soon')} />
          {card.author.is_private ? null : (
            <ActionRow
              icon="link"
              label="Copy link"
              onPress={() =>
                void copy(
                  highlightId ? highlightUrl(highlightId) : storyUrl(card.author.username, card.id),
                )
              }
            />
          )}
          <ActionRow
            icon="info"
            label="About this account"
            onPress={() => {
              onClose();
              onCloseViewer();
              router.push({
                pathname: '/[username]/about',
                params: { username: card.author.username },
              });
            }}
          />
        </ActionGroup>
      )}
    </BottomSheet>
  );
}

/** Answer a question sticker. */
export function AskSheet({
  visible,
  prompt,
  onClose,
  onSend,
}: {
  visible: boolean;
  prompt: string;
  onClose: () => void;
  onSend: (body: string) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const [text, setText] = useState('');
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setText('');
        onClose();
      }}
      title={prompt}
    >
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type something..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={300}
          autoFocus
          style={{
            minHeight: 80,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.backgroundSecondary,
            color: colors.text,
            fontSize: 16,
            textAlignVertical: 'top',
          }}
          accessibilityLabel="Your answer"
        />
        <Button
          title="Send"
          disabled={!text.trim()}
          onPress={() => {
            onSend(text.trim());
            setText('');
          }}
        />
      </View>
    </BottomSheet>
  );
}

/** Add yours: everyone who joined the prompt (stories you can see). */
export function ChainSheet({
  visible,
  chainId,
  prompt,
  onClose,
  onOpenStory,
}: {
  visible: boolean;
  chainId: string | undefined;
  prompt: string;
  onClose: () => void;
  onOpenStory: (storyId: string) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const chain = useAddYoursChain(visible ? chainId : undefined);
  const tile = (width - spacing.lg * 2 - spacing.sm * 2) / 3;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={prompt}>
      <ScrollView contentContainerStyle={[styles.grid, { padding: spacing.lg, gap: spacing.sm }]}>
        {chain.isPending ? <ActivityIndicator /> : null}
        {(chain.data ?? []).map((s) => (
          <Pressable
            key={s.story_id}
            onPress={() => (s.is_active ? onOpenStory(s.story_id) : undefined)}
            disabled={!s.is_active}
            accessibilityRole="button"
            accessibilityLabel={`${s.username}'s story`}
            style={{
              width: tile,
              height: tile * (16 / 9),
              borderRadius: radius.md,
              overflow: 'hidden',
              backgroundColor: colors.skeleton,
            }}
          >
            {s.thumbUrl ? (
              <Image
                source={{ uri: s.thumbUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
            <View style={[styles.chainUser, { padding: spacing.xs, gap: 4 }]}>
              <Avatar uri={avatarUrl(s.avatar_path)} size={20} />
              <Text
                variant="tiny"
                numberOfLines={1}
                style={{ color: colors.onMedia, flex: 1, fontWeight: '600' }}
              >
                {s.username}
              </Text>
            </View>
          </Pressable>
        ))}
        {!chain.isPending && (chain.data ?? []).length === 0 ? (
          <Text color="textSecondary">No stories to show.</Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

/** "Highlight" on your story: add it to an existing highlight or start a new one. */
export function HighlightPickerSheet({
  visible,
  storyId,
  onClose,
}: {
  visible: boolean;
  storyId: string;
  onClose: () => void;
}) {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const highlights = useHighlights(profile?.id, visible);
  const add = useAddToHighlight();
  const save = useSaveHighlight();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const close = () => {
    setCreating(false);
    setTitle('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Add to highlights">
      {creating ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Highlights"
            placeholderTextColor={colors.textTertiary}
            maxLength={32}
            autoFocus
            style={[styles.title, { color: colors.text, borderColor: colors.separator }]}
            accessibilityLabel="Highlight name"
          />
          <Button
            title="Add"
            loading={save.isPending}
            onPress={() =>
              save.mutate(
                {
                  id: null,
                  title: title.trim() || 'Highlights',
                  coverPath: null,
                  storyIds: [storyId],
                },
                {
                  onSuccess: () => {
                    close();
                    toast.show('Added to highlight');
                  },
                  onError: () => toast.show("Couldn't create highlight"),
                },
              )
            }
          />
        </View>
      ) : (
        <ScrollView horizontal contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <Pressable
            onPress={() => setCreating(true)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel="New highlight"
          >
            <View style={[styles.circle, { borderColor: colors.separator }]}>
              <Icon name="add" size={30} />
            </View>
            <Text variant="caption">New</Text>
          </Pressable>
          {(highlights.data ?? []).map((h) => (
            <Pressable
              key={h.id}
              onPress={() =>
                add.mutate(
                  { highlightId: h.id, storyId },
                  {
                    onSuccess: () => {
                      close();
                      toast.show(`Added to ${h.title || 'highlight'}`);
                    },
                    onError: () => toast.show("Couldn't add to highlight"),
                  },
                )
              }
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={`Add to ${h.title}`}
            >
              <Avatar uri={highlightCoverUrl(h)} size={64} />
              <Text variant="caption" numberOfLines={1} style={{ maxWidth: 72 }}>
                {h.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  chainUser: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: { alignItems: 'center', gap: 4, width: 72 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 16 },
});
