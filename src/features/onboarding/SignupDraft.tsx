import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** Values collected across the onboarding steps until "I agree" creates the account. */
export type SignupDraft = {
  fullName: string;
  /** YYYY-MM-DD */
  birthday: string | null;
  username: string;
};

type Ctx = SignupDraft & { update: (patch: Partial<SignupDraft>) => void };

const DraftContext = createContext<Ctx | null>(null);

export function SignupDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>({ fullName: '', birthday: null, username: '' });
  const value = useMemo<Ctx>(
    () => ({ ...draft, update: (patch) => setDraft((d) => ({ ...d, ...patch })) }),
    [draft],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useSignupDraft(): Ctx {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useSignupDraft must be used inside <SignupDraftProvider>');
  return ctx;
}

/** Whole years between a YYYY-MM-DD date and today. */
export function ageFrom(isoDate: string, today = new Date()): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function toIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
