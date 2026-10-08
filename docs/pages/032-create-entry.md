# Page 032 — Create entry / media picker (post, story, reel, live switcher)

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(modals)/create-entry.tsx` (full-screen modal opened by the Create tab, already wired in Phase 0)
- **Depends on:** `profiles` (Phase 1). Story / Reel / Live modes belong to Phases 5, 6, 10.

## 1. Research (current Instagram behavior)
### Layout
- Header: ✕ (close) · "New post" · **Next** (blue, enabled once something is selected).
- **Preview** (top, square-ish, about 45% of the screen) of the focused item, pinch/drag to reposition the crop, a ⤢ "expand/fit" button bottom-left (toggles fill ↔ original ratio, page 34).
- Gallery toolbar: album dropdown **"Recents ▾"** (all albums, Favorites, Videos…), on the right a **multi-select** button (stacked squares) and a **camera** button.
- **Gallery grid**: 4 columns of device photos/videos, newest first, video duration badges. Infinite scroll; scrolling up collapses the preview.
- Bottom mode switcher (pill): **POST · STORY · REEL · LIVE**; swipe or tap to switch. On iOS a "Drafts" entry appears in the album dropdown / above the grid when drafts exist (page 42).
- iOS vs Android: the same layout; the dropdown is a sheet on iOS and a menu on Android. On iOS with **limited photo access**, a banner "You've given Instagram access to a select number of photos" + "Manage".

### Entry & exit points
- Create tab (+) in the tab bar; + on the own profile header; swipe right from Home (opens Story camera).
- Next → Filters & edit (page 35); camera button → Camera (page 33); multi-select → page 34; STORY/REEL/LIVE → Phases 5/6/10; ✕ → back, with "Discard / Save draft" if edits exist.

### Features & interactions
- [ ] Permission flow: first open asks for photos access; denied → empty state with "Allow access" → Settings.
- [ ] Album switcher.
- [ ] Single select (tap = focus in preview) and multi-select (numbered badges, up to **20** items).
- [ ] Preview crop: pinch-zoom / pan, fill vs original toggle.
- [ ] Mode switcher (Post / Story / Reel / Live).
- [ ] Haptic on reaching the selection limit + toast "You can only select up to 20".

### States
- Loading: grey placeholders while thumbnails load.
- Empty: "No photos or videos" (empty library).
- Permission denied: illustration + "Allow access to your photos".
- Edge cases: iCloud-only assets (download spinner), videos too long/short for posts, unsupported formats.

### Sources
- [Post multiple photos (PostNitro, 2026)](https://postnitro.ai/blog/post/post-multiple-photos-instagram-2026)
- [Instagram carousel raised to 20 items (Social Samosa)](https://www.socialsamosa.com/news-2/instagram-carousel-feature-20-frames-6810438)
- [Expo MediaLibrary docs: Expo Go limits on Android](https://docs.expo.dev/versions/latest/sdk/media-library/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** System photo picker only (OS picker, multi-select up to 20, ordered); no custom in-app gallery / album menu. The Create screen offers Library · Camera · Drafts. The POST/STORY/REEL/LIVE mode switcher waits for Phases 5/6/10.
- **Date:** 2026-10-08

## 3. Data & storage
- None on its own. The OS picker (`expo-image-picker`, ordered multi-select ≤20, images + videos ≤60 s) fills the client-side composer.

## 4. Implementation notes
- `app/compose/index.tsx`, `src/features/create/{ComposerProvider.tsx,media.ts,useOpenLibrary.ts}`. Native auto-opens the picker when there are no drafts; permission denied → dialog with Open Settings.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
