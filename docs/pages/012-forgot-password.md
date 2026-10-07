# Page 012 — Forgot password / account recovery

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/recover/index.tsx`, `app/(auth)/recover/code.tsx`
- **Depends on:** page 3; Supabase Auth recovery

## 1. Research (current Instagram behavior)
### Layout
- **Find your account:** back arrow; title "Find your account"; text "Enter your username, email or mobile number."; one field; a blue "Continue"; and a link "Can't reset your password?"
- **Choose method** (when the account has several contacts): "We'll send a code to:" with radio rows "Send code via email (a•••@g•••.com)" / "Send code via SMS (+•• ••• ••12)", then "Continue". Masked values only.
- **Enter code:** title "Enter the confirmation code", text "Enter the 6-digit code we sent to {masked}", a code field, "Continue", "Didn't get a code?" (resend), plus an alternative login link sent in the same email ("Log in as {user}").

### Entry & exit points
- From Log in ("Forgot password?") and the wrong-password dialog. A valid code goes to Reset password (page 13).
- "Can't reset your password?" opens the help/hacked flow (out of scope beyond a help link).

### Features & interactions
- [ ] Lookup by username, email, or phone.
- [ ] Masked contact display; method choice.
- [ ] 6-digit code plus resend cooldown.
- [ ] Unknown account: "We couldn't find your account" (as Instagram).

### States
- Loading: button spinners.
- Error: invalid or expired code; rate limit ("Please wait a few minutes").
- Edge cases: the user has lost access to the email/phone, so a help link is shown.

### Sources
- [I Can't Log In → Reset my password – Instagram Help](https://help.instagram.com/372313326184656), [Recover your Instagram password](https://help.instagram.com/409847499070242/), [Didn't receive the reset email](https://help.instagram.com/407128569340564).

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Recovery by username or email only (no SMS method). Unknown account → show Instagram's "We couldn't find your account" (user accepted that this reveals which accounts exist; decided 2026-10-07).
- **Date:** 2026-10-05

## 3. Data & storage
- `resolve_login_identifier` (page 3) gives the email/phone for a username.
- Supabase: `signInWithOtp({ email, shouldCreateUser: false })` (6-digit code), then `verifyOtp` gives a session, then page 13 sets the new password. Phone uses SMS OTP the same way.

## 4. Implementation notes
- Reuses `CodeInput`, `SignupStep` layout.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
