import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

/** Save a kept chat photo / video to the photo library (write-only access). */
export async function saveChatMedia(
  url: string,
  type: 'image' | 'video',
): Promise<'saved' | 'denied' | 'unsupported'> {
  const { status } = await requestPermissionsAsync(true, ['photo', 'video']);
  if (status !== 'granted') return 'denied';
  const target = new File(
    Paths.cache,
    `dm-${Crypto.randomUUID()}.${type === 'video' ? 'mp4' : 'jpg'}`,
  );
  const file = await File.downloadFileAsync(url, target);
  await Asset.create(file.uri);
  file.delete();
  return 'saved';
}
