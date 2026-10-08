# Page 039 — Music picker

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/create/music.tsx` (sheet)
- **Depends on:** page 36. Audio page (62) and reels audio are Phase 6; stories music Phase 5.

## 1. Research (current Instagram behavior)
### Layout
- Bottom sheet: search field "Search music"; tabs **For you · Trending · Saved · Original audio**.
- Rows: cover art, title, artist, duration, ▶ preview, bookmark (save).
- Pick a song → **clip selector**: waveform/lyrics scrubber to choose a 5–90 s segment (photos default 15–30 s), Done.
- The post shows "♪ Artist · Song" under the username; the clip loops while the post is on screen (muted by default in the feed).

### Features & interactions
- [ ] Search + browse a licensed catalog; preview playback.
- [ ] Segment selection.
- [ ] Saved audio (shared with the Saved page's Audio tile, Phase 6).
- [ ] Business accounts limited to royalty-free (out of scope).

### States
- "Music isn't available in your region / for this account".
- Loading previews; offline.

### Sources
- Instagram app, Add music on photo posts.
- [Instagram 2025 feature updates (Preview)](https://thepreviewapp.com/new-instagram-features-updates-2025/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Royalty-free seed catalog in a public `audio` bucket with the full picker (search, For you / Saved, preview, clip start). Tracks are **generated placeholder loops** (synthesized by a script, no downloads); real CC0 tracks can replace them later.
- **Date:** 2026-10-08

## 3. Data & storage
- `audio_tracks`, `saved_audio`, public `audio` bucket; `posts.audio_track_id` + `audio_start_ms` (15 s clip). Catalog seeded by `scripts/seed-audio.mjs` (8 synthesized loops, `source = placeholder`).

## 4. Implementation notes
- `app/compose/music.tsx` (For you / Saved, search, ▶ preview, bookmark, clip window drag), `expo-audio`. The post view plays the clip from ♪ Artist · Title.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
