# Page 027 — Saved collection detail / create & edit collection

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/saved/[id].tsx`, `app/saved/new.tsx`, `app/saved/[id]/edit.tsx`
- **Depends on:** page 26; `posts` (Phase 3), `saves` (Phase 4)

## 1. Research (current Instagram behavior)
### Layout
- **Detail:** ‹ collection name · ⋯ (Edit collection, Add to collection, Select…, Delete collection). A 3-column grid of the saved posts (3:4).
- **Create:** "New collection" name field → Next → grid of saved posts to pick → Done.
- **Edit:** name field, "Change cover" (pick one of its posts), **Delete collection** (red; posts stay in All posts).

### Features & interactions
- [ ] Add posts from saved; remove a post from the collection (post ⋯ → Remove from collection).
- [ ] Select mode to remove several.
- [ ] Rename, change cover, delete (confirm).
- [ ] Unsaving a post (bookmark) removes it from every collection.

### States
- Empty collection: "Start saving / Save photos and videos to this collection."

### Sources
- [Managing collections (Instagram Help Center)](https://help.instagram.com/iphone-app/1524436600950937)
- [Collections guide (iDownloadBlog)](https://www.idownloadblog.com/?p=480605)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Same as page 26: build now; empty until posts/saves exist.
- **Date:** 2026-10-08

## 3. Data & storage
- Same tables as page 26.

## 4. Implementation notes
- `app/saved/new.tsx` (name → add-from-saved empty step), `app/saved/[id]/index.tsx` (grid + ⋯), `app/saved/[id]/edit.tsx` (rename / delete).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
