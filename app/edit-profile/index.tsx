import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { parseLinks, useProfile, useUpdateProfile } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { useChangePhotoSheet } from '@/features/profile/components/ChangePhotoSheet';
import { TopBar } from '@/features/profile/components/TopBar';
import { displayLink } from '@/features/profile/format';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

type Field = 'name' | 'username' | 'bio' | 'links';

/**
 * Page 019 — Edit profile (agreed minimal fields: name, username, bio, links, photo) plus a
 * temporary "Private account" switch until Settings → Account privacy (page 91, Phase 11).
 */
export default function EditProfileScreen() {
  const { colors, spacing, hairline } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const profile = useProfile({ userId: auth.session?.user.id });
  const update = useUpdateProfile();
  const photo = useChangePhotoSheet();
  const p = profile.data;

  function setPrivate(next: boolean) {
    if (!p) return;
    const apply = () =>
      update.mutate(
        { id: p.id, patch: { is_private: next } },
        { onError: () => toast.show("Couldn't change account privacy.") },
      );
    showDialog(
      next ? 'Switch to private account?' : 'Switch to public account?',
      next
        ? 'Only your followers will be able to see your photos and videos. This won’t change who can see your profile picture, username and bio.'
        : 'Anyone will be able to see your posts. Pending follow requests will be approved automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: next ? 'Switch to private' : 'Switch to public', onPress: apply },
      ],
    );
  }

  const links = parseLinks(p?.links);
  const rows: { field: Field; label: string; value: string; placeholder: string }[] = [
    { field: 'name', label: 'Name', value: p?.full_name ?? '', placeholder: 'Name' },
    { field: 'username', label: 'Username', value: p?.username ?? '', placeholder: 'Username' },
    { field: 'bio', label: 'Bio', value: p?.bio ?? '', placeholder: 'Bio' },
    {
      field: 'links',
      label: 'Links',
      value: links.length
        ? links.length === 1
          ? displayLink(links[0].url)
          : `${links.length} links`
        : '',
      placeholder: 'Add links',
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Edit profile" center />
      {p ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
            <View>
              <Avatar uri={avatarUrl(p.avatar_path)} size={86} onPress={photo.open} />
              {photo.busy ? (
                <ActivityIndicator style={{ position: 'absolute', top: 33, left: 33 }} />
              ) : null}
            </View>
            <Text variant="bodyBold" color="link" onPress={photo.open} accessibilityRole="button">
              Edit picture
            </Text>
          </View>
          {rows.map((r) => (
            <Pressable
              key={r.field}
              onPress={() =>
                router.push(
                  r.field === 'links'
                    ? '/edit-profile/links'
                    : { pathname: '/edit-profile/[field]', params: { field: r.field } },
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`${r.label}: ${r.value || 'empty'}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
              })}
            >
              <Text style={{ width: 96 }}>{r.label}</Text>
              <View
                style={{
                  flex: 1,
                  paddingBottom: spacing.sm,
                  borderBottomWidth: hairline,
                  borderBottomColor: colors.separator,
                }}
              >
                <Text
                  color={r.value ? 'text' : 'textTertiary'}
                  numberOfLines={r.field === 'bio' ? 3 : 1}
                >
                  {r.value || r.placeholder}
                </Text>
              </View>
            </Pressable>
          ))}
          <View
            style={{
              marginTop: spacing.xl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              borderTopWidth: hairline,
              borderTopColor: colors.separator,
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodyBold" style={{ flex: 1 }}>
                Private account
              </Text>
              <Switch
                value={p.is_private}
                onValueChange={setPrivate}
                trackColor={{ true: colors.primary, false: colors.backgroundPressed }}
                accessibilityLabel="Private account"
              />
            </View>
            <Text variant="caption" color="textSecondary">
              When your account is private, only people you approve can see your photos, videos and
              the lists of who follows you and who you follow.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      )}
      {photo.sheet}
    </SafeAreaView>
  );
}
