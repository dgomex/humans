# Page 067 — Recent searches

- **Phase:** 7 — Search & Explore
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(explore)/search.tsx` (empty query state) + `app/(tabs)/(explore)/recent.tsx` (See all)
- **Depends on:** search (66), new `search_history`

## 1. Research (current Instagram behavior)
### Layout
- **Empty query state** (search field focused, nothing typed): a "Recent" header with **See all** on the right, then up to about 10 rows: accounts (avatar, username, name), hashtags (#), audio, places (pin) and keyword queries (🔍). Each row has a ✕ on the right.
- **See all → "Recent searches" screen:** the full list, with **Clear all** in the header. Confirm dialog: "Clear search history?" (can't be undone; you may still see accounts you've searched as suggestions) → Clear all / Not now.
- No history: the panel is empty or shows suggested accounts.

### Entry & exit points
- Tapping Explore's search field. Settings → Your activity → Recent searches (Phase 11) shows the same list.
- A row reopens its target (profile / tag / audio / place) or re-runs the keyword search.

### Features & interactions
- [ ] Every opened result and submitted keyword is saved; repeats move to the top (de-duplicated).
- [ ] ✕ removes one entry.
- [ ] Clear all with confirmation.
- [ ] History is private to the user and synced across devices (server-side).
- [ ] Entries whose target was deleted or became unavailable are hidden.

### States
- Loading: skeleton rows. Empty: no "Recent" section.
- Error: list hidden; search still works.

### Sources
- [Instagram Help: view and clear recent searches](https://help.instagram.com/iphone-app/1482378711987121)
- Instagram app (iOS / Android).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (server-synced, de-duplicated, ✕, See all + Clear all with confirm).
- **Date:** 2026-10-12

## 3. Data & storage
- `search_history` (owner-only select / delete; writes only via `record_search`, which checks the target exists and is visible, bumps repeats, keeps 50); `recent_searches(limit)` with display data, skipping unavailable targets.
- Migration: `supabase/migrations/20261012140913_phase7_explore.sql`.

## 4. Implementation notes
- Search screen with an empty field shows 10 recents + See all; `app/(tabs)/(explore)/recent-searches.tsx` has the full list, ✕ per row and Clear all (confirm dialog). A keyword row re-runs the search (`/search?q=`).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (another user can't read or delete your history; direct inserts rejected)
- [x] Supabase advisors clean
