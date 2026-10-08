import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Button, Icon, Text, useToast } from '@/components';
import { SortableStrip } from '@/features/create/components/SortableStrip';
import { MAX_ALT, type ComposerTag } from '@/features/create/types';
import { usePost, useSavePostEdits, type PostDetail } from '@/features/posts/api';
import { CaptionInput, captionProblems } from '@/features/posts/components/CaptionInput';
import { TagEditor } from '@/features/posts/components/TagEditor';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

type Slide = {
  id: string;
  type: 'image' | 'video';
  uri: string;
  altText: string;
  tags: ComposerTag[];
};

function slidesOf(post: PostDetail): Slide[] {
  return post.media.map((m) => ({
    id: m.id,
    type: m.type === 'video' ? 'video' : 'image',
    uri: (m.type === 'video' ? m.thumbUrl : m.url) ?? '',
    altText: m.alt_text ?? '',
    tags: post.tags
      .filter((t) => t.media_id === m.id && t.user)
      .map((t) => ({ userId: t.user!.id, username: t.user!.username, x: t.x, y: t.y })),
  }));
}

/** Page 41 — Edit info: caption, tags, alt text, remove and reorder slides. */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const post = usePost(id);
  if (!post.data) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        {post.isPending ? <ActivityIndicator /> : <Text>Post isn&apos;t available</Text>}
      </SafeAreaView>
    );
  }
  return <EditPostForm post={post.data} />;
}

function EditPostForm({ post }: { post: PostDetail }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const save = useSavePostEdits(post);
  const ratio = Number(post.aspect_ratio);
  const [caption, setCaption] = useState(post.caption);
  const [slides, setSlides] = useState<Slide[]>(() => slidesOf(post));
  const [page, setPage] = useState(0);
  const [tagging, setTagging] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const current = slides[Math.min(page, slides.length - 1)];
  const problem = captionProblems(caption);

  const dirty =
    caption !== post.caption || JSON.stringify(slides) !== JSON.stringify(slidesOf(post));

  function cancel() {
    if (!dirty) return goBack();
    showDialog('Discard changes?', "If you go back now, you'll lose your changes.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => goBack() },
    ]);
  }

  function done() {
    if (problem) return;
    save.mutate(
      {
        caption,
        slides: slides.map((s) => ({
          id: s.id,
          altText: s.altText,
          tags: s.tags.map((t) => ({ userId: t.userId, x: t.x, y: t.y })),
        })),
      },
      {
        onSuccess: () => goBack(),
        onError: () => toast.show("Couldn't save your changes. Try again."),
      },
    );
  }

  function removeSlide(slideId: string) {
    showDialog('Delete this photo or video?', 'It will be removed from the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSlides((s) => s.filter((x) => x.id !== slideId));
          setPage(0);
        },
      },
    ]);
  }

  const patchSlide = (slideId: string, patch: Partial<Slide>) =>
    setSlides((s) => s.map((x) => (x.id === slideId ? { ...x, ...patch } : x)));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        back={false}
        left={<Button title="Cancel" variant="text" size="sm" onPress={cancel} />}
        title="Edit info"
        center
        right={
          save.isPending ? (
            <ActivityIndicator />
          ) : (
            <Button title="Done" variant="text" size="sm" disabled={!!problem} onPress={done} />
          )
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          {suggesting ? null : (
            <>
              <ScrollView
                key={slides.map((s) => s.id).join()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                  setPage(Math.round(e.nativeEvent.contentOffset.x / width))
                }
              >
                {slides.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      width,
                      height: width / ratio,
                      backgroundColor: colors.mediaBackground,
                    }}
                  >
                    <Image
                      source={{ uri: s.uri }}
                      style={{ width, height: width / ratio }}
                      contentFit="cover"
                    />
                    {s.type === 'video' ? (
                      <View style={[styles.videoMark, { backgroundColor: colors.mediaScrim }]}>
                        <Icon name="video" size={16} color={colors.onMedia} />
                      </View>
                    ) : null}
                    {slides.length > 1 ? (
                      <Pressable
                        onPress={() => removeSlide(s.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete this photo or video"
                        style={[styles.trash, { backgroundColor: colors.mediaScrim }]}
                      >
                        <Icon name="trash" size={18} color={colors.onMedia} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
              <View
                style={[
                  styles.tools,
                  { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
                ]}
              >
                <Pressable
                  onPress={() => setTagging(true)}
                  accessibilityRole="button"
                  style={styles.tool}
                >
                  <Icon name="tagPerson" size={20} />
                  <Text variant="bodyBold">Tag people</Text>
                </Pressable>
                <Pressable
                  onPress={() => setAltOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit alt text"
                  style={styles.tool}
                >
                  <Text variant="subhead">Aa</Text>
                  <Text variant="bodyBold">Alt text</Text>
                </Pressable>
              </View>
              {slides.length > 1 ? (
                <SortableStrip
                  items={slides.map((s) => ({ key: s.id, uri: s.uri, type: s.type }))}
                  selectedKey={current?.id ?? null}
                  onSelect={(key) => setPage(slides.findIndex((s) => s.id === key))}
                  onMove={(from, to) =>
                    setSlides((s) => {
                      const next = [...s];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      return next;
                    })
                  }
                />
              ) : null}
            </>
          )}
          <CaptionInput value={caption} onChangeText={setCaption} onSuggesting={setSuggesting} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={tagging} animationType="slide" onRequestClose={() => setTagging(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <TopBar
            back={false}
            title="Tag people"
            center
            right={
              <Button title="Done" variant="text" size="sm" onPress={() => setTagging(false)} />
            }
          />
          <TagEditor
            ratio={ratio}
            slides={slides.map((s) => ({ key: s.id, uri: s.uri, type: s.type, crop: null }))}
            tags={Object.fromEntries(slides.map((s) => [s.id, s.tags]))}
            onChange={(key, tags) => patchSlide(key, { tags })}
          />
        </SafeAreaView>
      </Modal>

      <BottomSheet visible={altOpen} onClose={() => setAltOpen(false)} title="Alt text">
        {current ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <TextInput
              value={current.altText}
              onChangeText={(altText) => patchSlide(current.id, { altText })}
              placeholder="Write alt text..."
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_ALT}
              multiline
              autoFocus
              accessibilityLabel="Alt text"
              style={{ color: colors.text, fontSize: 15, minHeight: 80, textAlignVertical: 'top' }}
            />
            <Text variant="caption" color="textSecondary">
              Alt text describes your photos for people with visual impairments.
            </Text>
            <Button title="Done" onPress={() => setAltOpen(false)} />
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', justifyContent: 'space-between' },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trash: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoMark: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
