import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** Capture the QR view and save it to the photo library (write-only access). */
export async function saveQrImage(view: RefObject<View | null>): Promise<'saved' | 'denied'> {
  const { status } = await requestPermissionsAsync(true, ['photo']);
  if (status !== 'granted') return 'denied';
  const uri = await captureRef(view, { format: 'png', quality: 1 });
  await Asset.create(uri);
  return 'saved';
}
