import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { queryClient } from '@/lib/queryClient';
import { forgetLocalSession, supabase } from '@/lib/supabase';

import { AuthFlowError, fetchProfile, type Profile } from './api';
import {
  MAX_LOGGED_IN_ACCOUNTS,
  loadSavedAccounts,
  removeSavedAccount,
  upsertSavedAccount,
  type SavedAccount,
} from './savedAccounts';

/**
 * Which part of the app is reachable (root layout guards route groups with it):
 * - loading     splash stays up (page 001)
 * - signedOut   Welcome / Log in / Sign up / Forgot password
 * - onboarding  session without a finished account, or the post-"I agree" steps (photo, people)
 * - recovery    signed in by a recovery code → must set a new password (page 013)
 * - savePrompt  "Save your login info?" after logging in
 * - signedIn    the app
 */
export type AuthGate =
  'loading' | 'signedOut' | 'onboarding' | 'recovery' | 'savePrompt' | 'signedIn';

type AuthContextValue = {
  gate: AuthGate;
  session: Session | null;
  profile: Profile | null;
  accounts: SavedAccount[];
  /** Set while "Add account" parked another logged-in account (cancel returns to it). */
  addingAccountFrom: string | null;
  /** What "Add account" should open: the Log in form or Sign up. */
  addingAccountIntent: 'login' | 'signup' | null;
  clearAddingAccountIntent: () => void;
  signInWithSession: (session: Session) => Promise<void>;
  beginRecovery: (session: Session) => Promise<void>;
  finishRecovery: () => void;
  setSignupSaveChoice: (save: boolean) => void;
  completeSignupLocally: (profile: Profile) => void;
  finishOnboarding: () => void;
  answerSavePrompt: (save: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  startAddAccount: (intent: 'login' | 'signup') => Promise<void>;
  cancelAddAccount: () => Promise<void>;
  removeAccount: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [recovery, setRecovery] = useState(false);
  const [pendingWelcome, setPendingWelcome] = useState(false);
  const [pendingSavePrompt, setPendingSavePrompt] = useState(false);
  const [addingAccountFrom, setAddingAccountFrom] = useState<string | null>(null);
  const [addingAccountIntent, setAddingAccountIntent] = useState<'login' | 'signup' | null>(null);
  const signupSaveChoice = useRef<boolean | null>(null);
  const currentUserId = useRef<string | null>(null);

  /** Record the current account in the device list once it has a finished profile. */
  const rememberAccount = useCallback(
    async (s: Session, p: Profile, extra?: Partial<SavedAccount>) => {
      setAccounts(
        await upsertSavedAccount({
          userId: p.id,
          username: p.username,
          fullName: p.full_name,
          avatarPath: p.avatar_path,
          refreshToken: s.refresh_token,
          loggedIn: true,
          lastUsedAt: Date.now(),
          ...extra,
        }),
      );
    },
    [],
  );

  const loadProfileFor = useCallback(
    async (s: Session) => {
      const userId = s.user.id;
      let p: Profile | null = null;
      try {
        p = await fetchProfile(userId);
      } catch {
        // Offline: keep the previous profile if it belongs to the same user.
        p = currentUserId.current === userId ? profile : null;
      }
      if (currentUserId.current !== userId) return; // switched meanwhile
      setProfile(p);
      setProfileFor(userId);
      if (p) {
        const choice = signupSaveChoice.current;
        signupSaveChoice.current = null;
        await rememberAccount(s, p, choice === null ? undefined : { saveLogin: choice });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rememberAccount],
  );

  const applySession = useCallback(
    (s: Session | null) => {
      setSession(s);
      const nextId = s?.user.id ?? null;
      if (nextId !== currentUserId.current) {
        currentUserId.current = nextId;
        queryClient.clear();
        setProfile(null);
        setProfileFor(null);
        if (s) void loadProfileFor(s);
      } else if (s) {
        // Same user, new tokens: keep the saved refresh token current.
        void (async () => {
          const list = await loadSavedAccounts();
          if (list.some((a) => a.userId === s.user.id)) {
            setAccounts(
              await upsertSavedAccount({ userId: s.user.id, refreshToken: s.refresh_token }),
            );
          }
        })();
      }
    },
    [loadProfileFor],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setAccounts(await loadSavedAccounts());
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      applySession(data.session);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      // Never await supabase calls inside this callback (auth lock); defer instead. Re-read the
      // session rather than trusting the event payload: a late SIGNED_OUT from logging out one
      // account must not clobber the account we just switched to.
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (mounted) applySession(data.session);
      }, 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  // ---- actions --------------------------------------------------------------------------------

  const signInWithSession = useCallback(async (s: Session) => {
    const saved = (await loadSavedAccounts()).find((a) => a.userId === s.user.id);
    setPendingSavePrompt(!saved?.saveLogin);
    setAddingAccountFrom(null);
    const { error } = await supabase.auth.setSession(s);
    if (error) throw new AuthFlowError('unknown', error.message);
  }, []);

  const beginRecovery = useCallback(async (s: Session) => {
    setRecovery(true);
    const { error } = await supabase.auth.setSession(s);
    if (error) {
      setRecovery(false);
      throw new AuthFlowError('unknown', error.message);
    }
  }, []);

  const finishRecovery = useCallback(() => {
    setRecovery(false);
    setAddingAccountFrom(null);
  }, []);

  const setSignupSaveChoice = useCallback((save: boolean) => {
    signupSaveChoice.current = save;
  }, []);

  const completeSignupLocally = useCallback(
    (p: Profile) => {
      setPendingWelcome(true);
      setAddingAccountFrom(null);
      setProfile(p);
      setProfileFor(p.id);
      const s = session;
      if (s) {
        const choice = signupSaveChoice.current;
        signupSaveChoice.current = null;
        void rememberAccount(s, p, choice === null ? undefined : { saveLogin: choice });
      }
    },
    [rememberAccount, session],
  );

  const finishOnboarding = useCallback(() => setPendingWelcome(false), []);

  const answerSavePrompt = useCallback(
    async (save: boolean) => {
      if (session)
        setAccounts(await upsertSavedAccount({ userId: session.user.id, saveLogin: save }));
      setPendingSavePrompt(false);
    },
    [session],
  );

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
    if (p) await rememberAccount(session, p);
  }, [rememberAccount, session]);

  /** Save the active session's latest refresh token, then drop it locally (not revoked). */
  const parkCurrentSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const cur = data.session;
    if (cur) {
      const list = await loadSavedAccounts();
      if (list.some((a) => a.userId === cur.user.id)) {
        await upsertSavedAccount({
          userId: cur.user.id,
          refreshToken: cur.refresh_token,
          loggedIn: true,
        });
      }
    }
    await forgetLocalSession();
    return cur;
  }, []);

  const resumeWithToken = useCallback(async (refreshToken: string) => {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session)
      throw new AuthFlowError('session_expired', 'Your session expired. Please log in again.');
    return data.session;
  }, []);

  const switchAccount = useCallback(
    async (userId: string) => {
      const target = (await loadSavedAccounts()).find((a) => a.userId === userId);
      if (!target?.refreshToken) {
        throw new AuthFlowError('session_expired', 'Your session expired. Please log in again.');
      }
      const previous = await parkCurrentSession();
      try {
        const s = await resumeWithToken(target.refreshToken);
        setAddingAccountFrom(null);
        setPendingSavePrompt(false);
        setAccounts(
          await upsertSavedAccount({
            userId,
            refreshToken: s.refresh_token,
            loggedIn: true,
            lastUsedAt: Date.now(),
          }),
        );
        applySession(s);
      } catch (e) {
        setAccounts(await upsertSavedAccount({ userId, refreshToken: null, loggedIn: false }));
        if (previous) {
          // Put the previous account back.
          const back = await resumeWithToken(previous.refresh_token).catch(() => null);
          applySession(back);
        } else {
          applySession(null);
        }
        throw e;
      }
    },
    [applySession, parkCurrentSession, resumeWithToken],
  );

  const startAddAccount = useCallback(
    async (intent: 'login' | 'signup') => {
      const list = await loadSavedAccounts();
      if (list.filter((a) => a.loggedIn).length >= MAX_LOGGED_IN_ACCOUNTS) {
        throw new AuthFlowError(
          'max_accounts',
          `You can add up to ${MAX_LOGGED_IN_ACCOUNTS} accounts.`,
        );
      }
      const cur = await parkCurrentSession();
      setAddingAccountFrom(cur?.user.id ?? null);
      setAddingAccountIntent(intent);
      applySession(null);
    },
    [applySession, parkCurrentSession],
  );

  const clearAddingAccountIntent = useCallback(() => setAddingAccountIntent(null), []);

  const cancelAddAccount = useCallback(async () => {
    const from = addingAccountFrom;
    setAddingAccountFrom(null);
    setAddingAccountIntent(null);
    if (from) await switchAccount(from);
  }, [addingAccountFrom, switchAccount]);

  const removeAccount = useCallback(async (userId: string) => {
    setAccounts(await removeSavedAccount(userId));
  }, []);

  const logout = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const cur = data.session;
    if (!cur) return;
    const list = await loadSavedAccounts();
    const entry = list.find((a) => a.userId === cur.user.id);
    if (entry?.saveLogin) {
      // Keep the session alive for one-tap login from the Welcome screen.
      await upsertSavedAccount({
        userId: cur.user.id,
        refreshToken: cur.refresh_token,
        loggedIn: false,
      });
      await forgetLocalSession();
    } else {
      await removeSavedAccount(cur.user.id);
      await supabase.auth.signOut({ scope: 'local' });
    }
    setPendingWelcome(false);
    setPendingSavePrompt(false);
    setRecovery(false);
    const next = (await loadSavedAccounts()).find(
      (a) => a.loggedIn && a.refreshToken && a.userId !== cur.user.id,
    );
    setAccounts(await loadSavedAccounts());
    if (next) {
      try {
        await switchAccount(next.userId);
        return;
      } catch {
        // fall through to signed out
      }
    }
    applySession(null);
  }, [applySession, switchAccount]);

  // ---- gate ---------------------------------------------------------------------------------

  let gate: AuthGate;
  if (!ready) gate = 'loading';
  else if (!session) gate = 'signedOut';
  else if (profileFor !== session.user.id) gate = 'loading';
  else if (recovery) gate = 'recovery';
  else if (!profile || pendingWelcome) gate = 'onboarding';
  else if (pendingSavePrompt) gate = 'savePrompt';
  else gate = 'signedIn';

  const value = useMemo<AuthContextValue>(
    () => ({
      gate,
      session,
      profile,
      accounts,
      addingAccountFrom,
      addingAccountIntent,
      clearAddingAccountIntent,
      signInWithSession,
      beginRecovery,
      finishRecovery,
      setSignupSaveChoice,
      completeSignupLocally,
      finishOnboarding,
      answerSavePrompt,
      refreshProfile,
      switchAccount,
      startAddAccount,
      cancelAddAccount,
      removeAccount,
      logout,
    }),
    [
      gate,
      session,
      profile,
      accounts,
      addingAccountFrom,
      addingAccountIntent,
      clearAddingAccountIntent,
      signInWithSession,
      beginRecovery,
      finishRecovery,
      setSignupSaveChoice,
      completeSignupLocally,
      finishOnboarding,
      answerSavePrompt,
      refreshProfile,
      switchAccount,
      startAddAccount,
      cancelAddAccount,
      removeAccount,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
