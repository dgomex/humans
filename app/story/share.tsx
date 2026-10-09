import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { useStoryComposer } from '@/features/stories/StoryComposer';
import { useStoryUploads } from '@/features/stories/StoryUploads';
import type { StoryAudience } from '@/features/stories/types';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/**
 * Page 55 — "Send to": Your story or Close Friends (with the list editor and a count), story
 * settings, and (Phase 9) sending to chats. Share posts every story in the composer.
 */
export default function StoryShareScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const composer = useStoryComposer();
  const uploads = useStoryUploads();
  const closeFriends = useQuery({
    queryKey: ['stories', 'close-friends-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('close_friends')
        .select('friend_id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const share = () => {
    const ready = composer.items.filter((d) => d.kind !== 'text' || d.content.elements.length > 0);
    if (ready.length === 0) {
      toast.show('Add some text or stickers first');
      return;
    }
    void uploads.enqueue(ready, composer.audience);
    // Closing the modal drops the composer.
    router.dismissTo('/');
  };

  const select = (value: StoryAudience) => {
    if (value === 'close_friends' && closeFriends.data === 0) {
      router.push('/close-friends');
      return;
    }
    composer.setAudience(value);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Share" center />
      <ScrollView>
        <AudienceOption
          selected={composer.audience === 'everyone'}
          onPress={() => select('everyone')}
          title="Your story"
          detail={
            profile?.is_private
              ? 'Your followers'
              : 'Everyone who follows you or visits your profile'
          }
          leading={<Avatar uri={avatarUrl(profile?.avatar_path)} size={44} />}
          trailing={
            <Pressable
              onPress={() => router.push('/story-settings')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Story settings"
            >
              <Icon name="settings" size={22} />
            </Pressable>
          }
        />
        <AudienceOption
          selected={composer.audience === 'close_friends'}
          onPress={() => select('close_friends')}
          title="Close Friends"
          detail={
            closeFriends.data
              ? `${closeFriends.data} ${closeFriends.data === 1 ? 'person' : 'people'}`
              : 'Add people to your list'
          }
          leading={
            <View style={[styles.cf, { backgroundColor: colors.closeFriends }]}>
              <Icon name="star" size={22} color={colors.onMedia} />
            </View>
          }
          trailing={
            <Pressable
              onPress={() => router.push('/close-friends')}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text variant="bodyBold" color="link">
                Edit
              </Text>
            </Pressable>
          }
        />
        <View style={{ padding: spacing.lg, gap: spacing.xs }}>
          <Text variant="bodyBold">Send to chats</Text>
          <Text color="textSecondary">
            Sending stories in messages arrives with Direct messages.
          </Text>
        </View>
      </ScrollView>
      <View style={{ padding: spacing.lg }}>
        <Button
          title={composer.items.length > 1 ? `Share ${composer.items.length} stories` : 'Share'}
          onPress={share}
        />
      </View>
    </SafeAreaView>
  );
}

function AudienceOption({
  selected,
  onPress,
  title,
  detail,
  leading,
  trailing,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  detail: string;
  leading: ReactNode;
  trailing?: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[
        styles.row,
        { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
      ]}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {detail}
        </Text>
      </View>
      {trailing}
      <Icon
        name={selected ? 'checkCircle' : 'radioOff'}
        size={24}
        color={selected ? colors.primary : colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  cf: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
