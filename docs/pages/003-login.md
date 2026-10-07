# Page 003 — Log in

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/login.tsx`
- **Depends on:** Supabase Auth; `profiles` (username → login identifier lookup)

## 1. Research (current Instagram behavior)
### Layout
- Top: language selector. Center: the Instagram glyph.
- Field "Username, email or mobile number" and field "Password" with a show/hide eye. The fields are rounded and outlined, and the label floats up when focused.
- A blue pill "Log in" button, disabled (faded) until both fields are filled.
- A "Forgot password?" text link under the button.
- Bottom: an outlined "Create new account" button and the ∞ Meta wordmark.
- Android adds "Log in with Facebook" in some regions. iOS also offers password autofill and the Keychain.

### Entry & exit points
- From the splash (no saved profiles), Welcome ("Use another profile"), and sign-up ("I already have an account").
- Success goes to Home, or to the 2FA code screen (page 14), or to unfinished onboarding.
- "Forgot password?" goes to page 12; "Create new account" goes to page 4.
- After a successful login: a "Save your login info?" prompt (Save / Not now).

### Features & interactions
- [ ] Log in with a username, email, or phone plus a password.
- [ ] Show/hide password; the keyboard "Go" key submits.
- [ ] Wrong password dialog: "Incorrect password", with "Try again" or "Forgot password?".
- [ ] Unknown account dialog: "Can't find account", with "Create new account" or "Try again".
- [ ] Throttling: "Please wait a few minutes before you try again."
- [ ] Save login info prompt, which adds the profile to the saved profiles.
- [ ] Password-manager autofill (iOS `textContentType`, Android `autoComplete`).

### States
- Loading: a spinner replaces the button label, and the inputs are disabled.
- Error / offline: the dialogs above, and a network-error toast.
- Edge cases: a 2FA-enabled account goes to page 14. An account whose sign-up is unfinished goes to the missing step. A disabled account gets a dialog.

### Sources
- [I Can't Log In – Instagram Help](https://help.instagram.com/374546259294234), [Secure your account](https://help.instagram.com/369001149843369).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Drop "Log in with Facebook" and the Meta wordmark; login identifier = username or email (no phone).
- **Date:** 2026-10-07

## 3. Data & storage
- `profiles.username` lookup via a security-definer RPC `resolve_login_identifier(identifier)` that returns the email/phone for a username without exposing the profile list (rate-limited by Auth).
- Supabase `signInWithPassword({email|phone, password})`.

## 4. Implementation notes
- Shared `AuthTextField` (floating label, eye toggle, clear), `AuthScreen` layout, `Dialog` (native Alert).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
