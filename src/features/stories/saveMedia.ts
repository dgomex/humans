import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** Download a story's photo / video and save it to the photo library (write-only access). */
export async function saveStoryMedia(
  url: string,
  ext: 'jpg' | 'mp4',
): Promise<'saved' | 'denied' | 'unsupported'> {
  const { status } = await requestPermissionsAsync(true, ['photo', 'video']);
  if (status !== 'granted') return 'denied';
  const target = new File(Paths.cache, `story-${Crypto.randomUUID()}.${ext}`);
  const file = await File.downloadFileAsync(url, target);
  await Asset.create(file.uri);
  file.delete();
  return 'saved';
}

/** Capture the story canvas (with its text and stickers) and save it as a photo. */
export async function saveStoryView(
  view: RefObject<View | null>,
): Promise<'saved' | 'denied' | 'unsupported'> {
  const { status } = await requestPermissionsAsync(true, ['photo']);
  if (status !== 'granted') return 'denied';
  const uri = await captureRef(view, { format: 'jpg', quality: 0.95 });
  await Asset.create(uri);
  return 'saved';
}
