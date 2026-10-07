import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { Avatar, BottomSheet, Button, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthStep } from '@/features/auth/components/AuthStep';
import {
  PermissionDeniedError,
  avatarUrl,
  openAppSettings,
  pickAvatar,
  uploadAvatar,
  type AvatarSource,
} from '@/features/profile/avatar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/** Page 010 — Add a profile picture ("Share as a post" waits for Phase 3 posts). */
export default function PhotoScreen() {
  const { spacing, colors } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [uploading, setUploading] = useState(false);
  const profile = auth.profile;
  const uri = avatarUrl(profile?.avatar_path);

  async function choose(source: AvatarSource) {
    setSheet(false);
    if (!profile) return;
    try {
      const local = await pickAvatar(source);
      if (!local) return;
      setUploading(true);
      await uploadAvatar(profile, local);
      await auth.refreshProfile();
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        showDialog(
          e.message,
          `To add a profile picture, allow Humans to access your ${source === 'camera' ? 'camera' : 'photos'} in Settings.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void openAppSettings() },
          ],
        );
      } else {
        toast.show("Couldn't upload photo. Try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  const added = !!uri;

  return (
    <AuthStep
      onBack={null}
      title={added ? 'Profile picture added' : 'Add a profile picture'}
      subtitle={
        added
          ? undefined
          : "Add a profile picture so your friends know it's you. Everyone will be able to see your picture."
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <View>
          <Avatar uri={uri} size={168} />
          {uploading ? (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 84,
                backgroundColor: colors.overlay,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
      </View>

      {added ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">Share as a post</Text>
              <Text variant="caption" color="textSecondary">
                Available once posting is ready.
              </Text>
            </View>
            <Switch value={false} disabled accessibilityLabel="Share as a post" />
          </View>
          <Button
            title="Next"
            shape="pill"
            size="lg"
            fullWidth
            onPress={() => router.replace('/contacts')}
          />
          <Button
            title="Change picture"
            variant="text"
            onPress={() => setSheet(true)}
            style={{ alignSelf: 'center' }}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Button
            title="Add picture"
            shape="pill"
            size="lg"
            fullWidth
            loading={uploading}
            onPress={() => setSheet(true)}
          />
          <Button
            title="Skip"
            variant="text"
            onPress={() => router.replace('/contacts')}
            style={{ alignSelf: 'center' }}
          />
        </View>
      )}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Add profile picture">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}>
          <Button
            title="Take photo"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => choose('camera')}
          />
          <Button
            title="Choose from library"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => choose('library')}
          />
        </View>
      </BottomSheet>
    </AuthStep>
  );
}
