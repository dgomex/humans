# Page 006 — Sign up: password & full name

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/password.tsx`, `app/(auth)/signup/name.tsx`
- **Depends on:** page 5 (authenticated session)

## 1. Research (current Instagram behavior)
Instagram splits these into **two screens** in this order: password (after the code), then birthday (page 7), then name.

### Layout
- **Password:** title "Create a password". Text: "Create a password with at least 6 letters or numbers. It should be something others can't guess." A password field with a show/hide eye, and "Next".
- After the password: "Save your login info?" ("We'll save the login info for {name}, so you won't need to enter it next time you log in."), with "Save" or "Not now".
- **Name:** title "What's your name?", a "Full name" field, and "Next". The name may be left empty on some builds; the profile can be edited later.

### Entry & exit points
- Code (page 5) → password → birthday (page 7) → name → username (page 8). Back keeps the values.

### Features & interactions
- [ ] Password rules: at least 6 characters; weak or common passwords are rejected ("This password is too easy to guess. Please create a new one.").
- [ ] Show/hide toggle; the password manager offers a strong password (iOS `newPassword`).
- [ ] Full name: up to 64 characters, used for search and the profile header.

### States
- Loading: spinner in Next while the password is saved.
- Error: inline red text for a weak password.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753), [Secure your account – strong passwords](https://help.instagram.com/369001149843369)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (separate password and name steps).
- **Date:** 2026-10-07

## 3. Data & storage
- Password: `supabase.auth.updateUser({ password })` (Auth `minimum_password_length = 6`, plus leaked-password protection on hosted).
- Name: kept in the sign-up flow state; written to `profiles.full_name` when the account is completed (page 9).

## 4. Implementation notes
- Reuses `SignupStep`, `AuthTextField`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
