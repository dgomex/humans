# Page 031 — Favorites list management

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/favorites.tsx`
- **Depends on:** `follows`; the Favorites feed (page 51, Phase 4) uses it

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ "Favorites".
- Text: "Posts from your favorites appear higher in feed. They won't be notified when you add them."
- Search; **Favorites (N/50)** with Remove buttons; **Suggestions** with Add buttons.
- Bottom button: "Confirm favorites" when first set up.

### Entry & exit points
- ☰ → Favorites; Following ▾ sheet on a profile; Home feed ▾ → Favorites (Phase 4).

### Features & interactions
- [ ] Add/remove (only accounts you follow), max **50**.
- [ ] Members aren't notified; list is private.
- [ ] Favorites feed and a star badge on their posts (Phase 4).

### States
- Empty: "Add favorites" with suggestions. Limit reached: "You can add up to 50 favorites."

### Sources
- [Close Friends vs Favorites (Inro)](https://www.inro.social/blog/what-are-instagram-close-friends)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (max 50, only accounts you follow).
- **Date:** 2026-10-08

## 3. Data & storage
- `favorites (owner_id, favorite_id, created_at)`, owner-only RLS, trigger enforcing 50 max and "must follow".

## 4. Implementation notes
- `app/favorites.tsx` with `PeoplePickerList` (Add/Remove pill), 50 cap enforced client + server.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
