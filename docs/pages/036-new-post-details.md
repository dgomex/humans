# Page 036 — New post details (caption, tag people, location, music, alt text, advanced settings)

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/create/details.tsx`
- **Depends on:** pages 32–35; `profiles`, `follows` (mention / tag suggestions)

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ · "New post" · (Android ✓).
- Media preview (thumbnail strip for carousels) at the top.
- **Caption** field ("Add a caption…"), up to **2,200** characters, max **30 hashtags** and **20 @mentions**; typing `@` / `#` shows a suggestion list over the screen. Chips below the field on newer versions: "# Hashtags", "@ Mention", "Poll" (prompts).
- Rows (each opens a sub-screen):
  - **Tag people** (page 37) — shows count / names when set.
  - **Add collaborators** (invite up to 5 co-authors; they accept, the post shows on both profiles).
  - **Add location** (page 38) + quick-pick chips of nearby places.
  - **Add music** (page 39) — photos and carousels can carry a song.
  - **Audience**: Everyone / Close Friends (2025 test, close-friends-only posts).
  - **Also share on…** Facebook / Threads (Meta).
  - **More options / Advanced settings**: Hide like and view counts on this post; Turn off commenting; **Write alt text** (per slide); Allow sharing to stories / messages; Branded content (business).
- Footer: big blue **Share** button.

### Entry & exit points
- From Filters & edit (35). Share → back to Home with the upload bar (page 40). Back → edit screen. ✕/back from the flow → "Save draft?" (42).

### Features & interactions
- [ ] Caption with mention/hashtag autocomplete, limits, link-ifying in the feed (Phase 4).
- [ ] Tag people, collaborators, location, music, alt text, advanced toggles.
- [ ] Mentioned and tagged users are notified (Phase 8).

### States
- Share disabled while required media is still processing. Over-limit caption → counter turns red.

### Sources
- [Hide like counts per post (Stack Influence)](https://stackinfluence.com/blog/how-to-hide-likes-on-instagram-guide)
- [Edit post: tags, alt text, location (Tailwind)](https://www.tailwindapp.com/blog?p=5273)
- Instagram app (iOS/Android), new post screen.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Keep caption (2,200, ≤30 hashtags, ≤20 mentions) with @/# autocomplete, Tag people, **Collaborators** (≤5, accept/decline), **Audience** (Everyone / Close Friends), Music (page 39), Advanced: hide like/view counts, turn off commenting, alt text per slide. **Dropped:** Facebook/Threads sharing, location (page 38 dropped).
- **Date:** 2026-10-08

## 3. Data & storage
- `posts`, `post_media`, `post_collaborators`, `post_mentions`, `hashtags`/`post_hashtags` (stub), see the schema registry. RLS via `can_view_post`; posts bucket select policy `posts_select_viewer`.

## 4. Implementation notes
- `app/compose/{details,collaborators,advanced,alt-text}.tsx`, `CaptionInput` (@ → `search_profiles`, # → `hashtags`; caret inferred from edits on web), audience sheet. Share → `UploadQueue.enqueue` → close the modal → Home.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
