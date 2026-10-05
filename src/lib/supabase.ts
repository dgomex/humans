import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

import { chunkedSecureStorage } from './secureStorage';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// The Android emulator reaches the host machine at 10.0.2.2, not 127.0.0.1.
const supabaseUrl =
  Platform.OS === 'android'
    ? envUrl?.replace(/\/\/(127\.0\.0\.1|localhost)/, '//10.0.2.2')
    : envUrl;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. Copy .env.example to .env.local.',
  );
}

export const supabaseConfig = { url: supabaseUrl, key: supabaseKey };

/**
 * The one Supabase client for the app. Uses the publishable (anon) key only — never put a
 * service-role/secret key in the app. On native, the session lives in the secure keychain.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // On web, supabase-js falls back to localStorage.
    storage: Platform.OS === 'web' ? undefined : chunkedSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
