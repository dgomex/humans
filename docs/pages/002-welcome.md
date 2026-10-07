# Page 002 — Welcome / Landing (saved profiles)

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/index.tsx`
- **Depends on:** saved-accounts store (device), page 3 Log in, page 4 Sign up

## 1. Research (current Instagram behavior)
### Layout
Current Instagram has no separate marketing landing page. With no saved profiles the app opens straight to the Log in form (page 3). With saved profiles it shows:
- Top: language selector ("English (US)" ▾) and a ⚙ settings icon at the top right, used to manage saved profiles.
- Center: the Instagram glyph, then the saved profile (large avatar, username) and a blue "Log in" pill button. With several saved profiles they appear as a list of rows (avatar, username, ⋯).
- Below: an outlined "Use another profile" / "Log into another account" button.
- Bottom: an outlined "Create new account" button and the ∞ Meta wordmark.
- Background: a soft light gradient (light mode) or near-black (dark mode).

### Entry & exit points
- From the splash when the device has saved profiles; from logout; from "I already have an account" in sign-up.
- A profile row or "Log in" opens a one-tap login using the stored session; if it expired, Log in opens with the username pre-filled.
- "Use another profile" goes to Log in (page 3); "Create new account" goes to Sign up (page 4).
- ⚙ → saved profile → "Remove profile" removes it from this device.

### Features & interactions
- [ ] One-tap login for saved profiles; a spinner sits in the button while logging in.
- [ ] Remove a saved profile from the device (confirmation dialog).
- [ ] Language selector (full-screen list).
- [ ] Profiles from other Meta apps / Google accounts appear here on Android (Meta-only feature).

### States
- Loading: button spinner during one-tap login.
- Empty: no saved profiles, so the Log in form shows instead.
- Error / offline: toast "Couldn't log in. Check your connection." An expired session falls back to the password form.
- Edge cases: an account that is disabled or deleted is removed from the list with a message. A 2FA account that isn't trusted on this device goes to page 14.

### Sources
- [I Can't Log In – Instagram Help](https://help.instagram.com/374546259294234) (saved accounts on the login screen, remove profile).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Drop profiles from other Meta apps / Google accounts; only accounts saved on this device appear.
- **Date:** 2026-10-07

## 3. Data & storage
- Device only: saved profiles list `{userId, username, avatarUrl, refreshToken}` in SecureStore (shared with page 15).

## 4. Implementation notes
- `src/features/auth/savedAccounts.ts` (SecureStore), `AuthProvider` routing.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (n/a)
- [ ] Supabase advisors clean (n/a)
