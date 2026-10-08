import { router, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, BottomSheet, Button, Icon, Text, useToast } from '@/components';
import { useComposer } from '@/features/create/ComposerProvider';
import { CroppedImage } from '@/features/create/components/CroppedImage';
import { cropOf } from '@/features/create/media';
import type { Audience } from '@/features/create/types';
import { useUploadQueue } from '@/features/create/UploadQueue';
import { CaptionInput, captionProblems } from '@/features/posts/components/CaptionInput';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

const THUMB = 64;

/**
 * Page 36 — caption (@/# autocomplete), Tag people, collaborators, audience, music and advanced
 * settings, then Share. Decision: no location, no Facebook/Threads sharing.
 */
export default function DetailsScreen() {
  const { colors, spacing, hairline } = useTheme();
  const toast = useToast();
  const composer = useComposer();
  const queue = useUploadQueue();
  const navigation = useNavigation();
  const { state } = composer;
  const [suggesting, setSuggesting] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const onSuggesting = useCallback((v: boolean) => setSuggesting(v), []);

  const first = state.items[0];
  const tagged = [...new Set(state.items.flatMap((i) => i.tags.map((t) => t.username)))];
  const problem = captionProblems(state.caption);

  async function share() {
    if (problem || sharing) return;
    setSharing(true);
    try {
      await queue.enqueue(state);
      composer.allowExit();
      // Close the whole creation modal (it's one route of the root stack), then show Home,
      // where the posting row is.
      navigation.getParent()?.goBack();
      router.navigate('/');
    } catch {
      toast.show("Couldn't start posting. Try again.");
      setSharing(false);
    }
  }

  const thumb = first ? (
    first.type === 'image' ? (
      <CroppedImage
        uri={first.uri}
        crop={cropOf(first, state.ratio)}
        width={THUMB}
        height={THUMB / state.ratio}
      />
    ) : (
      <View
        style={{
          width: THUMB,
          height: THUMB / state.ratio,
          backgroundColor: colors.skeleton,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="video" size={20} />
      </View>
    )
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="New post" center />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          <CaptionInput
            value={state.caption}
            onChangeText={(caption) => composer.update({ caption })}
            onSuggesting={onSuggesting}
            leading={thumb}
          />
          {suggesting ? null : (
            <View style={{ borderTopWidth: hairline, borderTopColor: colors.separator }}>
              <ActionRow
                icon="tagPerson"
                label="Tag people"
                detail={tagged.length ? tagged.join(', ') : undefined}
                trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
                onPress={() => router.push('/compose/tag-people')}
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
                onPress={() => setAudienceOpen(true)}
              />
              <ActionRow
                icon="music"
                label={state.music ? state.music.title : 'Add music'}
                detail={state.music ? state.music.artist : undefined}
                trailing={
                  state.music ? (
                    <Pressable
                      onPress={() => composer.update({ music: null })}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove music"
                    >
                      <Icon name="close" size={20} />
                    </Pressable>
                  ) : (
                    <Icon name="chevronRight" size={18} color={colors.textTertiary} />
                  )
                }
                onPress={() => router.push('/compose/music')}
              />
              <ActionRow
                icon="sliders"
                label="Advanced settings"
                trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
                onPress={() => router.push('/compose/advanced')}
              />
            </View>
          )}
        </ScrollView>
        <View
          style={{
            padding: spacing.lg,
            borderTopWidth: hairline,
            borderTopColor: colors.separator,
          }}
        >
          <Button
            title="Share"
            size="lg"
            fullWidth
            loading={sharing}
            disabled={!!problem || state.items.length === 0}
            onPress={() => void share()}
          />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={audienceOpen} onClose={() => setAudienceOpen(false)} title="Audience">
        {(
          [
            ['everyone', 'Everyone', 'Anyone who can see your posts'],
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
              setAudienceOpen(false);
            }}
          />
        ))}
        <Text
          variant="caption"
          color="textSecondary"
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
        >
          Close Friends posts show a green star and only appear for people on your list.
        </Text>
      </BottomSheet>
    </SafeAreaView>
  );
}
