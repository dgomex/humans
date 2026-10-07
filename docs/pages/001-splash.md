# Page 001 — Splash / Launch screen

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** native splash (`expo-splash-screen`) + root `app/_layout.tsx` gate
- **Depends on:** Phase 0 shell; auth session restore (`src/features/auth`)

## 1. Research (current Instagram behavior)
### Layout
- Full-screen solid background: white (light) / black (dark). It follows the system theme.
- The Instagram glyph (gradient camera) sits centered, about 80 pt.
- The bottom has "from" above the ∞ Meta wordmark, roughly 50 pt above the safe area.
- iOS and Android look the same. On Android 12+ the system splash API draws the icon inside a circle mask.

### Entry & exit points
- Shown on cold start only (not on resume from background).
- Exits to: Home feed if a valid session is restored; Welcome (page 2) if saved accounts exist on the device; Log in (page 3) if there are none; the onboarding step the user stopped at, if the account is unfinished.

### Features & interactions
- [ ] No interactive elements.
- [ ] Held while the persisted session is read and refreshed and the first feed query is prefetched; typically under 1 s.
- [ ] Fades into the first screen (no slide).

### States
- Loading: the splash itself.
- Empty: n/a.
- Error / offline: still exits. With a stored session the app opens to cached and offline states; without one it opens to Log in.
- Edge cases: an expired or revoked refresh token goes to Log in with that account pre-filled from the saved accounts.

### Sources
- Observed app behavior; Expo SplashScreen API (SDK 57) docs.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Drop the "from ∞ Meta" wordmark; splash shows only the app glyph.
- **Date:** 2026-10-07

## 3. Data & storage
- None (reads the local session only).

## 4. Implementation notes
- `expo-splash-screen` config in `app.json` (background colors per theme, app glyph); `SplashScreen.preventAutoHideAsync()` until `AuthProvider` reports `ready`.
- No Meta wordmark (see decision).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (n/a)
- [ ] Supabase advisors clean (n/a)
