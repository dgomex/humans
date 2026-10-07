import type { Session } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase, supabaseConfig } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Error with a stable `code` the screens map to Instagram's dialogs/messages. */
export class AuthFlowError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const GENERIC = 'Something went wrong. Check your connection and try again.';

function fromAuthError(error: { code?: string; status?: number; message: string }): AuthFlowError {
  if (error.status === 429 || error.code?.startsWith('over_')) {
    return new AuthFlowError('rate_limited', 'Please wait a few minutes before you try again.');
  }
  if (error.code === 'otp_expired') {
    return new AuthFlowError(
      'invalid_code',
      "This code isn't valid or has expired. You can request a new one.",
    );
  }
  if (error.code === 'weak_password') {
    return new AuthFlowError(
      'weak_password',
      'This password is too easy to guess. Please create a new one.',
    );
  }
  if (error.code === 'same_password') {
    return new AuthFlowError(
      'same_password',
      'Your new password must be different from your current one.',
    );
  }
  return new AuthFlowError(error.code ?? 'unknown', error.message || GENERIC);
}

// ---------------------------------------------------------------------------------------------
// account-auth Edge Function (username → account resolution happens server-side)
// ---------------------------------------------------------------------------------------------

type AccountAuthAction =
  | { action: 'lookup'; identifier: string }
  | { action: 'login'; identifier: string; password: string }
  | { action: 'recover-start'; identifier: string }
  | { action: 'recover-verify'; identifier: string; code: string };

const REQUEST_TIMEOUT_MS = 15_000;

async function accountAuth<T>(body: AccountAuthAction): Promise<T> {
  // An unreachable server (wrong network, firewall) would otherwise hang with no feedback.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke<T>('account-auth', {
      body,
      signal: controller.signal,
    });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const payload = await error.context.json().catch(() => null);
        throw new AuthFlowError(payload?.error ?? 'unknown', payload?.message ?? GENERIC);
      }
      if (__DEV__)
        console.warn(`[account-auth] ${body.action} failed (${supabaseConfig.url}):`, error);
      throw new AuthFlowError(
        'network',
        controller.signal.aborted
          ? "Couldn't reach the server. Check your connection and try again."
          : GENERIC,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export function lookupAccount(identifier: string) {
  return accountAuth<{ exists: boolean; hasProfile: boolean; maskedEmail: string | null }>({
    action: 'lookup',
    identifier,
  });
}

/** Page 003 — returns a session; throws `user_not_found` / `invalid_password` / `rate_limited`. */
export async function loginWithPassword(identifier: string, password: string): Promise<Session> {
  const { session } = await accountAuth<{ session: Session }>({
    action: 'login',
    identifier,
    password,
  });
  return session;
}

/** Page 012 — emails a 6-digit code; returns the masked email. Throws `user_not_found`. */
export async function startRecovery(identifier: string): Promise<string> {
  const { maskedEmail } = await accountAuth<{ maskedEmail: string }>({
    action: 'recover-start',
    identifier,
  });
  return maskedEmail;
}

export async function verifyRecoveryCode(identifier: string, code: string): Promise<Session> {
  const { session } = await accountAuth<{ session: Session }>({
    action: 'recover-verify',
    identifier,
    code,
  });
  return session;
}

// ---------------------------------------------------------------------------------------------
// Sign-up (pages 004–009)
// ---------------------------------------------------------------------------------------------

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Page 004. Throws `account_exists` when the email already has a finished account (the screen
 * offers "Log in"). An unfinished sign-up just gets a new code and resumes onboarding.
 */
export async function sendSignupCode(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const found = await lookupAccount(normalized);
  if (found.exists && found.hasProfile) {
    throw new AuthFlowError('account_exists', 'An account already uses this email.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });
  if (error) throw fromAuthError(error);
}

/** Page 005. On success the client holds a session (no profile yet → onboarding). */
export async function verifySignupCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: 'email',
  });
  if (error) throw fromAuthError(error);
}

const COMMON_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  '123123',
  'password',
  'password1',
  'qwerty',
  'qwerty123',
  'abc123',
  'iloveyou',
  'abcdef',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'football',
  'instagram',
  'humans',
]);

/** Instagram rule: at least 6 characters and not trivially guessable. Returns an error or null. */
export function passwordProblem(password: string): string | null {
  if (password.length < 6) return 'Create a password at least 6 characters long.';
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
    return 'This password is too easy to guess. Please create a new one.';
  }
  return null;
}

/** Pages 006 and 013. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw fromAuthError(error);
}

export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw fromAuthError(error);
}

export async function isUsernameAvailable(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { name });
  if (error) throw new AuthFlowError('network', GENERIC);
  return data;
}

export async function suggestUsernames(fullName: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('suggest_usernames', { full_name: fullName });
  if (error) throw new AuthFlowError('network', GENERIC);
  return data ?? [];
}

/** Page 009 — "I agree" creates the account. Throws `username_taken` / `too_young`. */
export async function completeSignup(args: {
  username: string;
  fullName: string;
  birthday: string; // YYYY-MM-DD
}): Promise<Profile> {
  const { data, error } = await supabase.rpc('complete_signup', {
    p_username: args.username,
    p_full_name: args.fullName,
    p_birthday: args.birthday,
  });
  if (error) {
    if (error.message.includes('username_taken')) {
      throw new AuthFlowError('username_taken', `The username ${args.username} is not available.`);
    }
    if (error.message.includes('too_young')) {
      throw new AuthFlowError('too_young', "You can't sign up for Humans.");
    }
    throw new AuthFlowError('unknown', GENERIC);
  }
  return data;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AuthFlowError('network', GENERIC);
  return data;
}
