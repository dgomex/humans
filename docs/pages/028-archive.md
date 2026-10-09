# Page 028 — Archive (posts, stories, live archive)

- **Phase:** 2 — Profile
- **Status:** Deferred — posts archive built in Phase 3; stories archive built in Phase 5 (▾ Stories / Posts, grid with date badges + Calendar, Create highlight, archive settings); live archive (Phase 10) pending
- **Route:** `app/archive.tsx`
- **Depends on:** `posts.archived_at` (Phase 3), `stories` (Phase 5), `live_sessions` (Phase 10)

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ "Archive" title with a ▾ dropdown to switch **Stories archive / Posts archive / Live archive**; ⋯ → archive settings (Save story to archive, Save live to archive).
- **Stories archive:** 3-column grid of past stories with a date badge, plus **Calendar** and **Map** views (stories by day / place). "Create highlight" button.
- **Posts archive:** grid of archived posts (hidden from the profile; "Show on profile" restores them).
- **Live archive:** past lives kept 30 days.

### Features & interactions
- [ ] Switch archive type.
- [ ] Story → viewer with "Highlight", "Share", "Delete".
- [ ] Post → "Show on profile".
- [ ] Settings toggles.

### States
- Empty per type: "Keep your stories in your archive…", "Only you can see posts you've archived".

### Sources
- [Your activity / archive tools (PetaPixel)](https://petapixel.com/2022/02/08/instagram-is-rolling-out-a-bulk-delete-feature-to-all-users)

## 2. User decision
- **Choice:** Deferred
- **Changes requested:** Not built in Phase 2. Posts archive with Phase 3, stories archive with Phase 5, live archive with Phase 10.
- **Date:** 2026-10-08

## 3. Data & storage
- No own tables: reads `posts`, `stories`, `live_sessions` from their phases.

## 4. Implementation notes
- Archive screen with a type switcher.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
