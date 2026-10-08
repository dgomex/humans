import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';

import { MAX_ITEMS, MAX_VIDEO_MS, type ComposerItem, type Crop } from './types';

/** Ratio limits: 3:4 portrait (Instagram's 2025 grid) … 1.91:1 landscape. */
export const MIN_RATIO = 3 / 4;
export const MAX_RATIO = 1.91;
/** Uploaded photos are 1080 px wide (Instagram's feed width). */
export const OUTPUT_WIDTH = 1080;

export const clampRatio = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));

/** The ratio the "original" toggle uses for the first item. */
export function originalRatio(item: Pick<ComposerItem, 'width' | 'height'>) {
  return clampRatio(item.width / item.height);
}

export class PickerPermissionError extends Error {
  constructor(public source: 'camera' | 'library' | 'microphone') {
    super(`${source} permission denied`);
  }
}

export function assetToItem(asset: ImagePicker.ImagePickerAsset): ComposerItem {
  const type = asset.type === 'video' ? 'video' : 'image';
  return {
    key: Crypto.randomUUID(),
    uri: asset.uri,
    type,
    width: asset.width || 1080,
    height: asset.height || 1080,
    durationMs: type === 'video' ? (asset.duration ?? undefined) : undefined,
    mimeType: asset.mimeType ?? undefined,
    crop: null,
    altText: '',
    tags: [],
  };
}

/**
 * Page 32 (decision: OS picker). Ordered multi-select of photos and videos up to `limit`.
 * Returns [] when cancelled; drops videos longer than 60 s (reported via `tooLong`).
 */
export async function pickFromLibrary(limit = MAX_ITEMS) {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new PickerPermissionError('library');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1,
    videoMaxDuration: MAX_VIDEO_MS / 1000,
  });
  if (result.canceled) return { items: [] as ComposerItem[], tooLong: 0 };
  const items = result.assets.map(assetToItem);
  const ok = items.filter((i) => i.type !== 'video' || (i.durationMs ?? 0) <= MAX_VIDEO_MS + 500);
  return { items: ok.slice(0, limit), tooLong: items.length - ok.length };
}

/** Centered crop of a `width × height` source for `ratio` (w/h), as fractions. */
export function centerCrop(width: number, height: number, ratio: number): Crop {
  const source = width / height;
  if (source > ratio) {
    const w = ratio / source;
    return { x: (1 - w) / 2, y: 0, width: w, height: 1 };
  }
  const h = source / ratio;
  return { x: 0, y: (1 - h) / 2, width: 1, height: h };
}

export const cropOf = (item: ComposerItem, ratio: number) =>
  item.crop ?? centerCrop(item.width, item.height, ratio);

/** Bake the crop into a 1080-wide JPEG. Returns the local file and its size. */
export async function renderPhoto(item: ComposerItem, ratio: number) {
  const c = cropOf(item, ratio);
  const rect = {
    originX: Math.round(c.x * item.width),
    originY: Math.round(c.y * item.height),
    width: Math.max(1, Math.round(c.width * item.width)),
    height: Math.max(1, Math.round(c.height * item.height)),
  };
  const width = Math.min(OUTPUT_WIDTH, rect.width);
  const height = Math.round(width / ratio);
  const image = await ImageManipulator.manipulate(item.uri)
    .crop(rect)
    .resize({ width, height })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Poster frame for a video slide (shown on grids before playback). */
export async function videoPoster(uri: string) {
  if (Platform.OS === 'web') return null;
  const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.8 });
  return { uri: thumb.uri, width: thumb.width, height: thumb.height };
}

export function videoContentType(item: ComposerItem) {
  if (item.mimeType?.startsWith('video/')) return item.mimeType;
  return /\.mov($|\?)/i.test(item.uri) ? 'video/quicktime' : 'video/mp4';
}

export function videoExtension(contentType: string) {
  return contentType === 'video/quicktime' ? 'mov' : 'mp4';
}
