# Page 015 — Account switcher sheet

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(modals)/account-switcher.tsx` (bottom sheet)
- **Depends on:** saved-accounts store (page 2); Profile tab (stub until Phase 2)

## 1. Research (current Instagram behavior)
### Layout
- A bottom sheet with a grabber.
- One row per logged-in account: avatar (story ring if it has a story), username, an unread dot or badge count, and a filled radio on the current account.
- A "+ Add Instagram account" row, then a sheet with "Log into existing account" and "Create new account" (and "Go to Accounts Center", which is Meta-only).

### Entry & exit points
- Opened by tapping the username ▾ at the top of the own profile, or by **long-pressing the Profile tab** (quick switch).
- Selecting an account shows a full-screen "switching" transition (avatar plus spinner), then reloads Home as that account.
- "Log into existing account" opens Log in (page 3) in add-account mode; "Create new account" opens Sign up (page 4).

### Features & interactions
- [ ] Up to 5 accounts on the app (the help center says 10 on web).
- [ ] Per-account unread notification badges (needs Phase 8 counts; 0 until then).
- [ ] Haptic feedback on the long-press of the Profile tab.
- [ ] Logging out of one account (in Settings) removes it here.

### States
- Loading: switching overlay.
- Error: an expired session for a saved account opens Log in with the username pre-filled.
- Edge cases: the maximum number of accounts is reached ("You can add up to 5 accounts"); removing the current account switches to the next one.

### Sources
- [Add and switch between multiple Instagram profiles](https://help.instagram.com/1682672155283228).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Drop "Go to Accounts Center".
- **Date:** 2026-10-07

## 3. Data & storage
- Device: the saved-accounts list holds each account's refresh token in SecureStore; switching calls `supabase.auth.setSession`. The query cache is cleared on switch.
- No server tables (badges come later from `notifications`, Phase 8).

## 4. Implementation notes
- Phase 0 `BottomSheet`, `Avatar`; `useAccounts()` in `src/features/auth`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (switching shows each user's own data only)
- [ ] Supabase advisors clean (n/a)
