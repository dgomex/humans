# Page 035 — Filters & edit (adjust, brightness, etc.)

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/create/edit.tsx`
- **Depends on:** pages 32–34

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ back · (iOS: brightness wand "Lux" icon) · **Next**.
- Large preview of the current item; for carousels a horizontal strip of slides to switch between, long-press and drag to **reorder**, drag to the trash to remove.
- Bottom tabs: **Filter** · **Edit**.
  - **Filter:** horizontal list of named filters with sample thumbnails (Normal, Clarendon, Gingham, Moon, Lark, Reyes, Juno, Slumber, Crema, Ludwig, Aden, Perpetua…). Tap again on the selected filter → strength slider (0–100) + optional border. Long-press a filter thumbnail = compare. Filters can be applied to the whole carousel or per slide.
  - **Edit:** Adjust (straighten/rotate/perspective), Brightness, Contrast, Structure, Warmth, Saturation, Color (shadows/highlights tint), Fade, Highlights, Shadows, Vignette, Tilt shift, Sharpen. Each tool opens a −100…+100 slider with Cancel / Done; a dot marks tools in use.
- **Press and hold the preview** = show the original.
- Videos: filter + trim + cover (cover selection is also in Reels).

### Entry & exit points
- From picker Next (32) or camera (33). Next → New post details (36). Back keeps the edits.

### Features & interactions
- [ ] ~20 filters with strength slider.
- [ ] Adjust tools (sliders) with reset per tool.
- [ ] Before/after hold.
- [ ] Carousel strip: switch, reorder, remove.
- [ ] Lux auto-enhance.

### States
- Rendering spinner while exporting edited images.

### Sources
- [Instagram creative tools (Instagramers)](https://instagramers.com/destacados/introducing-new-creative-tools-on-instagram-with-examples-on-how-to-edit/)
- [Instagram 6.0 editing tools (TechSpot)](https://www.techspot.com/community/topics/instagram-update-delivers-nearly-a-dozen-new-creative-tools.202982/)
- [Instagram 2025 updates (Embryo)](https://embryo.com/?p=104803)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** **No filters and no adjust tools.** The edit step keeps crop, the ratio toggle and the carousel strip (switch / reorder / remove).
- **Date:** 2026-10-08

## 3. Data & storage
- None (decision: no filters/adjustments).

## 4. Implementation notes
- `app/compose/edit.tsx`: preview + `SortableStrip` (tap select, long-press drag reorder with haptic, ✕ remove, + add more from the picker). Leaving with media → "Save draft?" (`useSaveDraftGuard`).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
