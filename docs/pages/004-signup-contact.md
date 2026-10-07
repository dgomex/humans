# Page 004 — Sign up: mobile number or email

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/contact.tsx`
- **Depends on:** Supabase Auth OTP (email; SMS provider for phone)

## 1. Research (current Instagram behavior)
### Layout (same for every sign-up step)
- Top-left back arrow; a large bold title; a gray explanation paragraph; one outlined field; a blue full-width pill "Next"; a secondary outlined button; and "I already have an account" pinned at the bottom.
- Phone variant: title "What's your mobile number?", text "Enter the mobile number where you can be contacted. No one will see this on your profile.", field "Mobile number" with a country code taken from the device locale, secondary button "Sign up with email".
- Email variant: title "What's your email?", text "Enter the email where you can be contacted. No one will see this on your profile.", field "Email", secondary button "Sign up with mobile number".
- Small print: "You may receive SMS notifications from us for security and login purposes."

### Entry & exit points
- From Log in or Welcome via "Create new account". "Next" goes to the confirmation code (page 5). Back goes to Log in. "I already have an account" goes to Log in.
- If the contact belongs to an existing account, the dialog "Are you trying to log in?" offers "Log in" or "Create new account".

### Features & interactions
- [ ] Toggle between phone and email.
- [ ] Inline validation (format); Next is disabled until the value is valid.
- [ ] Phone formatting with a country code picker.
- [ ] Existing-account detection dialog.
- [ ] Note: as of 2026, Instagram increasingly requires a phone number for new accounts.

### States
- Loading: spinner in Next while the code is sent.
- Error: inline red text ("Enter a valid email address."); the rate limit gives "Please wait a few minutes before you try again."
- Edge cases: an email already in use, disposable email domains, a back press keeping the entered value.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753)
- [Instagram verification requirements 2026 (smscode.gg)](https://smscode.gg/blog/instagram-verification-requirements-2026), [How to create an Instagram account (technobezz)](https://www.technobezz.com/how-to-create-an-instagram-account)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Email only: drop the mobile-number path and the "Sign up with mobile number" toggle (no SMS provider). Phone may be added later.
- **Date:** 2026-10-05

## 3. Data & storage
- Supabase `signInWithOtp({ email | phone, options: { shouldCreateUser: true } })`, which creates an `auth.users` row with no profile yet.
- Email OTP template switched to a 6-digit `{{ .Token }}` code. Phone needs an SMS provider (Twilio and others) on hosted; locally, `[auth.sms.test_otp]`.

## 4. Implementation notes
- `src/features/auth/signup/` holds a flow store (zustand-free: React context + reducer) that carries values across steps.
- Shared `SignupStep` layout component.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
