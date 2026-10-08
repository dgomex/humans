import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

import { BUCKETS, getPublicUrl, removeFiles, storagePaths, uploadFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import type { Profile } from '../auth/api';

export type AvatarSource = 'camera' | 'library';

export class PermissionDeniedError extends Error {
  constructor(public source: AvatarSource) {
    super(source === 'camera' ? 'Camera access is off' : 'Photo access is off');
  }
}

export const openAppSettings = () => Linking.openSettings();

/** Public URL for a profile picture path (avatars bucket is public). */
export function avatarUrl(path: string | null | undefined): string | null {
  return path ? getPublicUrl(BUCKETS.avatars, path) : null;
}

/** Let the user pick or take a square photo. Returns a local URI, or null if cancelled. */
export async function pickAvatar(source: AvatarSource): Promise<string | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new PermissionDeniedError(source);

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          ...options,
          cameraType: ImagePicker.CameraType.front,
        })
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/** Resize to 320×320 JPEG, upload to avatars/{uid}/…, point the profile at it, delete the old one. */
export async function uploadAvatar(profile: Profile, localUri: string): Promise<Profile> {
  const image = await ImageManipulator.manipulate(localUri)
    .resize({ width: 320, height: 320 })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

  const path = await uploadFile(BUCKETS.avatars, storagePaths.avatar(profile.id), saved.uri, {
    contentType: 'image/jpeg',
  });
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', profile.id)
    .select('*')
    .single();
  if (error) {
    await removeFiles(BUCKETS.avatars, [path]).catch(() => {});
    throw error;
  }
  if (profile.avatar_path && profile.avatar_path !== path) {
    await removeFiles(BUCKETS.avatars, [profile.avatar_path]).catch(() => {});
  }
  return data;
}

/** "Remove current picture": clear the profile's avatar, then delete the file. */
export async function removeAvatar(profile: Profile): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('id', profile.id);
  if (error) throw error;
  if (profile.avatar_path) {
    await removeFiles(BUCKETS.avatars, [profile.avatar_path]).catch(() => {});
  }
}
