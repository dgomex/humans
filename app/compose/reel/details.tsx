import { router, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, BottomSheet, Button, Icon, Text, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSaveDraft } from '@/features/create/drafts';
import { MAX_TAGS, type Audience } from '@/features/create/types';
import { useUploadQueue } from '@/features/create/UploadQueue';
import { CaptionInput, captionProblems } from '@/features/posts/components/CaptionInput';
import { PersonSearchSheet } from '@/features/posts/components/PersonSearchSheet';
import { TopBar } from '@/features/profile/components/TopBar';
import { useMyReels } from '@/features/reels/api';
import { CoverImage } from '@/features/reels/components/ReelPlayer';
import { useReelComposer } from '@/features/reels/composer';
import { MAX_REEL_MS } from '@/features/reels/types';
import { useTheme } from '@/theme';

const COVER_W = 72;

/**
 * Page 61 — New reel: cover (Edit cover → page 61 cover picker), caption with @/#, Tag people,
 * collaborators, audience, the reel's audio (rename your original audio), Link a reel ("Watch
 * next part"), and advanced settings (hide like & view counts, comments, remixing, downloads).
 * Save draft or Share (background upload, page 40). Decision: no location / trial / Facebook.
 */
export default function ReelDetailsScreen() {
  const { colors, spacing, hairline, radius } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const navigation = useNavigation();
  const queue = useUploadQueue();
  const saveDraft = useSaveDraft(profile?.id);
  const { composer, state, reel, updateReel, length } = useReelComposer();
  const [suggesting, setSuggesting] = useState(false);
  const [sheet, setSheet] = useState<null | 'audience' | 'tags' | 'audio' | 'link'>(null);
  const [sharing, setSharing] = useState(false);
  const onSuggesting = useCallback((v: boolean) => setSuggesting(v), []);
  const myReels = useMyReels(sheet === 'link');

  const problem = captionProblems(state.caption);
  const first = state.items[0];
  const tags = first?.tags ?? [];
  const coverUri = reel?.cover?.uri ?? (first?.type === 'image' ? first.uri : null);

  async function share() {
    if (problem || sharing || !reel) return;
    if (length > MAX_REEL_MS + 500) {
      toast.show('Reels can be up to 3 minutes.');
      return;
    }
    setSharing(true);
    try {
      await queue.enqueue(state);
      composer.allowExit();
      navigation.getParent()?.goBack();
      router.navigate('/reels');
    } catch {
      toast.show("Couldn't start sharing. Try again.");
      setSharing(false);
    }
  }

  function setTags(next: typeof tags) {
    if (!first) return;
    composer.updateItem(first.key, { tags: next });
  }

  const audioLabel = state.music
    ? `${state.music.title} · ${state.music.artist}`
    : reel?.borrowedAudio
      ? `${reel.borrowedAudio.artist} · ${reel.borrowedAudio.title}`
      : `${profile?.username ?? 'You'} · ${reel?.audioTitle.trim() || 'Original audio'}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="New reel" center />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          <CaptionInput
            value={state.caption}
            onChangeText={(caption) => composer.update({ caption })}
            onSuggesting={onSuggesting}
            leading={
              <Pressable
                onPress={() => router.push('/compose/reel/cover')}
                accessibilityRole="button"
                accessibilityLabel="Edit cover"
              >
                <CoverImage
                  uri={coverUri}
                  style={{ width: COVER_W, height: (COVER_W * 16) / 9, borderRadius: radius.md }}
                >
                  <View style={[styles.editCover, { backgroundColor: colors.mediaScrim }]}>
                    <Text variant="tiny" style={{ color: colors.onMedia }}>
                      Edit cover
                    </Text>
                  </View>
                </CoverImage>
              </Pressable>
            }
          />
          {suggesting ? null : (
            <View style={{ borderTopWidth: hairline, borderTopColor: colors.separator }}>
              <ActionRow
                icon="tagPerson"
                label="Tag people"
                detail={tags.length ? tags.map((t) => t.username).join(', ') : undefined}
                trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
                onPress={() => setSheet('tags')}
              />
              <ActionRow
                icon="collab"
                label="Add collaborators"
                detail={
                  state.collaborators.length
                    ? state.collaborators.map((c) => c.username).join(', ')
                    : undefined
                }
                trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
                onPress={() => router.push('/compose/collaborators')}
              />
              <ActionRow
                icon="audience"
                label="Audience"
                detail={state.audience === 'everyone' ? 'Everyone' : 'Close Friends'}
                trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
                onPress={() => setSheet('audience')}
              />
              <ActionRow
                icon="music"
                label="Audio"
                detail={audioLabel}
                trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
                onPress={() =>
                  state.music || reel?.borrowedAudio
                    ? router.push('/compose/music')
                    : setSheet('audio')
                }
              />
              <ActionRow
                icon="linkReel"
                label="Link a reel"
                detail={reel?.linkedReel ? 'Watch next part' : undefined}
                trailing={
                  reel?.linkedReel ? (
                    <Pressable
                      onPress={() => updateReel({ linkedReel: null })}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove linked reel"
                    >
                      <Icon name="close" size={20} />
                    </Pressable>
                  ) : (
                    <Icon name="chevronRight" size={18} color={colors.textTertiary} />
                  )
                }
                onPress={() => setSheet('link')}
              />

              <Text
                variant="bodyBold"
                style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}
              >
                Advanced settings
              </Text>
              <Toggle
                label="Hide like and view counts"
                value={state.hideLikeCounts}
                onChange={(v) => composer.update({ hideLikeCounts: v })}
              />
              <Toggle
                label="Turn off commenting"
                value={state.commentsDisabled}
                onChange={(v) => composer.update({ commentsDisabled: v })}
              />
              <Toggle
                label="Allow remixing"
                detail="People can remix this reel with theirs (public accounts only)."
                value={reel?.allowRemix ?? true}
                onChange={(v) => updateReel({ allowRemix: v })}
              />
              <Toggle
                label="Allow downloads"
                detail="People can save this reel's clips to their phone."
                value={reel?.allowDownload ?? true}
                onChange={(v) => updateReel({ allowDownload: v })}
              />
            </View>
          )}
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              padding: spacing.lg,
              gap: spacing.sm,
              borderTopWidth: hairline,
              borderTopColor: colors.separator,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Button
              title="Save draft"
              variant="secondary"
              size="lg"
              fullWidth
              loading={saveDraft.isPending}
              onPress={() =>
                saveDraft.mutate(state, {
                  onSuccess: () => {
                    toast.show('Draft saved');
                    composer.allowExit();
                    navigation.getParent()?.goBack();
                  },
                  onError: () => toast.show("Couldn't save the draft."),
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Share"
              size="lg"
              fullWidth
              loading={sharing}
              disabled={!!problem || state.items.length === 0}
              onPress={() => void share()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={sheet === 'audience'} onClose={() => setSheet(null)} title="Audience">
        {(
          [
            ['everyone', 'Everyone', 'Anyone who can see your reels'],
            ['close_friends', 'Close Friends', 'Only people on your Close Friends list'],
          ] as [Audience, string, string][]
        ).map(([value, label, detail]) => (
          <ActionRow
            key={value}
            icon={value === 'everyone' ? 'globe' : 'closeFriends'}
            label={label}
            detail={detail}
            trailing={
              <Icon
                name={state.audience === value ? 'radioOn' : 'radioOff'}
                size={22}
                color={state.audience === value ? colors.primary : colors.textTertiary}
              />
            }
            onPress={() => {
              composer.update({ audience: value });
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <TagSheet
        visible={sheet === 'tags'}
        tags={tags}
        onClose={() => setSheet(null)}
        onChange={setTags}
        exclude={profile ? [profile.id] : []}
      />

      <BottomSheet
        visible={sheet === 'audio'}
        onClose={() => setSheet(null)}
        title="Original audio"
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Text color="textSecondary">
            Your reel&apos;s sound becomes original audio that others can use. Give it a name:
          </Text>
          <TextInput
            value={reel?.audioTitle ?? ''}
            onChangeText={(t) => updateReel({ audioTitle: t })}
            maxLength={60}
            placeholder="Original audio"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: radius.md,
              },
            ]}
          />
          <Button
            title="Add music instead"
            variant="secondary"
            onPress={() => {
              setSheet(null);
              router.push('/compose/music');
            }}
          />
          <Button title="Done" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'link'} onClose={() => setSheet(null)} title="Link a reel">
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Text color="textSecondary">
            Viewers see a &quot;Watch next part&quot; button that opens the reel you pick.
          </Text>
          <View style={styles.grid}>
            {(myReels.data ?? []).map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  updateReel({ linkedReel: { id: r.id, coverPath: null } });
                  setSheet(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Link this reel"
              >
                <CoverImage
                  uri={r.coverUrl}
                  style={{
                    width: 96,
                    height: (96 * 16) / 9,
                    borderRadius: 6,
                    borderWidth: reel?.linkedReel?.id === r.id ? 3 : 0,
                    borderColor: colors.primary,
                  }}
                />
              </Pressable>
            ))}
          </View>
          {myReels.isSuccess && myReels.data.length === 0 ? (
            <Text color="textSecondary">You don&apos;t have other reels yet.</Text>
          ) : null}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Toggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <ActionRow
      label={label}
      detail={detail}
      trailing={<Switch value={value} onValueChange={onChange} accessibilityLabel={label} />}
    />
  );
}

/** Tag people on a reel: a list (videos have no tag positions), up to 20. */
function TagSheet({
  visible,
  tags,
  onClose,
  onChange,
  exclude,
}: {
  visible: boolean;
  tags: { userId: string; username: string; x: number | null; y: number | null }[];
  onClose: () => void;
  onChange: (tags: { userId: string; username: string; x: null; y: null }[]) => void;
  exclude: string[];
}) {
  const { spacing } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState(false);
  const clean = tags.map((t) => ({ userId: t.userId, username: t.username, x: null, y: null }));
  return (
    <>
      <BottomSheet visible={visible && !search} onClose={onClose} title="Tag people">
        <View style={{ gap: spacing.sm }}>
          {clean.map((t) => (
            <UserRow
              key={t.userId}
              username={t.username}
              trailing={
                <Pressable
                  onPress={() => onChange(clean.filter((x) => x.userId !== t.userId))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${t.username}`}
                >
                  <Icon name="close" size={20} />
                </Pressable>
              }
            />
          ))}
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <Button
              title="Add people"
              variant="secondary"
              onPress={() =>
                clean.length >= MAX_TAGS
                  ? toast.show(`You can tag up to ${MAX_TAGS} people.`)
                  : setSearch(true)
              }
            />
            <Button title="Done" onPress={onClose} />
          </View>
        </View>
      </BottomSheet>
      <PersonSearchSheet
        visible={visible && search}
        onClose={() => setSearch(false)}
        exclude={[...exclude, ...clean.map((t) => t.userId)]}
        onPick={(p) => {
          onChange([...clean, { userId: p.id, username: p.username, x: null, y: null }]);
          setSearch(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  editCover: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingVertical: 2,
  },
  footer: { flexDirection: 'row' },
  input: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
