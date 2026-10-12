# Page 064 — Reels comments & share

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** reuses `app/p/[id]/comments`, `app/p/[id]/likes`, PostSheets (share / ⋯ options) over the reel player
- **Depends on:** Phase 4 comments (46), likes list (47), share sheet (48), post options (49), report (50)

## 1. Research (current Instagram behavior)
### Layout
- 💬 opens the **same comments sheet** as posts over the still-playing reel (the video stays visible above the sheet).
- ✈ opens the share sheet: DM recipients grid (Phase 9) + Add to story · Repost · Copy link · Share to… · **Remix** · **Download** (if allowed) · QR code.
- Like count → likers list (47). Repost ⟳ on the rail with a count.

### Entry & exit points
- Reel rail buttons (58), comment notifications (Phase 8). Closing the sheet returns to the reel (playback continues).

### Features & interactions
- [ ] Comments: everything from page 46 (replies, likes, pin ≤3, hide, delete, report, emoji bar), reel keeps playing.
- [ ] Share: Repost / Undo repost (note), Add to story (reel sticker that opens the reel — page 54 post sticker), Copy link `/reel/<id>`, Share to… OS sheet, Remix (63), Download (own reels or when allowed).
- [ ] ⋯ options: page 49 items + Reels items (Remix, captions, playback speed, Why you're seeing this).
- [ ] Rail counts update live after liking / commenting.

### States
- Comments off → "Comments on this reel have been turned off".
- Hidden like counts → ♡ without a number (owner still sees it).

### Sources
- [Watch More Reels / Share buttons (Lindsey Gamble)](https://www.lindseygamble.com/blog/instagram-rolls-out-watch-more-reels-and-share-buttons-for-reels-in-the-feed)
- Phase 4 specs: [046](046-comments.md), [047](047-likes-list.md), [048](048-share-sheet.md), [049](049-post-options.md).
- Instagram app (iOS / Android), reel comments + share.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: Phase 4 comments / likes / options over the playing reel; share = Repost, Add to story (reel sticker), Copy link, Share to…, Remix, Download (own or allowed). DM sending waits for Phase 9.
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- Reuses `app/p/[id]/comments` + `likes` (reel keeps playing underneath) and `PostSheets`: share sheet + Remix / Download, ⋯ + `ReelOptionRows` (Remix, View remixes, Playback speed, Download; own: remix / download toggles), `SpeedSheet`, reel links `/reel/<id>`, story post sticker shows the reel cover.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
