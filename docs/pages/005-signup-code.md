# Page 005 — Sign up: confirmation code

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/code.tsx`
- **Depends on:** page 4

## 1. Research (current Instagram behavior)
### Layout
- Title "Enter the confirmation code". Text: "To confirm your account, enter the 6-digit code we sent to {contact}."
- One field, "Confirmation code" (numeric keypad, one-time-code autofill).
- A blue "Next" button and an outlined "I didn't get the code" button.

### Entry & exit points
- From page 4. A valid code goes to the password step (page 6). Back returns to page 4 with the value kept.
- "I didn't get the code" opens a bottom sheet: "Resend confirmation code", "Change mobile number"/"Change email", and "Cancel".

### Features & interactions
- [ ] SMS/email code autofill (iOS `oneTimeCode`, Android SMS Retriever `autoComplete="sms-otp"`).
- [ ] Auto-submit when the 6th digit is entered.
- [ ] Resend with a cooldown; toast "Code sent".
- [ ] Code expiry (about 10 min).

### States
- Loading: spinner in Next.
- Error: "This code isn't valid. You can request a new one." Expired: "This code has expired".
- Edge cases: too many attempts leads to a wait; the app being backgrounded to read the email keeps its state.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Email code only (no SMS autofill path).
- **Date:** 2026-10-05

## 3. Data & storage
- `supabase.auth.verifyOtp({ email|phone, token, type: 'email'|'sms' })` returns a session. The user is authenticated but has no `profiles` row yet, so onboarding continues.
- `config.toml`: `[auth.email] otp_length = 6`, `otp_expiry = 600`; the email template shows `{{ .Token }}`.

## 4. Implementation notes
- `CodeInput` (single field, numeric, `textContentType="oneTimeCode"`), and the `BottomSheet` from Phase 0.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
