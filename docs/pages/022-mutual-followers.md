# Page 022 — Mutual followers list

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/[username]/connections.tsx?tab=mutual`
- **Depends on:** page 21

## 1. Research (current Instagram behavior)
### Layout
- On another user's profile, "Followed by alice, bob and 12 others" opens the connections screen on a **Mutual** tab: people *you follow* who also follow this account.
- Rows: avatar, username, full name, Following button.

### Features & interactions
- [ ] Count and first two names on the profile ("Followed by …"), stacked avatars (up to 3).
- [ ] List with search; row → profile.
- [ ] Not shown on your own profile; hidden if there are none.

### States
- Empty: tab hidden. Private target you can't view: still shows mutuals (they are your follows), matching Instagram.

### Sources
- See page 021.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Simple: "Followed by…" line + Mutual tab with search (same simple rows as page 21).
- **Date:** 2026-10-08

## 3. Data & storage
- RPC `mutual_followers(target, cursor)` = my following ∩ target's followers (only accounts I follow, so nothing private leaks).

## 4. Implementation notes
- Mutual tab in the same screen (shown when `mutual_count > 0`); "Followed by …" line with stacked avatars in `ProfileView`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
