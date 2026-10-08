# Page 043 — Home Feed

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(home)/index.tsx`
- **Depends on:** `posts`, `post_media`, `follows`, `favorites` (Phases 2–3); PostCard (this phase); stories tray (Phase 5)

## 1. Research (current Instagram behavior)
### Layout
- **Header** (scrolls away on scroll down, returns on scroll up): Instagram wordmark with a ▾ chevron (tap → menu: **Following** / **Favorites**, page 51), right side ♡ (Activity / notifications, Phase 8) and the Direct icon (Phase 9). In the 2025 redesign DMs moved to the tab bar and a **+** sits on the left on some builds; our tab order is fixed (DECISIONS 2026-10-05), so the header keeps ♡ + Direct.
- **Stories tray**: horizontal row of circles; first is "Your story" (own avatar with a blue +), then accounts with unseen stories (gradient ring), then seen ones (grey ring). Close Friends rings are green. Phase 5 content.
- **Post feed** of PostCards:
  - Header row: avatar (story ring if active), username (+ "and N others" for collaborators), verified badge, optional music line (♪ artist · title); ⋯ at the right (page 49). Suggested posts show "Suggested for you" + **Follow** button and an ✕ (Not interested).
  - Media: single photo/video or carousel (dots under the media, 1/N badge top-right that fades after a moment). Videos autoplay muted when ≥50% visible; tap toggles sound. Tagged posts show a person badge bottom-left; tap media → tags.
  - Action row: ♡ like · 💬 comment · ⟳ repost (since Aug 2025) · ✈ share — and the bookmark (save) on the right. Counts sit next to each icon (2024+ layout) unless the author hid like counts.
  - "Liked by **user** and **others**" (when counts hidden or as social proof), caption (username bold, truncated to 2 lines with "… more"), "View all N comments", up to 2 preview comments from people you follow, "Add a comment…" row with own avatar, relative timestamp ("2 hours ago").
- **"You're all caught up"** marker after all posts from the last ~2 days, then **Suggested posts** from accounts you don't follow (infinite).
- Pull to refresh; tapping the Home tab while on Home scrolls to top (tap again = refresh).

### Entry & exit points
- Home tab (default after login). Avatars/usernames → profile; media double-tap = like; 💬 → comments sheet (46); "N likes" → likes list (47); ✈ → share sheet (48); ⋯ → options (49); caption #tag → hashtag (Phase 7), @mention → profile.

### Features & interactions
- [ ] Double-tap media to like with a big heart pop animation; tapping ♡ animates a bounce; haptic on like.
- [ ] Bookmark tap saves (toast "Saved · Save to collection" → collections sheet); long-press bookmark opens the collection picker.
- [ ] Ranked Home feed: followed accounts + accepted collaborations + own recent posts; Favorites' posts boosted; seen posts deprioritised.
- [ ] Caption "more" expands inline; @/# links.
- [ ] Inline Follow on suggested posts.
- [ ] Upload progress banner (page 40) at the top.
- [ ] Hidden like counts: only the author sees the number.
- [ ] Empty feed (new account): "Welcome to Instagram" with follow suggestions.

### States
- Loading: skeleton cards (avatar circle + grey media block).
- Empty: welcome + suggested accounts to follow.
- Error / offline: cached feed stays; "No internet connection" banner/toast; retry on pull.
- Edge cases: post deleted/archived after load (card vanishes on refresh; actions fail gracefully), account went private and you're no longer a follower, close-friends posts (green star badge), comments turned off (no "Add a comment").

### Sources
- [Favorites and Following feeds (Instagram)](https://about.instagram.com/blog/announcements/favorites-and-following)
- [Instagram brings back chronological feed (Later)](https://later.com/blog/instagram-chronological-feed/)
- [Instagram 2025 update: Reposts, Map, Friends tab (Torro)](https://torro.io/blog/instagram-reposts-map-update)
- [Instagram new features 2026 (Mentionlytics)](https://www.mentionlytics.com/blog/instagram-new-features/)
- [Instagram updates 2026 (Metricool)](https://metricool.com/instagram-news/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Ranked Home (recency + Favorites boost + seen posts lower), "You're all caught up", then Suggested posts with inline Follow / ✕. Wordmark ▾ → Following / Favorites (page 51). Stories tray shows only your own "Your story" circle until Phase 5. ♡ (Activity) and Direct icons are stubs until Phases 8 / 9.
- **Date:** 2026-10-08

## 3. Data & storage
- Tables: `post_seen` (impressions for ranking, owner-only), `post_hides` (Hide / Not interested / reported, owner-only), `reposts`; counters on `posts` (`like_count`, `comment_count`, `repost_count`).
- RPCs: `home_feed(snapshot, offset, limit)`: followed authors, followed collaborators, own posts and reposts by people you follow from the last 3 days. Score = recency decay x engagement x Favorites 1.6 x own post just shared 5 x seen before this session 0.2 (reposts 0.8). `suggested_posts(snapshot, ...)`: public, not followed, not requested, not hidden; engagement / age, "Not interested" authors x 0.2. `post_cards(ids)`: everything a card renders (masked like count, my like/save/repost, follow/favorite flags, "Liked by", 2 preview comments). `mark_posts_seen(ids)`.
- Pagination uses a snapshot timestamp so the ranked order stays stable while scrolling; pull to refresh takes a new snapshot.
- RLS: every feed row passes `can_view_post`; hides and seen rows are owner-only.

## 4. Implementation notes
- `app/(tabs)/(home)/index.tsx`: header (wordmark menu -> Following / Favorites; heart and Direct show "coming soon" toasts), stories tray (own "Your story" only), upload banner, feed, "Welcome" + follow suggestions when nothing followed has posted.
- `src/features/feed/api.ts` (`useHomeFeed`, `fetchCards`, per-post `usePostCard` cache), `components/FeedList.tsx` (focused card plays video, impressions, "You're all caught up" -> View older posts), `components/PostCard.tsx`, `components/PostSheets.tsx` (provider in the root layout).
- The header stays fixed (it doesn't hide on scroll): small deviation, revisit during polish.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
