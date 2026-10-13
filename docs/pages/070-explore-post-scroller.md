# Page 070 — Explore post scroller

- **Phase:** 7 — Search & Explore
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(home,explore,reels,profile)/explore-feed.tsx` (shared)
- **Depends on:** `PostCard` / `FeedList` (43), post options + Not interested (49/50), Explore ranking (65)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** ‹ back · title **"Explore"** ("#tag" / place name / "Posts" when opened from those pages).
- **Body:** a vertical feed of full `PostCard`s. It starts with the tapped post, then continues with **posts similar to it** (same author, shared hashtags, same audio, liked by people who liked it) mixed with general Explore content, infinitely.
- Cards show **Follow** next to the username when you don't follow the author (like suggested posts in Home).
- Reels play inline; tapping opens the full reel viewer.

### Entry & exit points
- Explore grid tile (65), search result grids (66), hashtag (68) and place (69) grids.
- Back returns to the grid at the same scroll position.

### Features & interactions
- [ ] Like / comment / share / save / follow from the card (Phase 4 components).
- [ ] ⋯ menu: **Not interested** (hides the post and lowers similar content: "We'll suggest fewer posts like this"), Report, About this account, Copy link.
- [ ] Opened from a hashtag / place / search grid: continues in that source's order, then falls back to Explore.
- [ ] Impressions recorded (`post_seen`).

### States
- Loading: the tapped post shows immediately; a spinner at the bottom while more load.
- End of a source: continues with Explore suggestions. Unavailable post → "This post isn't available".

### Sources
- [Instagram Help: "Not interested" in Explore](https://help.instagram.com/iphone-app/1482378711987121)
- [Instagram Search AI system (Meta Transparency)](https://transparency.meta.com/features/explaining-ranking/ig-search/)
- Instagram app (iOS / Android).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (tapped post → similar posts → Explore; source order first; Follow; Not interested / Report / About / Copy link; reels → reel viewer).
- **Date:** 2026-10-12

## 3. Data & storage
- `similar_posts(post, snapshot, offset, limit)`; source lists `hashtag_posts` / `search_posts`; cards via `post_cards`.
- Migration: `supabase/migrations/20261012140913_phase7_explore.sql`.

## 4. Implementation notes
- Route `app/(tabs)/(home,explore,reels,profile)/explore-feed.tsx` with `FeedList`: tapped post first, then the source list (tag / search), then similar posts. Cards from accounts you don't follow use reason `suggested` (Follow button + Not interested in ⋯). `useExploreScroller` + `scrollerEntries` in `src/features/explore/api.ts`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (similar posts never include private / Close Friends / own / hidden posts)
- [x] Supabase advisors clean
