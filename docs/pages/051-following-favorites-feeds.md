# Page 051 — Feed variants: Following / Favorites

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(home)/feed/[kind].tsx` (kind = following | favorites)
- **Depends on:** `follows`, `favorites` (Phase 2), PostCard (43)

## 1. Research (current Instagram behavior)
### Layout
- Opened from the Home header wordmark ▾ menu (Following / Favorites with icons). Pushed screen with a back ‹ and title **Following** or **Favorites** (Favorites has a star; on iOS a "Manage favorites"/edit entry in the header).
- **Chronological** list of PostCards from followed accounts / Favorites only; **no suggested posts**, no ads, no stories tray.
- Favorites: posts from Favorites also get a ★ star badge in Home.
- Ends with "You're all caught up" for the window loaded, then older posts on scroll.

### Features & interactions
- [ ] Same PostCard interactions.
- [ ] Favorites empty state: "Add accounts to Favorites" → Favorites manager (page 31).
- [ ] Instagram resets to Home on app restart (no persistent default).

### States
- Loading skeletons; Empty: "When people you follow post, you'll see them here." / Favorites CTA.

### Sources
- [Favorites and Following (Instagram)](https://about.instagram.com/blog/announcements/favorites-and-following)
- [Chronological feeds (FoneArena)](https://www.fonearena.com/blog/359533/instagram-chronological-following-favorites-feeds.html/amp)
- [Favorites vs Following (Pocket-lint)](https://www.pocket-lint.com/sv-se/appar/nyheter/instagram/160518-instagram-favoritflode-vs-foljande-flode-vad-ar-skillnaden)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: chronological Following and Favorites feeds, no suggestions.
- **Date:** 2026-10-08

## 3. Data & storage
- `following_feed(kind following|favorites, before, before_id, limit)`: keyset on (published_at, id); followed / favorite authors and their accepted collaborations; hidden posts excluded.

## 4. Implementation notes
- `app/(tabs)/(home)/feed/[kind].tsx`: back + title (star for Favorites), "Manage favorites" -> page 31, empty states with "Add favorites".

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
