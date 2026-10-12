# Page 063 — Remix / Sequence entry

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/reel-create/remix.tsx` (layout picker + recorder, then editor 60 / details 61)
- **Depends on:** reels (58), camera (59), editor (60), share details (61)

## 1. Research (current Instagram behavior)
### Layout
- Reel ⋯ → **Remix** (also in the share sheet). Opens the camera with the **original reel next to your camera** and a layout picker: **Side-by-side** (left/right or top/bottom), **React** (original small in a corner), **Green screen** (original as your background), **Sequence** (original plays first, then your clip; trim the original to the part you want).
- Reels camera controls: record synced to the original's playback, timer, speed, flip, delete last segment.
- Editor: an **original-audio volume** slider; voiceover, text, stickers as usual.

### Entry & exit points
- Others' reels ⋯ / share sheet → Remix (only when the creator allows remixing; public accounts). Photo posts can be remixed too (photo as background / side).
- Done → editor (60) → details (61). Published remix shows "Remix with @creator" linking to the original; the creator is notified (Phase 8).

### Features & interactions
- [ ] Layout picker (side-by-side, react / PiP, green screen, sequence).
- [ ] Recording plays the original in sync; stopping recording pauses it.
- [ ] Sequence: trim the original (start / end), then record / add your clips after it.
- [ ] Original audio volume vs your audio.
- [ ] Remix credit + link on the published reel.
- [ ] Owner control: "Allow remixing" per reel (61) and a global default (Settings → Sharing and reuse, page 99).
- [ ] "View remixes" from the original.

### States
- Original deleted / remixing turned off / account went private → "This reel can't be remixed"; existing remixes keep your part (original replaced by "Content unavailable").

### Sources
- [Remix vs Sequence (Jeff Bullas forum)](https://www.jeffbullas.com/thread/what-is-the-difference-between-sequence-and-remix-on-instagram-reels/)
- [Reels Remix guide (Storrito)](https://storrito.com/resources/reels-remix-instagram)
- [Reel Remix guide (The Social Cat)](https://thesocialcat.com/glossary/reel-remix-instagram)
- [Instagram expands remixing options (TechRadar)](https://www.techradar.com/news/instagram-is-greatly-expanding-its-video-remixing-options)
- Instagram app (iOS / Android), reel ⋯ → Remix.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Remix layouts **Side-by-side, React (PiP) and Sequence** (trim the original), synced recording, original-audio volume, remix credit + link, Allow remixing per reel, View remixes. **Dropped:** green screen (needs segmentation), photo remixes.
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- Remix entry: ⋯ / share sheet → `compose/reel/camera?remix=` with the layout chip (side by side / react / sequence), original playing in sync while recording; sequence trim in the timeline; `remixes/[id]` grid; remix chip on reels.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
