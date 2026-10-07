# Page 008 — Sign up: username

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/username.tsx`
- **Depends on:** page 6 (name, for suggestions); `profiles`

## 1. Research (current Instagram behavior)
### Layout
- Title "Create a username". Text: "Add a username or use our suggestion. You can change this at any time."
- A "Username" field **pre-filled with a suggestion** built from the full name. A trailing indicator shows a spinner while checking, then ✓ (green) or ✕ (red).
- "Next".

### Entry & exit points
- Name → username → terms (page 9).

### Features & interactions
- [ ] Live availability check (debounced, about 300 ms).
- [ ] Error: "The username {x} is not available." plus suggested alternatives you can tap.
- [ ] Rules: at most 30 characters; letters, numbers, periods, and underscores; no consecutive periods; can't start or end with a period; lowercase and unique case-insensitively.
- [ ] Input is lowercased and has autocorrect off.

### States
- Loading: indicator spinner while checking.
- Error: the not-available message or rule violations.
- Edge cases: two people racing for the same name. The unique constraint at completion wins; the loser sees the not-available message.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced.
- **Date:** 2026-10-07

## 3. Data & storage
- `profiles.username citext unique` with a check-constraint regex.
- RPC `username_available(name text) returns boolean` (security definer, stable); RPC `suggest_usernames(full_name text)`.
- Reserved names (`admin`, `explore`, `p`, `reel`, `stories`, `direct`, `accounts`…) are blocked by the same check.

## 4. Implementation notes
- `useUsernameAvailability` (TanStack Query, debounced).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
