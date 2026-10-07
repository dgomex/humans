import { sessionStorage } from '@/lib/supabase';

/**
 * Accounts known to this device (pages 002 Welcome and 015 Account switcher). Stored in the
 * Keychain/Keystore because each entry holds a refresh token.
 *
 * - `loggedIn`: shown in the account switcher; its session is still valid.
 * - `saveLogin`: the user tapped "Save" on "Save your login info?" — after logging out it stays
 *   on the Welcome screen for one-tap login (its refresh token is kept, not revoked).
 */
export type SavedAccount = {
  userId: string;
  username: string;
  fullName: string;
  avatarPath: string | null;
  refreshToken: string | null;
  loggedIn: boolean;
  saveLogin: boolean;
  lastUsedAt: number;
};

export const MAX_LOGGED_IN_ACCOUNTS = 5;

const KEY = 'humans-accounts';

export async function loadSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await sessionStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedAccount[]) : [];
    return list.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
}

async function write(list: SavedAccount[]) {
  await sessionStorage.setItem(KEY, JSON.stringify(list));
}

/** Insert or merge an entry by userId. */
export async function upsertSavedAccount(
  entry: Partial<SavedAccount> & Pick<SavedAccount, 'userId'>,
): Promise<SavedAccount[]> {
  const list = await loadSavedAccounts();
  const existing = list.find((a) => a.userId === entry.userId);
  const merged: SavedAccount = {
    username: '',
    fullName: '',
    avatarPath: null,
    refreshToken: null,
    loggedIn: false,
    saveLogin: false,
    lastUsedAt: Date.now(),
    ...existing,
    ...entry,
  };
  const next = [merged, ...list.filter((a) => a.userId !== entry.userId)];
  await write(next);
  return next.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export async function removeSavedAccount(userId: string): Promise<SavedAccount[]> {
  const next = (await loadSavedAccounts()).filter((a) => a.userId !== userId);
  await write(next);
  return next;
}
