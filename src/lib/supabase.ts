import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

import { chunkedSecureStorage } from './secureStorage';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!envUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. Copy .env.example to .env.local.',
  );
}

/**
 * In development on a device/emulator, `127.0.0.1` is the phone itself. Point a local Supabase
 * URL at the machine running the Expo dev server instead (its host from `hostUri`), so Expo Go
 * on a real phone and the Android emulator both reach the local stack.
 */
function resolveSupabaseUrl(url: string): string {
  if (Platform.OS === 'web' || !/\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return url;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  // Only a LAN IP works (a `--tunnel` host only forwards Metro, not Supabase's port).
  if (devHost && /^\d{1,3}(\.\d{1,3}){3}$/.test(devHost) && devHost !== '127.0.0.1') {
    return url.replace(/\/\/(127\.0\.0\.1|localhost)/, `//${devHost}`);
  }
  // Android emulator without a dev-server host: the host machine is 10.0.2.2.
  return Platform.OS === 'android'
    ? url.replace(/\/\/(127\.0\.0\.1|localhost)/, '//10.0.2.2')
    : url;
}

const supabaseUrl = resolveSupabaseUrl(envUrl);

export const supabaseConfig = { url: supabaseUrl, key: supabaseKey };

/** Where supabase-js keeps the active session (see `forgetLocalSession`). */
export const SESSION_STORAGE_KEY = 'humans-auth';

const webStorage = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
};

/** Session storage: Keychain/Keystore on native, localStorage on web. */
export const sessionStorage = Platform.OS === 'web' ? webStorage : chunkedSecureStorage;

/**
 * The one Supabase client for the app. Uses the publishable key only — never put a
 * service-role/secret key in the app.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: sessionStorage,
    storageKey: SESSION_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Drop the active session on this device WITHOUT revoking it on the server, so a saved login
 * (Welcome screen one-tap login, account switcher) can resume it later with its refresh token.
 * supabase-js reads the session from storage on every access, so removing it is enough; the
 * caller (AuthProvider) updates app state itself because no auth event fires.
 */
export async function forgetLocalSession(): Promise<void> {
  await sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
