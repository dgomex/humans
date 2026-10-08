# Page 037 — Tag people

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/create/tag-people.tsx` (also used from Edit post, page 41)
- **Depends on:** page 36; `profiles`, `follows`

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ · "Tag people" · **Done**.
- The photo full-width; "Tap photo to tag people" hint. Carousels: swipe between slides; tags are per slide.
- Tap a point → search sheet ("Search for a user") with recent/suggested accounts → pick → a black **tag bubble** with the username appears at that point. Drag a bubble to move it; tap ✕ on it to remove.
- Videos can't have positioned tags: tagged people are listed below instead ("Tag people" list).
- Bottom: "Add collaborator" shortcut.

### Features & interactions
- [ ] Up to **20 tags** per post.
- [ ] Position (x, y as 0–1 fractions) per slide.
- [ ] Tags appear on the tagged user's **Tagged** profile tab (Phase 2 tab, now filled); tagged users get notified (Phase 8) and can remove themselves (Phase 4 options).
- [ ] Privacy: who can tag you (Phase 11 setting, page 96).

### States
- Search empty / no results; limit reached toast.
- Can't tag people who blocked you (Phase 11).

### Sources
- [Edit post: tags (Tailwind)](https://www.tailwindapp.com/blog?p=5273)
- [Edit post (Bustle)](https://www.bustle.com/life/how-to-edit-instagram-post-carousel-live)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: positioned tags per slide, ≤20, list for video slides, self-untag.
- **Date:** 2026-10-08

## 3. Data & storage
- `post_tags (post_id, media_id, tagged_user_id, x, y)`; author inserts/moves/removes, the tagged user can remove themselves; ≤20 people. Fills the profile Tagged tab (`profile_posts(kind = tagged)`).

## 4. Implementation notes
- `TagEditor` (tap → `PersonSearchSheet`, draggable bubbles, list for video slides), used by `app/compose/tag-people.tsx` and the Edit post modal.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
