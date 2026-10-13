# Page 065 — Explore grid

- **Phase:** 7 — Search & Explore
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(explore)/explore.tsx` (tab root; replaces the placeholder)
- **Depends on:** `posts` + `post_cards` (3/4/6), `post_hides`, `post_seen`, `reel_plays`, suggested ranking (43), reel scroller (58)

## 1. Research (current Instagram behavior)
### Layout
- **Top:** a rounded search field ("Search") pinned under the status bar. Tapping it opens Search (pages 66/67) in place. Some regions show "Ask Meta AI or Search"; the AI part is out of scope.
- **Body:** an infinite **3-column grid** with 1 px gutters, mixing photos, carousels and reels. The grid repeats in blocks of rows. Each block has one **tall tile** (1 column × 2 rows, usually a reel) on the left or right, alternating, and square tiles fill the rest. Newer builds use 3:4 tiles; we keep squares plus tall reel tiles.
- Tile badges at the top right: carousel (stacked squares), reel (▷ clapper), and video. Reels autoplay muted in the tall tile while it's on screen.
- The older topic-chip row (Food, Travel…) and Shop shortcut are gone in current builds.
- iOS and Android match. Android shows a ripple on tap.

### Entry & exit points
- Entry: the Explore tab (🔍), and tapping it again while on the tab scrolls to the top and refreshes.
- A photo or carousel tile opens the Explore post scroller (page 70), starting at that post with similar posts below.
- A reel tile opens the reel viewer (page 58 scroller) at that reel, followed by more Explore reels.
- The search field opens Search (67, then 66).

### Features & interactions
- [ ] Personalized ranking: public content from accounts you don't follow, based on what you engage with (likes, saves, comments, plays, follows of similar accounts), plus popularity and recency. Some followed-account posts are mixed in.
- [ ] Excludes posts you've hidden, reported or marked "Not interested", authors you blocked (Phase 11), private accounts, Close Friends posts, archived posts and your own posts.
- [ ] Pull to refresh reshuffles. Infinite scroll uses a stable snapshot so pages don't repeat.
- [ ] Long-press a tile to see a blurred-background preview card (author, media, ♡ Like, 👤 View profile, ✈ Share, ⋯). Release to dismiss.
- [ ] The tall reel tile autoplays muted when ≥50% visible and pauses when off screen.
- [ ] Records impressions (`post_seen`) so seen tiles sink on refresh.

### States
- Loading: grey shimmer tiles in the block pattern.
- Empty (no public posts yet): "Nothing to explore yet" + suggested accounts.
- Error / offline: "Couldn't refresh" toast; the loaded grid stays.
- Edge cases: a post deleted or made private between load and tap shows "This post isn't available" in the scroller.

### Sources
- [Instagram Help: search and explore](https://help.instagram.com/iphone-app/1482378711987121)
- [Instagram: Search & Explore feature page](https://about.instagram.com/features/search&explore/)
- [Instagram Search AI system (Meta Transparency)](https://transparency.meta.com/features/explaining-ranking/ig-search/)
- [Making Explore an even better home for your interests](https://about.instagram.com/blog/announcements/making-explore-an-even-better-home-for-your-interests)
- [Instagram redesigns Explore (Inflow Network)](https://inflownetwork.com/instagram-redesigns-explore-to-rival-tiktok/amp/)
- Instagram app (iOS / Android), Explore tab.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: search field, ranked grid with alternating tall reel tiles (muted autoplay), badges, pull to refresh with snapshot, long-press preview, impressions. No Meta AI, no topic chips.
- **Date:** 2026-10-12

## 3. Data & storage
- `explore_grid(snapshot, offset, limit)` (tiles via `post_tile`, ranking via `post_base_score`): public Everyone posts + reels, personalised by hashtags / authors you engaged with and accounts your follows follow; reuses `post_hides`, `post_seen`, `reel_plays`, `likes`, `saves`, `comments`.
- RLS: invoker RPC, so posts RLS (`can_view_post`) applies on top of the public-only filter.
- Buckets: covers from the `posts` bucket (signed URLs).
- Migration: `supabase/migrations/20261012140913_phase7_explore.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- Components: `ExploreGrid` (blocks of 5 with a tall reel tile alternating right / left, rows of 3 otherwise; tall reel autoplays muted via `LoopingVideo` when ≥ 50 % visible and the tab is focused; long-press = `Gesture.Pan().activateAfterLongPress` → `TilePreview`, drag onto Like / View profile / Share / More and release), reuses `SuggestedStrip` for the empty state.
- Files: `app/(tabs)/(explore)/explore.tsx`, `src/features/explore/{api.ts,format.ts}`, `src/features/explore/components/{ExploreGrid,TilePreview}.tsx`. Not interested (post sheets) and Hide (report flow) remove the tile from cached grids (`removeFromExplore`).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending: long-press drag preview, tall-tile video autoplay)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web, phone viewport)
- [x] RLS tested with two users (`node scripts/test-explore-rls.mjs`, 61 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
