# Page 062 — Audio page

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(tabs)/(home,explore,reels,profile)/audio/[id].tsx` (shared, keeps the tab bar)
- **Depends on:** `audio_tracks`, `saved_audio` (Phase 3), reels (58), Saved (page 26: "Audio tile waits for Phase 6")

## 1. Research (current Instagram behavior)
### Layout
- Header: back · ✈ share · ⋯.
- **Top card:** square cover art (or the original creator's avatar) · title · artist (or "<username> · Original audio") · "N reels" · ▶ preview · **Save audio** (bookmark).
- "Original reel" tile first for original audio; trending ↗ badge.
- **Grid** (3 columns, 9:16 tiles) of every visible reel using this audio, with ▷ play counts; ranked by popularity.
- **Floating bottom button:** "📷 Use audio".

### Entry & exit points
- Reels audio chip / disc (58), post music chip (Phase 3), story music sticker (Phase 5), search Audio tab (Phase 7), Saved → Audio (26), a shared link.
- Tile → reel scroller (58) of this audio's reels. Use audio → Reels camera (59) with the track and clip start preloaded. Artist / username → profile.

### Features & interactions
- [ ] Preview playback (stops other audio); pauses on leaving.
- [ ] Save / unsave audio (Saved → Audio; also the music picker's Saved tab).
- [ ] Share audio page (DM / copy link).
- [ ] Reels from private accounts excluded unless you follow them.
- [ ] Original audio: "<username> · Original audio", credited to the first reel; others can reuse it; rename by the owner.
- [ ] ⋯: Report audio, Copy link.

### States
- Loading: cover + grid placeholders. Empty: "No reels yet — be the first to use this audio" + Use audio.
- Audio unavailable (removed) → "This audio isn't available".

### Sources
- [Instagram makes Reels audio more like TikTok (Engadget)](https://www.engadget.com/instagram-reels-audio-saving-tiktok-184509542.html)
- [How to save audio on Instagram (Dexerto)](https://www.dexerto.com/entertainment/how-to-save-an-audio-on-instagram-1990468)
- [Save audio from reels (TelecomTalk)](https://telecomtalk.info/how-to-save-audio-instagram-reels/336261/)
- Instagram app (iOS / Android), audio page.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: cover, title / artist or original audio, reel count, preview, Save (+ Saved → Audio tile), share / copy link, ranked grid with play counts, Use audio, original-audio pages + rename, ⋯ Report / Copy link.
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- `app/(tabs)/(home,explore,reels,profile)/audio/[id].tsx` (header, preview: catalog file or the origin reel's sound, Save, Rename, share, ⋯ copy link / report, `ReelGrid`, Use audio → camera `?track=`), `app/saved/audio.tsx` + Saved → Audio tile.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
