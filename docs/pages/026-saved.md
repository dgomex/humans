# Page 026 — Saved (collections list)

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/saved/index.tsx`
- **Depends on:** `saves` (Phase 4: the bookmark on posts) and `posts` (Phase 3). Empty states until then.

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ "Saved" · **+** (new collection).
- A 2-column grid of collection tiles. Each tile is a 2×2 mosaic of the latest saved posts in it, with the name below. The first tiles are **All posts** and **Audio** (saved sounds); then the user's collections.
- Collaborative collections (shared with people from DMs) show stacked avatars.

### Entry & exit points
- ☰ → Saved (from the own profile); long-press the bookmark on a post → "Save to…" sheet (Phase 4).
- Tile → collection detail (page 27).

### Features & interactions
- [ ] All posts: every saved post, newest first.
- [ ] Audio: saved sounds (needs Phase 6 audio).
- [ ] + → name the collection → choose saved posts → Done.
- [ ] Collections are private (only the owner sees them).
- [ ] Collaborative collections (invite from DMs; Phase 9).

### States
- Empty: "Save photos and videos that you want to see again. No one is notified, and only you can see what you've saved."

### Sources
- [Saved collections (Instagram Help Center)](https://help.instagram.com/iphone-app/1524436600950937)
- [Introducing collections (Instagram)](https://about.instagram.com/blog/announcements/introducing-new-ways-to-organize-your-saved-posts)
- [Collaborative collections (ContentStudio)](https://contentstudio.io/blog/instagram-collaborative-collections)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Build now with empty states. No Audio tile (Phase 6) and no collaborative collections (Phase 9). Post FKs added when posts exist (Phase 3); saves come from Phase 4.
- **Date:** 2026-10-08

## 3. Data & storage
- `saved_collections (id, owner_id, name, cover_post_id, created_at)` and `saved_collection_items (collection_id, post_id, created_at)`; owner-only RLS.
- `saves (user_id, post_id)` belongs to Phase 4. `post_id` FKs are added when `posts` exists (Phase 3).

## 4. Implementation notes
- `app/saved/index.tsx` (All posts + collection tiles), `src/features/saved/{api.ts,CollectionTile.tsx}`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (collections invisible to others)
- [x] Supabase advisors clean (db lint)
