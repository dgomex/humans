# Page 047 — Likes list

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(home,explore,reels,profile)/p/[id]/likes.tsx` or `app/p/[id]/likes.tsx`
- **Depends on:** `likes` (this phase), `UserRow`, `FollowButton`

## 1. Research (current Instagram behavior)
### Layout
- Title "Likes", a **search field**, then rows: avatar (story ring), username, full name, and Follow / Following button (none on yourself). People you follow are listed first ("Followed by you"), then others.
- Since 2024 the post's own like count shown on the card opens this list; for posts with **hidden like counts**, only the author sees the number; others can still open the list from "Liked by X and others" but see no total.
- Instagram for the author also shows view counts / Insights (business, out of scope).

### Features & interactions
- [ ] Search likers by username/name.
- [ ] Follow / Following / Requested inline.
- [ ] Infinite scroll; pull to refresh.
- [ ] Comment likers list reuses this screen (from comment like count).

### States
- Loading skeleton; Empty "No likes yet"; error retry.
- Private likers still appear (like Instagram); blocked users excluded (Phase 11).

### Sources
- [How to see who liked a comment (Post Bridge)](https://www.post-bridge.com/blog/how-to-see-who-liked-a-comment-on-instagram) · app observation

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (search, inline follow, people you follow first, hidden like counts respected).
- **Date:** 2026-10-08

## 3. Data & storage
- `likes` (user_id, post_id). RLS: select `can_view_post` (likers stay visible with hidden counts, like Instagram); insert own on visible posts; delete own. `post_likers(post, search, offset, limit)`: you, then people you follow, then newest.

## 4. Implementation notes
- `app/p/[id]/likes.tsx` (also `?comment=` for comment likers): search, total shown only when the count is visible (the author always sees it), inline `FollowButton` (Follow / Follow back / Following / Requested).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
