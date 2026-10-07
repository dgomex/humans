# Page 009 — Sign up: terms & policies

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/terms.tsx`
- **Depends on:** pages 4–8; `profiles`, `account_private`

## 1. Research (current Instagram behavior)
### Layout
- Title "Agree to Instagram's terms and policies".
- Paragraphs: "People who use our service may have uploaded your contact information to Instagram. Learn more"; "By tapping I agree, you agree to create an account and to Instagram's Terms, Privacy Policy and Cookies Policy."; "The Privacy Policy describes the ways we can use the information we collect when you create an account…". The links are blue and open in an in-app browser.
- A blue "I agree" button.

### Entry & exit points
- Username → **"I agree" creates the account** → add profile photo (page 10).

### Features & interactions
- [ ] Links to Terms, Privacy Policy, and Cookies Policy (in-app browser).
- [ ] "I agree" creates the account atomically (profile + private data + terms timestamp).

### States
- Loading: spinner on "I agree".
- Error: the username was taken meanwhile, so it returns to page 8 with a message; network-error toast.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753) ("Read Instagram's terms and policies, then tap I agree… to create your account").

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced.
- **Date:** 2026-10-07

## 3. Data & storage
- RPC `complete_signup(username, full_name, birthday)` (security invoker, owner = `auth.uid()`). It inserts `profiles` and `account_private (birthday, terms_accepted_at)` in one transaction.
- Placeholder legal pages (our own Terms/Privacy URLs, configurable).

## 4. Implementation notes
- `expo-web-browser` for the policy links.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (B can't complete or modify A's profile)
- [ ] Supabase advisors clean
