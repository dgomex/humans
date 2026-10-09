# Page 057 — Highlights viewer

- **Phase:** 5 — Stories
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/stories/highlight/[id].tsx` (reuses the story viewer)
- **Depends on:** `highlights` (page 25), `highlight_items` (this phase), stories archive (page 28 stories part), story viewer (52)

## 1. Research (current Instagram behavior)
### Layout
- Same player as the story viewer: progress bars per item, header with **highlight cover + title** (instead of username), age of each item ("12w"), ⋯, ✕.
- Footer (others): "Send message" reply + ✈ share; no like heart on older items. Footer (own): viewer count only within 48 h of the original story, **Edit highlight**, ⋯ More (Remove from highlight, Send to…, Copy link, Delete highlight).
- Swiping horizontally moves to the **next highlight** of the same profile (not to other users).

### Entry & exit points
- Profile highlights row (page 16/17), a shared highlight link/DM. ✕ / swipe down → profile.
- Long-press a highlight on your profile → Edit highlight / Delete highlight / Send to / Copy link (page 25 editor).
- From an active own story: "Highlight" button → pick existing or New (page 25).

### Features & interactions
- [ ] Play highlight items in order, same gestures as page 52 (tap, hold, swipe).
- [ ] Start from the first item (no "unseen" state for highlights).
- [ ] Audience preserved: Close Friends items only visible to current close friends; private profile → followers only.
- [ ] Own: Remove this item from the highlight; Edit highlight (title, cover, add/remove stories from archive).
- [ ] Deleting a highlight keeps the stories in the archive.
- [ ] Interactive stickers become read-only results after 24 h.

### States
- Highlight with all items hidden from you (CF) → not shown in the row.
- Empty highlight (all items removed) → highlight deleted automatically.

### Sources
- [How to add highlights (Techlicious)](https://www.techlicious.com/tip/how-to-add-highlights-to-an-instagram-profile/)
- [What are Instagram Highlights (Make Tech Easier)](https://maketecheasier.com/what-are-instagram-highlights)
- [Highlights guide (Business Insider)](https://www.businessinsider.nl/how-to-add-highlights-on-instagram)
- See also page 025 research.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Viewer (swipe between the profile's highlights; owner Edit / Remove item / Delete / Copy link; Close Friends items hidden from non-members) + the page 25 editor (archive picker, title, cover from a story or library, add/remove) + the page 28 **stories archive** (grid with date badges, **Calendar** view, Create highlight, "Highlight" from an active story). No Map view.
- **Date:** 2026-10-09

## 3. Data & storage
- `highlight_items (highlight_id, story_id, owner_id, position)`: select needs `can_view_profile(owner)` and `can_view_story(story)` (Close Friends items stay hidden); insert own published stories only; ≤ 100 per highlight; deleting the last item deletes the highlight. `save_highlight(id, title, cover, story_ids[])` creates / updates in one call. `profile_highlights(user)` returns only highlights with a visible item (+ first story thumb as fallback cover). `highlight_reel(id)`. `story_archive()` (own: archived, active or highlighted).
- Covers: `highlights-covers/{owner}/{uuid}.jpg` (square 320 px crop of a story frame or a library photo).

## 4. Implementation notes
- Routes: `app/stories/highlight/[id].tsx` (swipes through the owner's highlights), `app/highlights/new.tsx` + `app/highlights/[id]/edit.tsx` (`HighlightEditor`: archive picker with numbered checks, title, Edit cover; edit has Selected / Stories tabs), `app/archive.tsx` (▾ Stories / Posts archive; stories grid with date badges or Calendar; ⋯ Create highlight, archive settings).
- Profile `HighlightsRow`: tap plays, long-press (own) → Edit / Copy link / Delete. "Highlight" on your active story adds it to an existing or new highlight.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (CF items hidden, other users can't add items, empty highlight removal)
- [x] Supabase advisors clean
