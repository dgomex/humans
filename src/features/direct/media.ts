import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  assetToItem,
  pickFromLibrary,
  PickerPermissionError,
  videoContentType,
  videoPoster,
} from '@/features/create/media';
import type { ComposerItem } from '@/features/create/types';

import type { Outgoing, ViewMode } from './api';

/** DM photos are sent up to 1440 px on the long side (Instagram sends ~1440). */
const MAX_SIDE = 1440;
/** DM videos up to 3 minutes. */
export const DM_MAX_VIDEO_MS = 180_000;
export const DM_MAX_ITEMS = 10;

export async function pickChatMedia() {
  return pickFromLibrary(DM_MAX_ITEMS, DM_MAX_VIDEO_MS);
}

/** In-chat camera (📷): one photo or video. */
export async function captureChatMedia(): Promise<ComposerItem | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickerPermissionError('camera');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
    videoMaxDuration: 60,
  });
  if (result.canceled || !result.assets[0]) return null;
  return assetToItem(result.assets[0]);
}

/** Downscale photos, grab a poster for videos, and describe the upload. */
export async function prepareChatMedia(
  item: ComposerItem,
  viewMode: ViewMode = 'keep',
): Promise<Extract<Outgoing, { kind: 'media' }>> {
  if (item.type === 'video') {
    const poster = await videoPoster(item.uri).catch(() => null);
    return {
      kind: 'media',
      uri: item.uri,
      mediaType: 'video',
      width: item.width,
      height: item.height,
      durationMs: item.durationMs ?? 1000,
      posterUri: poster?.uri ?? null,
      mimeType: videoContentType(item),
      viewMode,
    };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(item.width, item.height));
  const image = await ImageManipulator.manipulate(item.uri)
    .resize({ width: Math.round(item.width * scale), height: Math.round(item.height * scale) })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return {
    kind: 'media',
    uri: saved.uri,
    mediaType: 'image',
    width: saved.width,
    height: saved.height,
    mimeType: 'image/jpeg',
    viewMode,
  };
}
