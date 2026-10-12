# Page 059 — Reels camera / recorder

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/reel-create/camera.tsx` (full-screen modal, own Stack + composer)
- **Depends on:** Phase 3 camera (page 33) + OS picker (page 32), music catalog (page 39), Create entry mode switcher (page 32: "waits for Phase 6")

## 1. Research (current Instagram behavior)
### Layout
- Full-screen camera preview (9:16). **Top:** ✕ close · flash · ⚙ camera settings. **Left rail:** ♫ Audio · Length (15 / 30 / 60 / 90 s / 3 min) · Speed (0.3×, 0.5×, 1×, 2×, 3×, 4×) · Layout (2–6 split) · Timer (3 s / 10 s countdown + "record until" mark) · Align (ghost of the last frame) · Dual (front + back) · Green screen / Effects.
- **Bottom:** gallery thumbnail · capture button with a **segmented progress ring** · effects carousel · flip camera. **Mode switcher:** POST · STORY · **REEL** · LIVE (page 32).
- After the first segment: ↶ delete last segment, and **Next →**.

### Entry & exit points
- Create (+) → REEL, Reels tab 📷, Audio page "Use audio" (62, track preloaded), Remix (63), profile + → Reel.
- Gallery thumbnail → OS picker (videos / photos become clips). Next → editor (60). ✕ with segments → "Discard / Save draft".

### Features & interactions
- [ ] **Tap to start / tap to stop** or **hold to record**; each start/stop = a **segment**; ring shows segments; total ≤ selected length (max 3 min in-app).
- [ ] Delete last segment (tap ↶ once to select, again to delete).
- [ ] Speed per segment (slow speed slows the music while recording so you stay in time).
- [ ] Timer: countdown 3 / 10 s and a drag handle for how long to record.
- [ ] Align: semi-transparent ghost of the previous segment's last frame.
- [ ] Music while recording, in sync from its clip start.
- [ ] Flip (button, double-tap), pinch / drag-up zoom, tap to focus, flash.
- [ ] Layout: 2–6 cells recorded one after another.
- [ ] Dual camera, green screen, AR effects, touch-up (first-party effects only since Meta Spark closed in Jan 2025).
- [ ] Mix library clips with recorded ones (photos become ~3 s clips).
- [ ] Drafts: leaving with segments asks Save draft / Discard.

### States
- Camera / mic permission denied → explainer with "Open settings".
- Length limit reached → auto-stop, go to preview.
- Interrupted (call, background) → segment kept up to the interruption.

### Sources
- [Instagram Edits: recording, length, timer (Epidemic Sound)](https://www.epidemicsound.com/blog/instagram-edits/)
- [Edits walkthrough (Buffer)](https://buffer.com/resources/how-to-use-instagram-edits/)
- [Edits full walkthrough 2026 (NapoleonCat)](https://napoleoncat.com/blog/instagram-edits/)
- [3-minute reels (Storyboard18, 2025-01)](https://www.storyboard18.com/digital/instagram-extends-reels-to-three-minutes-and-updates-profile-layout-54043.htm)
- Instagram app (iOS / Android), Create → Reel.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Core set: segmented tap / hold recording up to 3 min (15 / 30 / 60 / 90 s / 3 min), delete last segment, speed per segment (0.3–4×, music follows), timer 3 / 10 s + record-until, Align ghost, music while recording, flip / zoom / focus / flash, library clips (photos ≈3 s), Save draft / Discard. **Dropped:** Layout, Dual, green screen, AR effects, touch-up.
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- `app/compose/reel/camera.tsx` in the compose Stack (shared `ComposerProvider`, `state.reel`): segments via `recordAsync` (tap / hold), segmented ring, length, speed, timer + record-until, Align (last-frame ghost), music / borrowed audio while recording, library clips (≤ 3 min), delete last, Save draft / Discard. Create entry gains a **Reel** option; reel drafts reopen in the editor.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
