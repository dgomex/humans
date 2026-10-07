# Page 014 — Two-factor authentication code entry

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Deferred (Phase 11)
- **Route:** `app/(auth)/two-factor.tsx`
- **Depends on:** page 3; 2FA **enrollment** lives in Settings → Password and security (Phase 11), so a minimal dev enrollment is needed to test

## 1. Research (current Instagram behavior)
### Layout
- **Authentication app:** title "Go to your authentication app". Text: "Enter the 6-digit code for this account from the two-factor authentication app you set up (such as Duo Mobile or Google Authenticator)." A "Code" field, a checkbox "Trust this device" (with the note "We won't ask for a code next time"), a blue "Continue", and an outlined "Try another way".
- **SMS:** "Check your text messages", "Enter the code we sent to ••••12", plus "Resend code".
- **Try another way** opens a sheet listing the methods available on the account: authentication app, text message, WhatsApp, backup code, "Approve from another device".
- **Backup code:** "Enter one of your 8-digit backup codes".

### Entry & exit points
- After a correct password on page 3 when 2FA is on and the device isn't trusted. Success goes to Home. Back cancels the login.

### Features & interactions
- [ ] TOTP code verification; auto-submit at 6 digits.
- [ ] Trust this device (skip 2FA on future logins from it).
- [ ] Alternative methods: SMS code, backup codes (single-use), approve from a logged-in device.

### States
- Loading: spinner.
- Error: "Please check the security code and try again."; too many attempts leads to a wait.
- Edge cases: lost device, so backup code or recovery is needed.

### Sources
- [Securing your Meta Account with two-factor authentication](https://help.instagram.com/566810106808145), [Use an authentication app](https://help.instagram.com/1582474155197965), [Backup codes](https://help.instagram.com/1006568999411025).

## 2. User decision
- **Choice:** Deferred
- **Changes requested:** Skip 2FA for now; revisit together with Settings → Password and security in Phase 11. Login does not branch to a 2FA screen yet.
- **Date:** 2026-10-05

## 3. Data & storage
- Supabase Auth MFA (TOTP): after the password, if `mfa.getAuthenticatorAssuranceLevel()` reports `nextLevel = aal2`, then `mfa.challenge` + `mfa.verify`. RLS can require `aal2` where needed.
- Backup codes: `mfa_backup_codes (user_id, code_hash, used_at)` plus an Edge Function to redeem one (it unenrolls or re-challenges). SMS MFA needs a paid SMS provider.
- Trusted devices: a device token in SecureStore plus `trusted_devices (user_id, token_hash, created_at)`; skips the challenge by policy.

## 4. Implementation notes
- Reuses `CodeInput`; a minimal dev-only "Enable 2FA" screen (QR via `react-native-qrcode-svg`) until Phase 11.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
