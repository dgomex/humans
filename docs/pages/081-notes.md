# Page 081 — Notes (create / view)

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/note.tsx` (create sheet); view sheet in the inbox / profile
- **Depends on:** page 74 (notes row), `follows`, `close_friends`, audio catalog (Phase 3)

## 1. Research (current Instagram behavior)
### Layout
- **Create:** your avatar with an editable speech bubble "Share a thought…", 60-character counter, ♪ **Add music** (song + 30 s clip), audience chip **Followers you follow back** / **Close Friends**, **Share**.
- **View (someone's note):** sheet with avatar, bubble, name, age, ♥ like, "Reply to x…" field (reply = DM to the author only).
- **Own note:** sheet "Leave a new note", **Delete note**, list of people who liked it.
- Notes also show above the avatar on the profile (for the same audience).

### Entry & exit points
- Inbox notes row (74), own profile avatar bubble, others' profiles.
- Reply → 1:1 thread with the note quoted.

### Features & interactions
- [ ] Text (≤60 chars, emoji count) and/or music.
- [ ] Lasts 24 h; one active note per person (new one replaces).
- [ ] Audience: mutual followers or Close Friends; no notification on posting; no viewers list.
- [ ] Likes (author sees who liked), replies into DMs; @mentions in notes.
- [ ] (Video notes — 2 s looping selfie video; location notes / friend map — out of scope candidates.)

### States
- Empty row: only your bubble ("Note…").
- Edge cases: author becomes private / unfollows → note hidden; expired notes disappear.

### Sources
- [Instagram Help — Notes](https://help.instagram.com/mobile-basic/427590629371317)
- [Metricool — How to use Instagram Notes](https://metricool.com/instagram-notes/)
- [Fonearena — Music and translation in Notes](https://www.fonearena.com/blog/396072/instagram-notes-music-translation.html/amp)
- [Peekstories — Notes privacy 2026](https://peekstories.com/blog/instagram-notes-privacy-who-sees-what-2026)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** 60 chars + music, mutuals / Close Friends, 24 h, likes, reply into DMs, shown on profiles. No video notes, no location notes / friend map.
- **Date:** 2026-10-13

## 3. Data & storage
- `notes` (≤60 chars and/or a catalog song + start, audience mutuals / close_friends, 24 h, one per author), `note_likes`; `can_view_note`; `notes_tray()`, `note_likers(note)`. Note replies are text messages with `note_id` + a snapshot in `data.note`. Expired notes are purged by the cron job.

## 4. Implementation notes
- Files: `app/direct/note.tsx` (composer with the MusicPicker), `src/features/direct/components/Notes.tsx` (`NotesRow`, `NoteSheet` with ♥ / reply / likes / Leave a new note / Delete, `ProfileNote` bubble above profile pictures).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
