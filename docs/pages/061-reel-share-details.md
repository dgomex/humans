# Page 061 — Reel share details

- **Phase:** 6 — Reels
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/reel-create/details.tsx` (+ cover picker)
- **Depends on:** page 36 details screen (caption input, tag people, collaborators, audience, advanced), upload queue (page 40), drafts (page 42)

## 1. Research (current Instagram behavior)
### Layout
- Header "New reel" with back. Top: the reel's **cover** (9:16) with "Edit cover", and a caption field ("Write a caption and add hashtags…") with @/# autocomplete.
- Rows: **Tag people** · Add location · **Collaborators** · Rename audio (original audio only) · **Audience** (Everyone / Close Friends) · Link a reel ("Watch part 2", 2025) · **Trial** toggle (non-followers first, 2024+) · Share to Facebook / Threads · **Advanced settings** (hide like & view counts, turn off commenting, allow remixing, allow downloads, high-quality upload, AI label…).
- Bottom: **Save draft** and **Share**.

### Entry & exit points
- From the editor (60). Back → editor (state kept). Share → upload banner (page 40) → the reel shows in the Reels tab, the profile Reels tab and the profile Grid.
- Edit cover → scrub to a frame or "Add from camera roll"; 3:4 grid crop preview.

### Features & interactions
- [ ] Caption ≤2,200 chars, ≤30 hashtags, ≤20 mentions (post rules).
- [ ] Cover: any frame or an uploaded image; adjustable 3:4 grid crop.
- [ ] Tag people (list, no positions on video), collaborators (≤5), audience (Everyone / Close Friends).
- [ ] Original audio named "<username> · Original audio"; rename.
- [ ] Allow remixing (per reel, default from settings), hide like/view counts, turn off commenting.
- [ ] Linked reel ("Watch part 2" button).
- [ ] Trial reels (shown to non-followers first).
- [ ] Save draft; Share uploads in the background (persisted queue).

### States
- Uploading / failed (Retry, Save draft, Discard) → page 40 banner.
- Caption over limits → inline error.

### Sources
- [Reel covers guide (Socialkit)](https://socialk.it/en/blog/instagram-reel-covers-guide)
- [Reel size / cover crops 2026 (Socialkit)](https://socialk.it/en/sizes/instagram-reel-size)
- [Linking Reels (Vaizle, 2025-08)](https://insights.vaizle.com/news/instagram-adds-linking-reels-so-viewers-can-tap-straight-to-the-next-part/)
- [Remix permissions (Storrito)](https://storrito.com/resources/reels-remix-instagram)
- Instagram app (iOS / Android), New reel screen.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Caption (post rules) with @/#, cover = frame or library image with 3:4 grid crop, Tag people (list), Collaborators (≤5), Audience (Everyone / Close Friends), original audio + Rename, Link a reel (Watch part 2), Advanced: hide like & view counts, turn off commenting, allow remixing, allow downloads; Save draft; background upload queue. **Dropped:** location, trial reels, Facebook / Threads, AI label, high-quality toggle.
- **Date:** 2026-10-09

## 3. Data & storage
- `posts` with `kind = 'reel'` (single-video posts too): `reel` edit document, `cover_path` + `cover_offset`, `play_count`, `allow_remix`, `allow_download`, `remix_of` + `remix_layout`, `linked_reel_id`. Clips are `post_media` rows (≤ 50, ≤ 3 min each, total ≤ 3 min).
- Visibility: `can_view_post` (unchanged); files in the `posts` bucket (`{author}/{post}/…`, cover, voiceovers) use `can_view_post_object`.
- `reel_plays` + `record_reel_play`, `reels_feed`, `profile_posts('reels')`, `post_cards` reel fields; original audio in `audio_tracks` (`source = 'original'`), `audio_page`, `audio_reels`, `reel_remixes`, `my_reels`, `rename_original_audio`; reports on `audio`.
- Migration: `supabase/migrations/20261009113103_phase6_reels.sql`. No Realtime / Edge Functions.

## 4. Implementation notes
- `app/compose/reel/details.tsx` (caption, cover, tags list, collaborators, audience, audio / rename, Link a reel, advanced toggles, Save draft / Share) and `cover.tsx` (frame scrub or library photo, 3:4 grid window). `UploadQueue` uploads clips + posters, cover, voiceovers, writes the edit document and names the original audio after publishing.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the reel viewer and camera are always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-reels-rls.mjs`, 65 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
