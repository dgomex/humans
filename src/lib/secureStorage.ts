import * as SecureStore from 'expo-secure-store';

/**
 * supabase-js storage adapter backed by the iOS Keychain / Android Keystore.
 * SecureStore values are limited (~2 KB on some platforms) and a session JSON can exceed that,
 * so values are split into chunks: `<key>.n` holds the chunk count, `<key>.0..n-1` the parts.
 */
const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function removeChunks(key: string) {
  const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
  await Promise.all(
    Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
  );
  await SecureStore.deleteItemAsync(countKey(key));
}

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const raw = await SecureStore.getItemAsync(countKey(key));
    if (raw == null) return null;
    const parts = await Promise.all(
      Array.from({ length: Number(raw) }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    if (parts.some((p) => p == null)) return null;
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    if (chunks.length === 0) chunks.push('');
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(key, i), c)));
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    await removeChunks(key);
  },
};
