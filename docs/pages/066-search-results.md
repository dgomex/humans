# Page 066 — Search results (top, accounts, audio, tags, places)

- **Phase:** 7 — Search & Explore
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(explore)/search.tsx` (typing + results; same screen as 67)
- **Depends on:** `profiles`, `search_profiles` (3), `hashtags` stub (3), `audio_tracks` (3/6), posts / reels, places (69, see that decision)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** ‹ back · focused search field with ✕ clear.
- **While typing (typeahead):** a live list mixing accounts (avatar, username, name, "Following" / "Followed by x"), hashtags (# icon, "N posts"), audio (cover, title · artist), places (pin icon, address) and keyword suggestions (🔍 "cats funny"). The first row is the raw query ("See all results").
- **After submitting (Search key, or tapping a keyword):** a tab strip with **For you · Accounts · Reels · Audio · Tags · Places**.
  - **For you (Top):** a few top account rows, then a 3-column grid of posts and reels matching the keyword (caption / hashtags / author), ranked.
  - **Accounts:** a list of accounts with Follow / Following buttons.
  - **Reels:** a grid of reels (9:16, play counts) matching the keyword.
  - **Audio:** tracks with cover, title, artist, "N reels" → audio page (62).
  - **Tags:** hashtags with "N posts" → hashtag page (68).
  - **Places:** places with the address → place page (69).
- Swipe left/right between tabs.

### Entry & exit points
- From Explore's search field (65), via recent searches (67).
- Account → profile; tag → 68; place → 69; audio → 62; post tile → post scroller (70) seeded with the results; reel tile → reel scroller.
- Each opened result is added to recent searches (67).

### Features & interactions
- [ ] Debounced typeahead (≈250 ms). Accent-insensitive prefix + fuzzy matching on username / full name. Ranking: people you follow, mutual followers, then popularity (followers).
- [ ] Hashtag matching by prefix, ranked by post count. A leading "#" restricts to tags.
- [ ] Keyword search over captions (full-text) for the For you and Reels grids.
- [ ] Private accounts appear in Accounts, but their posts never appear in grids unless you follow them.
- [ ] Follow / Following / Requested toggles inline in Accounts.
- [ ] Some sensitive terms show a "Sensitive content" interstitial.

### States
- Loading: row skeletons, grid shimmer.
- No results: "No results found for "x"".
- Error / offline: retry row.
- Edge cases: blocked accounts are excluded (Phase 11).

### Sources
- [Instagram Help: filter search results (For you, Accounts, Audio, Tags, Places, Reels)](https://help.instagram.com/iphone-app/1482378711987121)
- [Breaking down how Instagram Search works](https://about.instagram.com/blog/announcements/break-down-how-instagram-search-works/)
- [Instagram Search AI system (Meta Transparency)](https://transparency.meta.com/features/explaining-ranking/ig-search/)
- [How Instagram search works (Influencer Marketing Hub)](https://influencermarketinghub.com/instagram-search/)
- Instagram app (iOS / Android).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (typeahead, For you / Accounts / Reels / Audio / Tags, caption keyword search, inline Follow). **Places tab hidden** because page 69 is dropped. No sensitive-term interstitial.
- **Date:** 2026-10-12

## 3. Data & storage
- `search_accounts`, `search_hashtags`, `search_audio`, `search_posts(query, top | reels)` (+ `posts_caption_fts_idx`); reel viewer sources `tag` / `search`.
- RLS: invoker RPCs; private accounts are listed but their posts / original audio only show to approved followers (posts / audio_tracks RLS).
- Migration: `supabase/migrations/20261012140913_phase7_explore.sql`.

## 4. Implementation notes
- Typeahead (250 ms debounce): keyword row, 6 accounts, 3 tags (10 when the query starts with #), 2 audio. Submit → tabs (horizontal pager, swipe or tap). For you = 3 accounts + "See more accounts" + Explore-pattern grid. Accounts / Audio / Tags lists, Reels = `ReelGrid` (source `search`). Opened results call `record_search`.
- Files: `app/(tabs)/(explore)/search.tsx`, `src/features/explore/components/SearchRows.tsx`, `src/features/explore/api.ts`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending: keyboard, swipe between tabs)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-explore-rls.mjs`)
- [x] Supabase advisors clean
