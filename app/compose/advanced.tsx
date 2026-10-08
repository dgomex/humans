import { router } from 'expo-router';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, Icon, Text } from '@/components';
import { useComposer } from '@/features/create/ComposerProvider';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/** Page 36 → Advanced settings: hide like/view counts, turn off commenting, alt text. */
export default function AdvancedSettingsScreen() {
  const { colors, spacing } = useTheme();
  const composer = useComposer();
  const { hideLikeCounts, commentsDisabled } = composer.state;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Advanced settings" center />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.lg }}>
        <Section
          title="Likes and views"
          body="Only you will see the total number of likes and views on this post. You can change this later from the ··· menu at the top of the post."
        >
          <ActionRow
            label="Hide like and view counts on this post"
            trailing={
              <Switch
                value={hideLikeCounts}
                onValueChange={(v) => composer.update({ hideLikeCounts: v })}
                accessibilityLabel="Hide like and view counts on this post"
              />
            }
          />
        </Section>
        <Section
          title="Comments"
          body="You can change this later from the ··· menu at the top of your post."
        >
          <ActionRow
            label="Turn off commenting"
            trailing={
              <Switch
                value={commentsDisabled}
                onValueChange={(v) => composer.update({ commentsDisabled: v })}
                accessibilityLabel="Turn off commenting"
              />
            }
          />
        </Section>
        <Section
          title="Accessibility"
          body="Alt text describes your photos for people with visual impairments."
        >
          <ActionRow
            label="Write alt text"
            trailing={<Icon name="chevronRight" size={18} color={colors.textTertiary} />}
            onPress={() => router.push('/compose/alt-text')}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View>
      <Text variant="subhead" style={{ paddingHorizontal: spacing.lg }}>
        {title}
      </Text>
      {children}
      <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: spacing.lg }}>
        {body}
      </Text>
    </View>
  );
}
