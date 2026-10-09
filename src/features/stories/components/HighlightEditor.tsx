import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionGroup, ActionRow, Avatar, BottomSheet, Button, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHighlights } from '@/features/profile/api';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { BUCKETS, uploadFile } from '@/lib/storage';
import { useTheme } from '@/theme';

import {
  highlightStoryIds,
  useHighlightCovers,
  useSaveHighlight,
  useStoryArchive,
  type ArchiveEntry,
} from '../api';
import { ArchiveGrid } from './ArchiveGrid';
import { StoryThumb } from './StoryThumb';

const COVER_PX = 320;

/** Square-crop an image (local or remote URL) to a 320 px JPEG for the cover. */
async function squareCover(uri: string) {
  const loaded = await ImageManipulator.manipulate(uri).renderAsync();
  const side = Math.min(loaded.width, loaded.height);
  const image = await ImageManipulator.manipulate(uri)
    .crop({
      originX: Math.round((loaded.width - side) / 2),
      originY: Math.round((loaded.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: COVER_PX, height: COVER_PX })
    .renderAsync();
  return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })).uri;
}

const storyImage = (e: ArchiveEntry) => {
  const p = e.thumb_path ?? e.media_path;
  return p ? (e.urls[p] ?? null) : null;
};

/**
 * Page 25 — highlight editor. New: pick stories from your archive → title + cover → Add.
 * Edit (`highlightId`): Selected / Archive tabs to add or remove stories, title, cover.
 * Cover = a square crop of one of the highlight's stories, or a photo from your library.
 */
export function HighlightEditor({ highlightId }: { highlightId?: string }) {
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const archive = useStoryArchive();
  const highlights = useHighlights(profile?.id, !!highlightId);
  const existing = highlights.data?.find((h) => h.id === highlightId);
  const covers = useHighlightCovers(existing ? [existing] : []);
  const initialIds = useQuery({
    queryKey: ['stories', 'highlight-items', highlightId ?? ''],
    enabled: !!highlightId,
    queryFn: () => highlightStoryIds(highlightId!),
  });
  const save = useSaveHighlight();

  const [step, setStep] = useState<'select' | 'details'>(highlightId ? 'details' : 'select');
  const [tab, setTab] = useState<'selected' | 'archive'>('selected');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  /** New cover picked in this session (local square JPEG), uploaded on save. */
  const [cover, setCover] = useState<string | null>(null);
  const [coverSheet, setCoverSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const entries = archive.data?.pages.flat() ?? [];
  const selected = picked ?? initialIds.data ?? [];
  const name = title ?? existing?.title ?? '';
  const chosen = selected
    .map((id) => entries.find((e) => e.id === id))
    .filter((e): e is ArchiveEntry => !!e);
  const existingCover = existing ? covers[existing.id] : null;
  const firstImage = chosen[0] ? storyImage(chosen[0]) : null;
  const coverUri = cover || existingCover || firstImage || null;

  const toggle = (e: ArchiveEntry) =>
    setPicked((prev) => {
      const cur = prev ?? initialIds.data ?? [];
      return cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id];
    });

  async function chooseCover(source: ArchiveEntry | 'library') {
    setCoverSheet(false);
    try {
      let uri: string | null = null;
      if (source === 'library') {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 1,
        });
        if (res.canceled) return;
        uri = res.assets[0].uri;
      } else {
        uri = storyImage(source);
        if (!uri) {
          toast.show('This story has no image to use');
          return;
        }
      }
      setCover(await squareCover(uri));
    } catch {
      toast.show("Couldn't use that cover");
    }
  }

  async function done() {
    if (!profile || selected.length === 0) return;
    setBusy(true);
    try {
      let coverPath = existing?.cover_path ?? null;
      if (cover) {
        coverPath = await uploadFile(
          BUCKETS.highlightCovers,
          `${profile.id}/${Crypto.randomUUID()}.jpg`,
          cover,
          { contentType: 'image/jpeg' },
        );
      }
      await save.mutateAsync({
        id: highlightId ?? null,
        title: name.trim() || 'Highlights',
        coverPath,
        storyIds: selected,
      });
      toast.show(highlightId ? 'Highlight updated' : 'Highlight added');
      goBack('/profile');
    } catch {
      toast.show("Couldn't save highlight. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === 'select') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <TopBar
          title="New highlight"
          center
          right={
            <Button
              title="Next"
              variant="text"
              size="sm"
              disabled={selected.length === 0}
              onPress={() => setStep('details')}
            />
          }
        />
        <ScrollView>
          {archive.isPending ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
          {!archive.isPending && entries.length === 0 ? (
            <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
              <Text variant="headline">No stories in your archive</Text>
              <Text color="textSecondary" style={{ textAlign: 'center' }}>
                Highlights are made from stories you&apos;ve shared. Share a story, then come back
                to add it here.
              </Text>
              <Button title="Share a story" onPress={() => router.push('/story/camera')} />
            </View>
          ) : null}
          <ArchiveGrid entries={entries} selected={selected} onPress={toggle} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={highlightId ? 'Edit highlight' : 'Title'}
        center
        onBack={highlightId ? undefined : () => setStep('select')}
        right={
          <Button
            title={highlightId ? 'Done' : 'Add'}
            variant="text"
            size="sm"
            loading={busy}
            disabled={selected.length === 0}
            onPress={() => void done()}
          />
        }
      />
      <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.sm }}>
        <Avatar uri={coverUri} size={96} />
        <Pressable onPress={() => setCoverSheet(true)} accessibilityRole="button" hitSlop={8}>
          <Text variant="bodyBold" color="link">
            Edit cover
          </Text>
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setTitle}
          placeholder="Highlights"
          placeholderTextColor={colors.textTertiary}
          maxLength={32}
          style={[
            styles.title,
            { color: colors.text, borderColor: colors.separator, borderRadius: radius.md },
          ]}
          accessibilityLabel="Highlight title"
        />
      </View>
      {highlightId ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            {(['selected', 'archive'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={[styles.tab, { borderColor: tab === t ? colors.text : colors.separator }]}
              >
                <Text variant="bodyBold" color={tab === t ? 'text' : 'textSecondary'}>
                  {t === 'selected' ? 'Selected' : 'Stories'}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView>
            <ArchiveGrid
              entries={tab === 'selected' ? chosen : entries}
              selected={selected}
              onPress={toggle}
            />
            {selected.length === 0 ? (
              <Text color="textSecondary" style={{ padding: spacing.xl, textAlign: 'center' }}>
                Select at least one story.
              </Text>
            ) : null}
          </ScrollView>
        </>
      ) : null}

      <BottomSheet visible={coverSheet} onClose={() => setCoverSheet(false)} title="Edit cover">
        <ScrollView
          horizontal
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            paddingBottom: spacing.md,
          }}
        >
          {chosen.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => void chooseCover(e)}
              accessibilityRole="button"
              accessibilityLabel="Use this story as cover"
              style={{ borderRadius: 6, overflow: 'hidden' }}
            >
              <StoryThumb story={e} width={64} />
            </Pressable>
          ))}
        </ScrollView>
        <ActionGroup>
          <ActionRow
            icon="image"
            label="Choose from library"
            onPress={() => void chooseCover('library')}
          />
        </ActionGroup>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    alignSelf: 'stretch',
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
});
