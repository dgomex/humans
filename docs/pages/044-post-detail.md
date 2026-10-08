# Page 044 — Post detail (single post view)

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/p/[id]/index.tsx` (replaces the Phase 3 stub)
- **Depends on:** PostCard (page 43), comments (46), likes (47), share (48), options (49)

## 1. Research (current Instagram behavior)
### Layout
- Top bar: back ‹ and title "Posts" (with the author's username above it when opened from a profile grid) — opened from a grid, Instagram shows the profile's posts as a **vertical scroller starting at the tapped post**; opened from a link/notification it shows just that post (with "More posts from <user>" grid below).
- Body: the same PostCard as Home (header, media/carousel, actions, likes line, caption fully expanded, comments preview, timestamp).

### Entry & exit points
- Profile grid tile, tagged grid, archive, saved collection, notifications (Phase 8), deep link `humans.app/p/<id>`, shared post in DMs (Phase 9).
- Exits: back; all PostCard actions.

### Features & interactions
- [ ] Same interactions as the feed card (like, double-tap, comment, share, save, ⋯).
- [ ] From a grid: continue scrolling through that profile's posts in grid order.
- [ ] "More posts from <username>" 3-column grid under a single opened post.
- [ ] Own post ⋯ menu keeps the Phase 3 items (Edit, Archive, Pin, Hide like count, Turn off commenting, Delete).
- [ ] Collab invite banner (Phase 3 stub) stays for invited users.

### States
- Loading: spinner/skeleton; Not available: "Post isn't available — The link may be broken, or the post may have been removed." (also for private/blocked).
- Archived own post: title "Archived post".

### Sources
- [Instagram Help: posts](https://help.instagram.com/) · app observation (2025–2026 builds) · see page 43 sources

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: grid opens a scroller of that profile's posts starting at the tapped one; single post + "More posts from…" for links.
- **Date:** 2026-10-08

## 3. Data & storage
- `post_cards(ids)` for the card; `profile_posts(user, kind)` (+ new kind `reposts`) and `saved_posts(collection)` give the scroller order.

## 4. Implementation notes
- `app/p/[id]/index.tsx` replaces the Phase 3 stub. Params `source` (grid | tagged | reposts | saved) + `owner` (+ `title`) -> `usePostScroller` lists that grid starting at the tapped post, then reveals the earlier posts above it (`maintainVisibleContentPosition`). Without params: the single post (caption expanded) + "More posts from <user>" grid + the collab-invite banner.
- Profile grids, Tagged, Reposts and Saved grids pass the scroller params (`ProfileGrid` `scroller` prop).
- The own-post menu moved into the shared options sheet (page 49).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
