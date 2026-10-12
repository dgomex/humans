import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { extensionOf, fileExists, keepFile, readJson, removeDir, writeJson } from './localFiles';
import type { ComposerState } from './types';

/**
 * Page 42 — drafts are device-only (decision): one folder per account with a JSON index and a
 * folder per draft holding copies of its media, so a draft survives deleting the photo from the
 * library. Nothing is uploaded until the post is shared.
 */
export type Draft = { id: string; savedAt: string; state: ComposerState };

const root = (userId: string) => ['drafts', userId];
const INDEX = 'index.json';

export const draftKeys = { list: (userId: string) => ['drafts', userId] as const };

export async function listDrafts(userId: string): Promise<Draft[]> {
  const drafts = await readJson<Draft[]>(root(userId), INDEX, []);
  // Hide drafts whose media vanished (e.g. app data partly cleared).
  return drafts.filter(
    (d) =>
      d.state.items.every((i) => fileExists(i.uri)) &&
      (d.state.reel?.voiceovers ?? []).every((v) => fileExists(v.uri)),
  );
}

export async function saveDraft(userId: string, state: ComposerState): Promise<Draft> {
  const id = state.draftId ?? Crypto.randomUUID();
  const folder = [...root(userId), id];
  const items = [];
  for (const [i, item] of state.items.entries()) {
    const name = `${i}-${item.key}.${extensionOf(item.uri, item.type === 'video' ? 'mp4' : 'jpg')}`;
    // Re-saving a draft: its files are already in the folder.
    const uri = item.uri.includes(`/drafts/${userId}/${id}/`)
      ? item.uri
      : await keepFile(item.uri, folder, name);
    items.push({ ...item, uri });
  }
  // Reels also keep their voiceover takes and cover still.
  const inDraft = (uri: string) => uri.includes(`/drafts/${userId}/${id}/`);
  let reel = state.reel ?? null;
  if (reel) {
    const voiceovers = [];
    for (const v of reel.voiceovers) {
      const uri = inDraft(v.uri)
        ? v.uri
        : await keepFile(v.uri, folder, `vo-${v.id}.${extensionOf(v.uri, 'm4a')}`);
      voiceovers.push({ ...v, uri });
    }
    const cover =
      reel.cover && !inDraft(reel.cover.uri)
        ? {
            ...reel.cover,
            uri: await keepFile(
              reel.cover.uri,
              folder,
              `cover-${Crypto.randomUUID()}.${extensionOf(reel.cover.uri, 'jpg')}`,
            ),
          }
        : reel.cover;
    reel = { ...reel, voiceovers, cover };
  }
  const draft: Draft = {
    id,
    savedAt: new Date().toISOString(),
    state: { ...state, items, reel, draftId: id },
  };
  const all = (await readJson<Draft[]>(root(userId), INDEX, [])).filter((d) => d.id !== id);
  writeJson(root(userId), INDEX, [draft, ...all]);
  return draft;
}

export async function deleteDrafts(userId: string, ids: string[]) {
  const all = await readJson<Draft[]>(root(userId), INDEX, []);
  writeJson(
    root(userId),
    INDEX,
    all.filter((d) => !ids.includes(d.id)),
  );
  for (const id of ids) removeDir([...root(userId), id]);
}

export function useDrafts(userId: string | undefined) {
  return useQuery({
    queryKey: draftKeys.list(userId ?? ''),
    enabled: !!userId,
    queryFn: () => listDrafts(userId!),
  });
}

export function useSaveDraft(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (state: ComposerState) => saveDraft(userId!, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.list(userId ?? '') }),
  });
}

export function useDeleteDrafts(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteDrafts(userId!, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.list(userId ?? '') }),
  });
}
