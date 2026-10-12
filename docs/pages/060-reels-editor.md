# Page 060 — Reels editor

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/reel-create/edit.tsx` (+ sub-screens for clips, audio, voiceover, text)
- **Depends on:** page 59 segments, music catalog (39), story editor tools (page 54: text, stickers, draw) as reusable overlay components

## 1. Research (current Instagram behavior)
### Layout
- **Preview screen:** looping full-screen preview with a top toolbar: ♫ Audio · Aa Text · ☺ Stickers · ✎ Draw · ✨ Effects / filters · 🎙 Voiceover · ⋯ (Save draft, Download). Bottom: **"Edit video"** (timeline) and **Next →** (page 61).
- **Edit video (timeline):** preview, play/pause + time, a horizontal timeline with the clip filmstrip, audio lane(s), text / sticker lanes; tools: Add clips (+), Split, Speed, Volume, Replace, Delete, Reorder (drag), Trim handles, Transitions.
- **Audio mixer (Controls):** sliders for camera audio, music, voiceover, sound effects; "Enhance voice" / noise reduction.

### Entry & exit points
- From camera Next (59), a library pick, a draft, Remix (63).
- Back → camera with segments kept. Next → share details (61).

### Features & interactions
- [ ] Trim each clip (drag handles), split at playhead, delete, reorder (long-press drag), replace, per-clip speed.
- [ ] Add more clips from the library or camera.
- [ ] Music: catalog track, pick the start (waveform scrubber), volume; "sync to beat" auto-cuts (templates).
- [ ] **Voiceover:** record narration at the playhead; multiple takes; volume; voice effects.
- [ ] **Text with timing** (start / end on the timeline), fonts / colours / animations (story tools), **text-to-speech** voices.
- [ ] **Auto captions** sticker (speech-to-text, editable, styles).
- [ ] Stickers (poll, quiz, mention, emoji slider…, timed), drawing.
- [ ] Filters / adjust, transitions between clips, effects.
- [ ] Sound effects library.
- [ ] Save draft at any time; Download to device.

### States
- Preview processing spinner; unreadable clip → error.
- Total length over the limit → must trim before Next.

### Sources
- [Edit reels with Instagram's built-in editor (Guiding Tech)](https://www.guidingtech.com/edit-reels-using-instagrams-built-in-editor)
- [How to edit videos for Instagram — audio mixer, enhance (Riverside)](https://riverside.com/blog/how-to-edit-videos-for-instagram)
- [Voiceover on reels (CapCut guide)](https://www.capcut.com/resource/how-to-add-voiceover-to-reels)
- [Text-to-speech on reels (CapCut guide)](https://www.capcut.com/resource/text-to-speech-on-instagram-reels)
- [Reels captions best practices 2026 (Opus)](https://www.opus.pro/blog/instagram-reels-caption-subtitle-best-practices)
- Instagram app (iOS / Android), reel preview + Edit video.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Core set, produced as an **edit list played live** (no encoding): trim / split / delete / reorder / per-clip speed, add clips, music + start + audio mixer (camera / music / voiceover), voiceover takes, timed text (story text tool), stickers + draw (story tools), Save draft, Download (raw clips). **Dropped:** filters, transitions, effects, text-to-speech, auto captions, sound effects, enhance voice.
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- `app/compose/reel/edit.tsx` (preview + Audio, Text, Stickers, Draw, Voiceover, mixer, ⋯ Save draft / Remove audio; story `TextTool` / `DrawTool` / `EditableElement` / `StickerTray` reused), `timeline.tsx` (clips: trim, speed, split at playhead, move, delete, add; text / sticker timing; voiceover takes; sequence original trim), `voiceover.tsx` (hold to record at the playhead, reel ducked, undo). `RangeSlider`, `VolumeSlider`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
