# Page 045 — Carousel viewer / media zoom

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** component (`src/features/feed/components/PostMedia.tsx`), no route
- **Depends on:** `MediaCarousel` (Phase 3 stub), `LoopingVideo`

## 1. Research (current Instagram behavior)
### Layout
- Media fills the screen width at the post's ratio (4:5…1.91:1). Carousels: horizontal paging, **1/N badge** top-right (fades after ~3 s idle, reappears on swipe), **dots** under the media (max ~5 visible, shrinking at the ends).
- Video: autoplay muted when on screen, loop, speaker toggle bottom-right; global mute state persists across the feed.
- Tags: person icon bottom-left; tap the photo to toggle tag bubbles; tap a bubble → profile. Video slides show a "tagged people" list sheet instead.
- Alt text read by screen readers.

### Features & interactions
- [ ] **Pinch to zoom**: the media lifts out of the feed over a dimmed overlay, follows two fingers (scale + pan), and springs back on release. No zoom lock; no full-screen gallery.
- [ ] Double-tap = like (heart pop), single tap = tags / sound (single tap waits for the double-tap window).
- [ ] Swipe between slides; last swipe position is kept per card while scrolling.
- [ ] Videos pause when scrolled off-screen or the app goes to background.

### States
- Loading: grey placeholder at the post ratio, image fades in (expo-image transition).
- Error: broken-image icon with "Couldn't load" + tap to retry.

### Sources
- [Instagram pinch-to-zoom launch (TechCrunch)](https://techcrunch.com/2015/06/02/instagram-zoom/) · app observation

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: pinch-to-zoom overlay, double-tap like, tags, video sound toggle.
- **Date:** 2026-10-08

## 3. Data & storage
- None (reads `post_media`, signed URLs from the `posts` bucket).

## 4. Implementation notes
- `src/features/feed/components/PostMedia.tsx`: paging carousel, 1/N badge fading after 3 s idle, up to 5 sliding dots, tag bubbles / video tag list, double-tap heart pop + haptic, single tap = tags or sound, shared mute switch (`useFeedMuted`), image error -> tap to retry.
- Pinch: `ZoomOverlay.tsx` (`ZoomProvider` in the root layout) lifts the slide into a root layer above the list (measureInWindow), scale 1-4x with two-finger drag, dimmed backdrop, springs back on release. Videos zoom their poster frame.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
