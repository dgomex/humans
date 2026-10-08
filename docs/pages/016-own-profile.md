# Page 016 — Own Profile (grid / reels / tagged tabs)

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/profile.tsx` (replaces the Phase 1 placeholder)
- **Depends on:** `profiles`, `follows` (Phase 1 stub); posts/reels/tags from Phase 3/6 (empty states until then); highlights (page 25); stories (Phase 5) for the avatar ring

## 1. Research (current Instagram behavior)
### Layout
- **Header bar:** a lock icon if the account is private, then the **username ▾** (opens the account switcher, page 15). On the right: **+** (create menu: Reel, Edit grid, Post, Story, Story highlight, Live) and **☰** (opens Settings and activity, Phase 11).
- **Identity row:** a large avatar (~86 pt) with a **+** badge to add a story; with an active story it gets a gradient ring and tapping it opens the story. Next to it: the full name (2025 layout) above three counters (**posts · followers · following**).
- **Bio block:** pronouns (grey, next to the name), bio (≤150 chars; @mentions and #hashtags are tappable), up to 5 links ("link.com and 2 others" opens a links sheet), a music pill (a song on the profile).
- **Action buttons:** **Edit profile** · **Share profile** · person+ icon (toggles "Discover people" suggestions inline).
- **Highlights row:** horizontal circles, each highlight then "**New**" (+). 2026: Instagram is testing highlights as a dedicated grid tab instead of the row.
- **Sticky tab bar:** **Grid** · **Reels** · **Reposts** (2025) · **Tagged**. Pins under the header on scroll.
- **Grid:** 3 columns, 1 px gutters. Thumbnails are **vertical 3:4** since January 2025 (previously square). Overlays: carousel icon, reel icon, 📌 pinned (up to 3 pinned at the top). The grid can be reordered with **Edit grid** (June 2026).

### Entry & exit points
- Profile tab (long-press = account switcher), and the own avatar anywhere in the app.
- Followers/following → page 21; Edit profile → page 19; Share profile → page 23/24; highlight → highlights viewer (page 57); New → page 25; grid item → post detail (page 44); ☰ → Settings hub (page 86). Saved, Archive, Your activity, Close Friends and Favorites are reached from ☰.

### Features & interactions
- [ ] Pull to refresh.
- [ ] Counters tap through; numbers abbreviated (12.3K, 1.2M).
- [ ] Tabs: tap or swipe horizontally.
- [ ] Empty tabs: Grid "Share photos and videos / Create your first post"; Reels "Share a moment with the world"; Tagged "Photos and videos of you".
- [ ] "Complete your profile" cards for new accounts (add bio, add photo, add name, find people).
- [ ] Long-press a grid item: peek preview (needs posts, Phase 3/4).
- [ ] Professional dashboard row: out of scope.

### States
- Loading: skeleton header and grid placeholders.
- Empty: new account shows 0 counters, completion cards, empty-tab prompts.
- Error / offline: cached profile, retry.
- Edge cases: very long username/name (truncate), bio line breaks, 0 links.

### Sources
- [Vertical grid, highlights tab, grid editing (Lindsey Gamble)](https://www.lindseygamble.com/blog/instagram-profile-updates)
- [Grid reordering rollout, June 2026 (Business Today)](https://www.businesstoday.in/amp/technology/news/story/instagram-finally-gives-you-control-over-your-profile-grid-heres-how-535728-2026-06-09)
- [Highlights moving to the grid (Jang)](https://jang.com.pk/en/29847-instagrams-profile-grid-highlights-gets-major-makeover-to-offer-more-flexibility-news)
- [Simplified profile test (SlashGear)](https://www.slashgear.com/instagram-tests-cleaner-simplified-user-profile-design-21554901/)
- [Profile banners, Apr 2026 (Tagembed)](https://tagembed.com/blog/instagram-updates/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Current 2026 behavior: 3:4 grid, Grid · Reels · Reposts · Tagged tabs, highlights row above the tabs. A temporary "Private account" toggle lives in Edit profile until page 91 (Phase 11).
- **Date:** 2026-10-08

## 3. Data & storage
- `profiles`: add `bio`, `pronouns`, `links`, `is_private`, and counters `followers_count` / `following_count` / `posts_count` kept by triggers.
- Grid: `posts` (Phase 3). Until then the tabs show empty states.
- `highlights` (page 25).

## 4. Implementation notes
- `app/(tabs)/(profile)/profile.tsx` (top bar: lock, username ▾ switcher, + Create sheet, ☰ menu stub); body = `ProfileView` (`src/features/profile/components/ProfileView.tsx`): identity + counters, `BioText`, links → `LinksSheet`, actions, `SuggestedStrip`, Complete-your-profile cards, `HighlightsRow`, sticky `ProfileTabBar` + swipeable `ProfileTabPages` (3:4 `ProfileGrid`, empty states).
- Data: `useProfile` → `get_profile` RPC.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
