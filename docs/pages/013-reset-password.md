# Page 013 — Reset password

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/recover/new-password.tsx`
- **Depends on:** page 12 (recovery session)

## 1. Research (current Instagram behavior)
### Layout
- Title "Create a new password". Text: "Create a password with at least 6 letters and numbers. You'll need this password to log into your account."
- Fields "New password" and "Retype new password" (both with show/hide).
- A checkbox "Log out of other devices" (checked by default; it also helps if the account was hacked).
- A blue "Continue"/"Reset password" button.

### Entry & exit points
- From page 12 (verified code). Success logs the user in and goes to Home, with the toast "Password changed".

### Features & interactions
- [ ] Mismatch error: "Please make sure both passwords match."
- [ ] Weak or reused password rejected.
- [ ] Optional sign-out of all other sessions.

### States
- Loading: spinner.
- Error: as above; an expired recovery session sends the user back to page 12.

### Sources
- [Recover your Instagram password](https://help.instagram.com/409847499070242/), [Secure your account](https://help.instagram.com/369001149843369).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced.
- **Date:** 2026-10-07

## 3. Data & storage
- `supabase.auth.updateUser({ password })`; "Log out of other devices" calls `supabase.auth.signOut({ scope: 'others' })`.

## 4. Implementation notes
- Reuses `AuthTextField`, `SignupStep`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
