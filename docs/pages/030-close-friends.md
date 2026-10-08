# Page 030 — Close Friends list management

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/close-friends.tsx`
- **Depends on:** `follows`; stories (Phase 5) use the list

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ "Close friends" · Done.
- Info text: "We don't send notifications when you edit your close friends list."
- Search field; **"Close friends (N)"** with "Remove all" link, then **Suggestions** / your followers & following, each row with a circular **check** toggle (green star badge on chosen).

### Entry & exit points
- ☰ → Close Friends; story share sheet (Phase 5); Following ▾ sheet on a profile (page 17).

### Features & interactions
- [ ] Add/remove by tapping the circle (optimistic, instant).
- [ ] Search people you follow / who follow you.
- [ ] One list per account, no published cap; members aren't notified.
- [ ] Close-friends stories show a green ring to members (Phase 5).

### States
- Empty: "Close friends · Add people to your list". No suggestions: show followers.

### Sources
- [Close Friends guide 2026 (Inro)](https://www.inro.social/blog/what-are-instagram-close-friends-how-instagram-close-friends-list-work)
- [Close Friends vs Favorites (Inro)](https://www.inro.social/blog/what-are-instagram-close-friends)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced.
- **Date:** 2026-10-08

## 3. Data & storage
- `close_friends (owner_id, friend_id, created_at)`, owner-only RLS (the member cannot see the list; only Phase 5 story RLS checks membership via a security-definer helper).

## 4. Implementation notes
- `app/close-friends.tsx` with `PeoplePickerList` (check variant) + `people_picker` RPC; Remove all.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (B cannot read A's list)
- [x] Supabase advisors clean (db lint)
