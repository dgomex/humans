# Page 068 — Hashtag page

- **Phase:** 7 — Search & Explore
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(home,explore,reels,profile)/tags/[tag].tsx` (shared; keeps the tab bar)
- **Depends on:** `hashtags`, `post_hashtags` (Phase 3 stub), `CaptionText` (# links), `post_cards`

## 1. Research (current Instagram behavior)
### Layout
- **Header:** ‹ back · "#tag" title · ⋯ (Report, Copy link) · ✈ share.
- **Top card:** a circular cover (the top post's image) and **"N posts"**. Older builds show a **Follow** button; hashtag following is de-emphasized or absent in many current builds. Some builds show "Related" hashtag chips.
- **Tabs:** Top · Recent · Reels. Instagram tested removing **Recent** in 2022, and its presence is region-dependent.
- **Grid:** 3 columns of matching posts; reels show ▷ play counts.

### Entry & exit points
- Tapping a #tag in a caption or comment (`CaptionText`), story hashtag stickers (54), search Tags (66), recent searches (67), a shared link.
- Tile → post scroller (70) seeded with this hashtag's posts.

### Features & interactions
- [ ] Top: ranked by engagement and recency. Recent: newest first. Reels: reels only.
- [ ] Count from `hashtags.post_count`.
- [ ] Follow hashtag: followed tags' top posts appear in Home (an old feature, mostly removed).
- [ ] Hashtags flagged as unsafe show "Posts for #x are hidden because some posts may not follow our Community Guidelines".
- [ ] Share (copy link / OS share; DM in Phase 9).

### States
- Loading: header + grid shimmer. Empty / unknown hashtag: "No posts yet" (a page still opens for any valid tag).
- Error / offline: retry.
- Edge cases: private / Close Friends posts only show to allowed viewers (`can_view_post`), so the count can exceed what's shown.

### Sources
- [Instagram removes the Recent tab from hashtag pages (TechCrunch)](https://techcrunch.com/2022/04/19/instagram-removes-recent-tab-hashtag-pages/amp/)
- [Instagram tests removing 'Recent' tab (iMore)](https://www.imore.com/instagram-tests-removing-recent-tab-hashtag-pages)
- [Instagram Help: Tags results split into top, recent and reels](https://help.instagram.com/iphone-app/1482378711987121)
- Instagram app (iOS / Android).

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Top · Recent · Reels, cover, count, grid → scroller, share / copy link, ⋯ Report. **No hashtag following.**
- **Date:** 2026-10-12

## 3. Data & storage
- Finishes the Phase 3 `hashtags` / `post_hashtags` stub: `hashtag_page(name)` (count + top visible post cover), `hashtag_posts(name, top | recent | reels)`; `reports` gains target_type `hashtag`.
- Migration: `supabase/migrations/20261012140913_phase7_explore.sql`.

## 4. Implementation notes
- Route `app/(tabs)/(home,explore,reels,profile)/tags/[tag].tsx`: header, icon tabs, square grid (`ExploreGrid pattern={false}`) → Explore scroller (source `tag`), Reels tab → `ReelGrid` (reel viewer source `tag`). Share / ⋯ Copy link / Report.
- #hashtags now open this page from captions, comments, bios, reel captions / story hashtag stickers (replacing the "coming soon" toasts).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (private / Close Friends posts hidden; approved follower sees private posts)
- [x] Supabase advisors clean
