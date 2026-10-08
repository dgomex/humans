# Page 041 — Edit existing post

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/p/[id]/edit.tsx`
- **Depends on:** pages 36–38; a post view with ⋯ menu (post detail = page 44, Phase 4)

## 1. Research (current Instagram behavior)
### Entry
- Own post → ⋯ → **Edit** (other own-post options: Archive, Delete, Hide like count, Turn off commenting, Pin to profile, Share to…, Adjust preview / grid crop).

### Layout
- Header: Cancel · "Edit info" · **Done** (iOS) / ✕ · ✓ (Android).
- Author row + "Add location" / current location at the top.
- The media (carousel swipeable) with **Tag people** (bottom-left) and **Edit alt text / Aa** (bottom-right) buttons.
- Caption field below.
- Carousels: **delete individual slides** (trash on each slide; at least one must remain) and, since March 2026, **long-press and drag to reorder**. Adding new slides is **not** possible.

### Features & interactions
- [ ] Edit caption, location, tags, alt text.
- [ ] Remove carousel items; reorder carousel items.
- [ ] Likes/comments are kept.
- [ ] Archive (hide from profile; Archive page 28, posts part) / Delete (moves to **Recently deleted** for 30 days, page 29).

### States
- Saving spinner; failure toast keeps the edits.

### Sources
- [Reorder carousels after posting (Social Media Today, 2026)](https://www.socialmediatoday.com/news/instagram-allows-users-to-rearrange-carousel-posts/815490/)
- [Edit carousel without losing likes (Inquirer)](https://technology.inquirer.net/145730/you-can-now-edit-carousel-posts-on-instagram-without-losing-likes/amp)
- [How to edit Instagram posts (Tailwind)](https://www.tailwindapp.com/blog?p=5273)
- [Edit carousels (Bustle)](https://www.bustle.com/life/how-to-edit-instagram-post-carousel-live)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Edit caption, tags, alt text; delete and reorder carousel slides; Hide like count; Turn off commenting; **Archive + posts archive** (posts part of page 28); **Pin to profile** (≤3). **No Recently deleted**: Delete is immediate. A minimal own-post viewer stub (page 44) opens from grid tiles.
- **Date:** 2026-10-08

## 3. Data & storage
- Own `posts` updates (caption → edited_at; archived_at; pinned_at ≤3; hide_like_counts; comments_disabled), `post_media` delete/alt text, `reorder_post_media`, `post_tags` diff. Delete removes the row then its files.

## 4. Implementation notes
- `app/p/[id]/index.tsx` (STUB of page 44: carousel, tags, music, caption, ⋯ menu, collab invite banner), `app/p/[id]/edit.tsx`, `app/archive.tsx`, `app/collab-invites.tsx` (stub), ☰ menu entries.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
