import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Icon,
  SearchField,
  Text,
  UserRow,
  useToast,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRemoveFollower } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { showDialog } from '@/lib/dialog';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

import {
  useDeleteStory,
  useStoryResponses,
  useStoryViewers,
  useToggleHiddenFrom,
  type StoryCard,
  type StoryResponseRow,
  type StoryViewer,
} from '../api';
import { StoryThumb } from './StoryThumb';

const NAMES_MS = 48 * 3600_000;

/**
 * Page 56 — your story's activity: strip of your active stories, view count, delete, sticker
 * results (poll / quiz / slider / question answers you can share), and the viewers list ranked
 * by interaction (♥ likes, replies, answers), searchable, with Hide story from / Remove follower.
 */
export function ViewersSheet({
  visible,
  initialStory,
  reel,
  openedAt,
  onClose,
}: {
  visible: boolean;
  initialStory: StoryCard | null;
  reel: StoryCard[];
  /** When the sheet was opened (decides whether viewer names are still kept). */
  openedAt: number;
  onClose: () => void;
}) {
  const { colors, spacing } = useTheme();
  const { height } = useWindowDimensions();
  const toast = useToast();
  // The picked story belongs to the story the sheet was opened for.
  const [pick, setPick] = useState<{ for: string | null; id: string } | null>(null);
  const selectedId =
    pick && pick.for === (initialStory?.id ?? null) ? pick.id : (initialStory?.id ?? null);
  const setSelectedId = (id: string) => setPick({ for: initialStory?.id ?? null, id });
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim(), 250);
  const [rowMenu, setRowMenu] = useState<StoryViewer | null>(null);
  const del = useDeleteStory();

  const story = reel.find((s) => s.id === selectedId) ?? initialStory;
  const viewers = useStoryViewers(visible ? story?.id : undefined, search);
  const responses = useStoryResponses(visible ? story?.id : undefined);
  const namesExpired = !!story && openedAt - new Date(story.published_at).getTime() > NAMES_MS;

  if (!story) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.88}>
      <View style={{ height: height * 0.8 }}>
        {reel.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
            style={{ flexGrow: 0, marginBottom: spacing.md }}
          >
            {reel.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedId(s.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: s.id === story.id }}
                style={{
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: s.id === story.id ? colors.text : 'transparent',
                  overflow: 'hidden',
                }}
              >
                <StoryThumb story={s} width={54} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View
          style={[
            styles.row,
            { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
          ]}
        >
          <Icon name="eye" size={22} />
          <Text variant="bodyBold" style={{ flex: 1 }}>
            {formatCount(story.view_count ?? 0)} {story.view_count === 1 ? 'viewer' : 'viewers'}
            {story.like_count ? ` · ${formatCount(story.like_count)} ♥` : ''}
          </Text>
          <Pressable
            onPress={() =>
              showDialog('Delete story?', "You can't undo this.", [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    del.mutate(story, {
                      onSuccess: () => {
                        toast.show('Story deleted');
                        onClose();
                      },
                    }),
                },
              ])
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Delete story"
          >
            <Icon name="trash" size={22} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        >
          <StickerResults story={story} responses={responses.data ?? []} onShared={onClose} />

          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search" />
          </View>
          {viewers.isPending ? <ActivityIndicator style={{ marginTop: spacing.lg }} /> : null}
          {namesExpired ? (
            <Text color="textSecondary" style={styles.empty}>
              Viewer names are only available for 48 hours after you share a story.
            </Text>
          ) : !viewers.isPending && (viewers.data ?? []).length === 0 ? (
            <View style={[styles.empty, { gap: spacing.sm, alignItems: 'center' }]}>
              <Icon name="eye" size={36} color={colors.textSecondary} />
              <Text color="textSecondary">
                {search ? 'No results' : 'No one has seen this story yet'}
              </Text>
            </View>
          ) : null}
          {(viewers.data ?? []).map((v) => (
            <UserRow
              key={v.user_id}
              username={v.username}
              subtitle={viewerSubtitle(v, story)}
              avatarUri={avatarUrl(v.avatar_path)}
              onPress={() => {
                onClose();
                openProfile(v.username);
              }}
              trailing={
                <View style={[styles.row, { gap: spacing.lg }]}>
                  {v.liked ? <Icon name="heartFilled" size={18} color={colors.like} /> : null}
                  <Pressable
                    onPress={() => setRowMenu(v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${v.username}`}
                  >
                    <Icon name="more" size={22} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/direct/u/${v.user_id}`);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${v.username}`}
                  >
                    <Icon name="share" size={22} />
                  </Pressable>
                </View>
              }
            />
          ))}
        </ScrollView>
      </View>
      <ViewerRowSheet viewer={rowMenu} onClose={() => setRowMenu(null)} />
    </BottomSheet>
  );
}

function viewerSubtitle(v: StoryViewer, story: StoryCard): string {
  const parts: string[] = [];
  if (v.reply) parts.push(v.reply_is_reaction ? `Reacted ${v.reply}` : `Replied: ${v.reply}`);
  for (const r of v.responses ?? []) {
    const sticker = story.stickers.find((s) => s.type === r.type);
    const options = (sticker?.data.options as string[] | undefined) ?? [];
    if (r.type === 'poll' && r.option !== null) parts.push(`Voted ${options[r.option] ?? ''}`);
    if (r.type === 'quiz' && r.option !== null) parts.push(`Answered ${options[r.option] ?? ''}`);
    if (r.type === 'slider' && r.value !== null) parts.push(`Slid ${Math.round(r.value * 100)}%`);
    if (r.type === 'countdown') parts.push('Set a reminder');
  }
  return parts.join(' · ') || v.full_name || '';
}

/** Poll / quiz / slider results and question answers on your story. */
function StickerResults({
  story,
  responses,
  onShared,
}: {
  story: StoryCard;
  responses: StoryResponseRow[];
  onShared: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  if (story.stickers.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md }}>
      {story.stickers.map((s) => {
        const rows = responses.filter((r) => r.sticker_id === s.id);
        if (s.type === 'poll' || s.type === 'quiz') {
          const options = (s.data.options as string[]) ?? [];
          const total = rows.length;
          return (
            <View key={s.id} style={{ gap: spacing.xs }}>
              <Text variant="bodyBold">
                {(s.data.question as string) || (s.type === 'quiz' ? 'Quiz' : 'Poll')} · {total}{' '}
                {total === 1 ? 'vote' : 'votes'}
              </Text>
              {options.map((label, i) => {
                const voters = rows.filter((r) => r.option === i);
                const pct = total ? Math.round((voters.length / total) * 100) : 0;
                const correct = s.type === 'quiz' && s.results?.correct === i;
                return (
                  <View key={i} style={{ gap: 2 }}>
                    <View style={styles.row}>
                      <Text style={{ flex: 1 }}>
                        {label}
                        {correct ? ' ✓' : ''}
                      </Text>
                      <Text color="textSecondary">{pct}%</Text>
                    </View>
                    <View
                      style={[
                        styles.bar,
                        { backgroundColor: colors.backgroundSecondary, borderRadius: radius.sm },
                      ]}
                    >
                      <View
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: radius.sm,
                          backgroundColor: correct ? colors.success : colors.primary,
                        }}
                      />
                    </View>
                    {voters.length ? (
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>
                        {voters.map((r) => r.username).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        }
        if (s.type === 'slider') {
          const avg = rows.length
            ? rows.reduce((a, r) => a + (r.value ?? 0), 0) / rows.length
            : null;
          return (
            <Text key={s.id} variant="bodyBold">
              {(s.data.emoji as string) ?? ''} {(s.data.question as string) || 'Slider'} ·{' '}
              {avg === null
                ? 'No responses yet'
                : `Average ${Math.round(avg * 100)}% · ${rows.length} responses`}
            </Text>
          );
        }
        if (s.type === 'countdown') {
          return (
            <Text key={s.id} variant="bodyBold">
              ⏱ {(s.data.title as string) ?? ''} · {rows.length}{' '}
              {rows.length === 1 ? 'reminder' : 'reminders'}
            </Text>
          );
        }
        if (s.type === 'question') {
          const prompt = (s.data.prompt as string) ?? '';
          return (
            <View key={s.id} style={{ gap: spacing.sm }}>
              <Text variant="bodyBold">
                {prompt} · {rows.length} {rows.length === 1 ? 'response' : 'responses'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {rows.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      onShared();
                      router.push({
                        pathname: '/story/camera',
                        params: { answerPrompt: prompt, answerBody: r.body ?? '' },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${r.username}'s answer`}
                    style={[
                      styles.answer,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderRadius: radius.lg,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <Text variant="captionBold" color="textSecondary">
                      {r.username}
                    </Text>
                    <Text numberOfLines={4}>{r.body}</Text>
                    <Text variant="caption" color="link">
                      Share
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}

function ViewerRowSheet({ viewer, onClose }: { viewer: StoryViewer | null; onClose: () => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const hide = useToggleHiddenFrom();
  const remove = useRemoveFollower();
  return (
    <BottomSheet visible={viewer !== null} onClose={onClose} title={viewer?.username}>
      {viewer ? (
        <ActionGroup>
          <ActionRow
            icon="hide"
            label={
              viewer.is_hidden
                ? 'Show story to ' + viewer.username
                : 'Hide story from ' + viewer.username
            }
            onPress={() =>
              hide.mutate(
                { userId: viewer.user_id, hidden: viewer.is_hidden },
                {
                  onSuccess: () => {
                    toast.show(
                      viewer.is_hidden
                        ? 'Story unhidden'
                        : `${viewer.username} won't see your stories`,
                    );
                    onClose();
                  },
                },
              )
            }
          />
          {viewer.follows_me ? (
            <ActionRow
              icon="remove"
              label="Remove follower"
              destructive
              onPress={() =>
                showDialog(
                  'Remove follower?',
                  `We won't tell ${viewer.username} they were removed.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () =>
                        remove.mutate(
                          { me: profile!.id, followerId: viewer.user_id },
                          {
                            onSuccess: () => {
                              toast.show('Follower removed');
                              onClose();
                            },
                          },
                        ),
                    },
                  ],
                )
              }
            />
          ) : null}
        </ActionGroup>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  empty: { textAlign: 'center', padding: 24 },
  bar: { height: 6, overflow: 'hidden' },
  answer: { width: 160, gap: 4 },
});
