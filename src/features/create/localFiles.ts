import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * App-private files for drafts and the upload queue (device-only, like Instagram).
 * Web has no app file system: JSON goes to memory and media keep their blob: URIs, so drafts and
 * pending uploads last only for the session there (web is a dev target).
 */
const isWeb = Platform.OS === 'web';
const memory = new Map<string, string>();

function dir(...parts: string[]) {
  const d = new Directory(Paths.document, ...parts);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export async function readJson<T>(parts: string[], name: string, fallback: T): Promise<T> {
  const key = [...parts, name].join('/');
  try {
    if (isWeb) {
      const raw = memory.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
    const f = new File(dir(...parts), name);
    if (!f.exists) return fallback;
    return JSON.parse(await f.text()) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(parts: string[], name: string, value: unknown) {
  const key = [...parts, name].join('/');
  const text = JSON.stringify(value);
  if (isWeb) {
    memory.set(key, text);
    return;
  }
  const f = new File(dir(...parts), name);
  if (!f.exists) f.create({ intermediates: true });
  f.write(text);
}

/** Copy a picker/camera/cache file into an app folder so it survives cache purges. */
export async function keepFile(uri: string, parts: string[], name: string): Promise<string> {
  if (isWeb) return uri;
  const target = new File(dir(...parts), name);
  if (target.exists) target.delete();
  await new File(uri).copy(target);
  return target.uri;
}

export function removeDir(parts: string[]) {
  if (isWeb) {
    const prefix = parts.join('/') + '/';
    for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
    return;
  }
  const d = new Directory(Paths.document, ...parts);
  if (d.exists) d.delete();
}

export function fileExists(uri: string) {
  if (isWeb || !uri.startsWith('file:')) return true;
  return new File(uri).exists;
}

export function extensionOf(uri: string, fallback: string) {
  const m = uri.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return (m?.[1] ?? fallback).toLowerCase();
}
