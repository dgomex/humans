# Page 025 — Story Highlights: create / edit / cover selection

- **Phase:** 2 — Profile
- **Status:** Verifying — row built in Phase 2; editor (archive picker, title, cover) built in Phase 5 (see page 057)
- **Route:** `app/highlights/new.tsx`, `app/highlights/[id]/edit.tsx`
- **Depends on:** **stories archive (Phase 5)**: highlights are made of archived stories. `highlights-covers` bucket (Phase 0).

## 1. Research (current Instagram behavior)
### Layout
- **Create:** "New" circle on the profile (or + → Story highlight) → a grid of **archived stories** (by date, with a day/month badge) to multi-select → Next → **title** field (≤15 chars shown) + **Edit cover** → Add/Done.
- **Edit:** long-press a highlight (or ⋯ More inside the viewer) → sheet: Edit highlight, Send to…, Copy link, Delete highlight. Edit screen has tabs **Selected** / **Stories** (archive) to add/remove stories, plus title and cover.
- **Cover:** pick a frame from the highlight's stories or an image from the library; a circular crop with pan/zoom.

### Features & interactions
- [ ] Multi-select archive stories; at least 1 story needed.
- [ ] Title, cover (from a story or from library), reorder highlights.
- [ ] Add to highlight directly from a live story ("Highlight" button in the viewer, Phase 5).
- [ ] Delete highlight (confirm); the stories stay in the archive.
- [ ] Highlights respect audience (close-friends stories show only to close friends).
- [ ] 2026 test: highlights as a grid tab instead of a row.

### States
- Empty archive: "No stories in your archive" with a hint to turn on archiving.

### Sources
- [Highlight covers (Napoleoncat, 2026)](https://napoleoncat.com/blog/instagram-highlight-cover/)
- [Highlights how-to (Sked)](https://skedsocial.com/blog/how-to-make-and-use-instagram-story-highlights.md)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Highlights tables + profile highlights row (and "New" circle) now; the editor (archive picker, title, cover crop) is built in Phase 5 when stories exist. No stories stub.
- **Date:** 2026-10-08

## 3. Data & storage
- `highlights (id, owner_id, title, cover_path, position, created_at)`, `highlight_items (highlight_id, story_id, position)`.
- Needs `stories` (Phase 5) as the source; otherwise a minimal `stories` stub.
- `highlights-covers` bucket: `{user_id}/{highlight_id}.jpg`.

## 4. Implementation notes
- `HighlightsRow` (row + "New") and `highlights` table in Phase 2. Phase 5: `HighlightEditor` (`app/highlights/new.tsx`, `app/highlights/[id]/edit.tsx`), `highlight_items`, `save_highlight()`, covers from a story frame or the library, long-press menu on the row.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
