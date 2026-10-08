import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Text } from '@/components';
import { useCollabInvites, useRespondCollab } from '@/features/posts/api';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/**
 * STUB until Activity (page 71, Phase 8): pending "invited you to collaborate" requests with
 * Accept / Decline. Accepting shows the post on your profile too.
 */
export default function CollabInvitesScreen() {
  const { colors, spacing } = useTheme();
  const invites = useCollabInvites();
  const respond = useRespondCollab();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Collaboration invites" center />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {invites.isPending ? <ActivityIndicator /> : null}
        {invites.data?.length === 0 ? (
          <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
            When someone invites you to collaborate on a post, it will appear here.
          </Text>
        ) : null}
        {(invites.data ?? []).map((inv) => (
          <View
            key={inv.post_id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <Avatar uri={avatarUrl(inv.author_avatar_path)} size={44} />
            <Text style={{ flex: 1 }}>
              <Text variant="bodyBold">{inv.author_username}</Text> invited you to collaborate on
              their post.
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/p/[id]', params: { id: inv.post_id } })}
              accessibilityRole="button"
              accessibilityLabel="Open post"
            >
              <Image
                source={{ uri: inv.coverUrl ?? undefined }}
                style={{ width: 44, height: 44, backgroundColor: colors.skeleton }}
                contentFit="cover"
              />
            </Pressable>
            <View style={{ gap: spacing.xs }}>
              <Button
                title="Accept"
                size="sm"
                onPress={() => respond.mutate({ postId: inv.post_id, accept: true })}
              />
              <Button
                title="Decline"
                size="sm"
                variant="secondary"
                onPress={() => respond.mutate({ postId: inv.post_id, accept: false })}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
