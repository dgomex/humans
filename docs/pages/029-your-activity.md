# Page 029 — Your activity

- **Phase:** 2 — Profile
- **Status:** Deferred
- **Route:** `app/your-activity/…`
- **Depends on:** likes/comments (Phase 4), posts (Phase 3), stories (Phase 5), search history (Phase 7), time limits (Phase 11)

## 1. Research (current Instagram behavior)
### Layout
- A menu screen: **Interactions** (Likes, Comments, Tags, Sticker responses, Reviews), **Photos and videos** (Posts, Reels, Highlights), **Account history** (changes like username, bio, privacy), **Recent searches**, **Links you've visited**, **Time spent** (daily average chart, set a daily limit), **Archived**, **Recently deleted** (30-day bin; only shown if non-empty), **Download your information**.
- Each list: sort (newest/oldest), filter by date range and author; Select mode for bulk delete / unlike / archive.

### Features & interactions
- [ ] Bulk unlike / delete comments / archive or delete posts.
- [ ] Recently deleted: restore or delete permanently (needs re-auth code in Instagram).
- [ ] Time spent: chart of the last 7 days (needs app-usage tracking).
- [ ] Account history: log of profile changes with dates.

### States
- Each section empty state.

### Sources
- [Your activity launch (PetaPixel)](https://petapixel.com/2022/02/08/instagram-is-rolling-out-a-bulk-delete-feature-to-all-users)
- [Your activity sections (Pocket-lint)](https://www.pocket-lint.com/apps/news/instagram/159983-instagram-update-makes-it-easier-to-delete-old-posts-comments-and-more)

## 2. User decision
- **Choice:** Deferred
- **Changes requested:** Not built in Phase 2. Sections land with their phases: interactions (4), posts/recently deleted (3), searches (7), time spent (11, page 103).
- **Date:** 2026-10-08

## 3. Data & storage
- `account_history (user_id, kind, old_value, new_value, created_at)` could start now (profile edits in page 19).
- Other sections read tables owned by later phases; `deleted_at` soft-delete on posts (Phase 3).

## 4. Implementation notes
- Menu screen + per-section list screens with a shared `ActivityList` (select / sort / filter).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
