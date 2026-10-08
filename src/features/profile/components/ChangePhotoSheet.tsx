import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ActionRow, BottomSheet, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { showDialog } from '@/lib/dialog';

import { invalidateProfiles } from '../api';
import {
  PermissionDeniedError,
  openAppSettings,
  pickAvatar,
  removeAvatar,
  uploadAvatar,
  type AvatarSource,
} from '../avatar';

/**
 * Page 020 — Change profile photo sheet: New profile picture · Take photo · Remove current
 * picture. Returns the sheet element plus `open` and the upload state.
 */
export function useChangePhotoSheet() {
  const auth = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const profile = auth.profile;

  async function run(task: () => Promise<unknown>, failure: string) {
    setBusy(true);
    try {
      await task();
      await auth.refreshProfile();
      await invalidateProfiles(qc);
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        showDialog(
          e.message,
          `To change your profile picture, allow Humans to access your ${e.source === 'camera' ? 'camera' : 'photos'} in Settings.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void openAppSettings() },
          ],
        );
      } else {
        toast.show(failure);
      }
    } finally {
      setBusy(false);
    }
  }

  function choose(source: AvatarSource) {
    setVisible(false);
    if (!profile) return;
    void run(async () => {
      const local = await pickAvatar(source);
      if (local) await uploadAvatar(profile, local);
    }, "Couldn't upload photo. Try again.");
  }

  function remove() {
    setVisible(false);
    if (!profile) return;
    showDialog('Remove profile picture?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void run(() => removeAvatar(profile), "Couldn't remove photo. Try again."),
      },
    ]);
  }

  const sheet = (
    <BottomSheet visible={visible} onClose={() => setVisible(false)} title="Change profile picture">
      <ActionRow icon="image" label="New profile picture" onPress={() => choose('library')} />
      <ActionRow icon="camera" label="Take photo" onPress={() => choose('camera')} />
      {profile?.avatar_path ? (
        <ActionRow icon="trash" label="Remove current picture" destructive onPress={remove} />
      ) : null}
    </BottomSheet>
  );

  return { sheet, open: () => setVisible(true), busy };
}
