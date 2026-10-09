import { router } from 'expo-router';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { TopBar } from '@/features/profile/components/TopBar';
import { useHiddenFrom, useStorySettings, useUpdateStorySettings } from '@/features/stories/api';
import { useTheme } from '@/theme';

type Replies = 'everyone' | 'following' | 'off';

function Section({ title }: { title: string }) {
  const { spacing } = useTheme();
  return (
    <Text
      variant="subhead"
      style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm }}
    >
      {title}
    </Text>
  );
}

const REPLIES: { value: Replies; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'People you follow' },
  { value: 'off', label: 'Off' },
];

/**
 * Page 55 — story settings (built now by decision; Settings page 97 will link here): Hide story
 * from, Close Friends, who can reply, sharing your posts to others' stories, save to archive.
 */
export default function StorySettingsScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const settings = useStorySettings(profile?.id);
  const update = useUpdateStorySettings(profile?.id);
  const hidden = useHiddenFrom();
  const s = settings.data;

  const set = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, { onError: () => toast.show("Couldn't update settings.") });

  const switchColors = { false: colors.backgroundPressed, true: colors.primary };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Story" center />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Section title="Viewing" />
        <ActionRow
          icon="hide"
          label="Hide story from"
          detail={
            hidden.data?.length
              ? `${hidden.data.length} ${hidden.data.length === 1 ? 'person' : 'people'}`
              : undefined
          }
          trailing={<Icon name="chevronRight" size={20} color={colors.textSecondary} />}
          onPress={() => router.push('/story-settings/hidden')}
        />
        <ActionRow
          icon="closeFriends"
          label="Close Friends"
          trailing={<Icon name="chevronRight" size={20} color={colors.textSecondary} />}
          onPress={() => router.push('/close-friends')}
        />

        <Section title="Replying" />
        <Text
          variant="caption"
          color="textSecondary"
          style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
        >
          Choose who can reply and react to your stories.
        </Text>
        {REPLIES.map((r) => (
          <ActionRow
            key={r.value}
            label={r.label}
            trailing={
              <Icon
                name={s?.replies === r.value ? 'checkCircle' : 'radioOff'}
                size={24}
                color={s?.replies === r.value ? colors.primary : colors.textTertiary}
              />
            }
            onPress={() => set({ replies: r.value })}
          />
        ))}

        <Section title="Sharing" />
        <ActionRow
          label="Allow sharing to story"
          detail="Other people can add your feed posts to their stories. Your username will always show up with your post."
          trailing={
            <Switch
              value={s?.allow_resharing ?? true}
              onValueChange={(v) => set({ allow_resharing: v })}
              trackColor={switchColors}
              accessibilityLabel="Allow sharing to story"
            />
          }
        />

        <Section title="Saving" />
        <ActionRow
          label="Save story to archive"
          detail="Automatically save photos and videos to your archive so you don't have to save them to your phone. Only you can see your archive."
          trailing={
            <Switch
              value={s?.save_to_archive ?? true}
              onValueChange={(v) => set({ save_to_archive: v })}
              trackColor={switchColors}
              accessibilityLabel="Save story to archive"
            />
          }
        />
        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}
