# Page 058 — Reels feed

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(reels)/reels.tsx` (tab) · `app/reel/[id].tsx` (single reel / scroller from a grid, audio page, link)
- **Depends on:** `posts` / `post_media` (Phase 3), `likes`, `comments`, `saves`, `reposts`, `post_hides`, `post_seen`, `reports`, `post_cards`, PostSheets (Phase 4), `follows` (Phase 2), audio catalog (Phase 3)

## 1. Research (current Instagram behavior)
### Layout
- Full-screen, edge-to-edge **vertical pager** of 9:16 videos (one reel per screen), black background; the tab bar stays (dark style while on Reels).
- **Top:** "Reels" title (2025+ tests: "Reels · Friends" tabs) and a 📷 camera icon on the right that opens the Reels camera (page 59).
- **Right rail (bottom → up):** ♡ like + count · 💬 comment + count · ⟳ repost + count · ✈ share + count · ⋯ more · square audio thumbnail (cover art, or the creator's avatar for original audio).
- **Bottom-left overlay:** avatar · username · **Follow** pill (if not following) · caption (1–2 lines, "… more" expands over a dark gradient) · tagged people / collaborators chip · ♫ audio chip ("username · Original audio" or "Artist · Track", marquee) · optional "Watch part 2" linked-reel button · "Liked by X and others" / friends' activity bubbles (2025).
- Thin **progress scrubber** at the bottom edge (expands while dragging; always visible on long reels).
- iOS and Android share the layout; Android back = previous tab.

### Entry & exit points
- Reels tab (tap again = scroll to top + refresh). Profile Reels tab grid → scroller of that account's reels starting at the tapped one. Audio page (62) grid, Explore (Phase 7), DMs (Phase 9), a link `/reel/<id>`.
- Avatar / username → profile. Audio chip / thumbnail → Audio page (62). 💬 → comments sheet (46 / 64). ✈ → share sheet (48 / 64). ⋯ → options (49 + Reels items). 📷 → camera (59). Tags chip → tagged people sheet.

### Features & interactions
- [ ] Vertical swipe = next / previous reel (snap), autoplay with **sound on**, loop forever.
- [ ] **Tap** = mute / unmute (speaker icon flashes; newer builds: tap = pause); **press and hold** = pause and hide the overlay; **hold on the left/right edge = 2× speed** (2024+).
- [ ] **Double-tap = like** with the big heart burst + haptic.
- [ ] Drag the scrubber to seek.
- [ ] Ranked feed: mostly recommended reels from accounts you don't follow mixed with followed accounts; seen reels don't repeat; "Not interested" removes similar ones.
- [ ] Follow from the overlay pill.
- [ ] Caption expand / collapse; @mentions and #hashtags tappable.
- [ ] ⋯ sheet: Save, Remix (63), Not interested, Interested, Report, Why you're seeing this, Copy link, Download (own / allowed), Captions on/off, Playback speed (0.5 / 1 / 1.5 / 2×). Own reel: Edit, Delete, Archive, Hide like count, Turn off commenting, Pin, insights (out of scope).
- [ ] **Play counts** shown on profile / audio grids (▷ 12.3K); own reels show view counts.
- [ ] Preload the next 1–2 reels; pause when the screen loses focus / app goes to background.
- [ ] Friends tab (2025): reels your friends liked/commented ("bubbles") — limited rollout.

### States
- Loading: black screen with a spinner / blurred cover.
- Empty: no reels at all → "Create your first reel" CTA.
- Error / offline: "Couldn't load reels — tap to retry"; buffered reels keep playing.
- Edge cases: deleted / archived reel while viewing (skip), private account (followers only; never recommended), Close Friends audience, comments off, hidden like counts, removed audio (muted with a notice), reported / hidden reels excluded.

### Sources
- [Instagram tests Reels-first UI (TechCrunch, 2025-09-29)](https://techcrunch.com/2025/09/29/instagram-is-testing-a-reels-first-ui-in-india-and-south-korea)
- [Reels-first redesign / Your Feeds (9to5Google, 2026-02)](https://9to5google.com/2026/02/20/instagrams-reels-first-redesign-might-get-a-customizable-your-feed-video)
- [What Instagram's navigation redesign changed (Storrito, 2026)](https://storrito.com/resources/what-instagrams-navigation-redesign-actually-changed/)
- [Follow button on the Reels rail (onlinemarketing.de, 2025)](https://onlinemarketing.de/social-media-marketing/instagram-follow-pause-button-fuer-reels)
- [Linking Reels / "Watch part 2" (Vaizle, 2025-08)](https://insights.vaizle.com/news/instagram-adds-linking-reels-so-viewers-can-tap-straight-to-the-next-part/)
- [3-minute reels + 3:4 grid (Business Today, 2025-01)](https://www.businesstoday.in/technology/news/story/instagram-head-announces-big-changes-3-minute-reels-and-new-look-for-profile-grid-461527-2025-01-21)
- Instagram app (iOS / Android), Reels tab.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Full clone minus the Friends tab and insights: vertical pager (sound on, loop), tap = mute, hold = pause + clean view, hold an edge = 2×, double-tap like, scrubber, rail (like / comment / repost / share / ⋯ / audio), Follow pill, caption expand, play counts, ranked feed (followed + recommended, seen lower), ⋯ with Save / Remix / Not interested / Report / Why / Copy link / Download / playback speed. **Single-video posts appear as reels too.**
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- `app/(tabs)/(reels)/reels.tsx`, `app/reel/[id].tsx`; `ReelPager` (snap pager, focused reel plays, neighbours mounted paused, pauses on blur / background except under comments), `ReelView` (rail, Follow pill, caption, chips, Watch next part, scrubber, tap = mute, double-tap like, hold = pause, hold edge = 2×, plays after 1.2 s), `ReelPlayer` (edit list live: 2 alternating expo-video players + poster, image timer, music / voiceovers via expo-audio, timed overlays, remix panes). Home feed: `FeedReel` (4:5, feed mute). Profile Reels tab with play counts.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
