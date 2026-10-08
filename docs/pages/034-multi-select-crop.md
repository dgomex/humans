# Page 034 — Multi-select & crop (carousel)

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** inside `app/(modals)/create-entry.tsx` (multi-select mode of the picker)
- **Depends on:** page 32

## 1. Research (current Instagram behavior)
### Layout
- Same screen as the picker. Multi-select on → each thumbnail shows a circle; tapping adds a **numbered** badge (1…20) in selection order; tapping again removes it and renumbers.
- The preview shows the last-tapped item with its own crop.

### Features & interactions
- [ ] Up to **20** photos/videos per carousel (raised from 10 in 2024).
- [ ] **Aspect ratio** set by the first item: square **1:1**, portrait **4:5**, landscape **1.91:1**; "fill" vs "original" toggle (⤢). All slides share the first slide's ratio. Since 2025 the profile grid shows posts as **3:4** tiles (center crop) and 3:4 uploads are kept.
- [ ] Per-item crop: pinch-zoom and pan inside the fixed frame, grid lines while dragging.
- [ ] Reorder happens later on the edit screen (drag thumbnails, page 35).
- [ ] Mixed photo + video carousels.

### States
- Limit reached → toast. Video longer than allowed → toast "Videos must be up to 60 minutes" (carousel videos are shorter in practice).

### Sources
- [Carousel sizes and ratios (Recurpost)](https://recurpost.com/instagram-scheduler/instagram-post-size-guide/)
- [Carousel size guide (Krumzi)](https://www.krumzi.com/blog/instagram-carousel-size-guide)
- [20-slide carousels (Social Samosa)](https://www.socialsamosa.com/news-2/instagram-carousel-feature-20-frames-6810438)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Up to 20 photos **and videos** (≤60 s, uploaded as recorded + thumbnail, no server transcoding). Ratio from the first item (1:1 or original clamped 3:4…1.91:1), pinch/pan crop for photos; videos are center-cropped on display.
- **Date:** 2026-10-08

## 3. Data & storage
- `posts.aspect_ratio` (w/h, 0.75–1.91), `post_media.width/height` = uploaded size. Photos are cropped + resized on device to 1080 px wide JPEG (`renderPhoto`).

## 4. Implementation notes
- `CropView` (Reanimated pinch + pan, clamped cover, grid lines), crop stored as source fractions; ⤢ toggles 1:1 ↔ the first item's original ratio and resets crops. Videos are center-cropped on display only.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
