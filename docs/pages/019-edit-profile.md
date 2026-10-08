# Page 019 — Edit Profile

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/profile/edit.tsx` + field editors `app/profile/edit/[field].tsx`
- **Depends on:** `profiles`, avatar pipeline (`features/profile/avatar.ts`)

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ / Cancel · "Edit profile".
- Top: the avatar (with the Meta avatar beside it) and "Edit picture or avatar" → page 20.
- Rows (label + value, each opens a single-field editor): **Name**, **Username**, **Pronouns**, **Bio**, **Links**, **Banners** (2026 pill banner: links + featured song), **Music**, **Gender**.
- Further down: "Show Threads badge" (Meta), "Switch to professional account" (out of scope), "Personal information settings" (Accounts Center, Meta).

### Entry & exit points
- Edit profile button (page 16); "Complete your profile" cards.

### Features & interactions
- [ ] **Name:** ≤64 chars; may be changed twice within 14 days.
- [ ] **Username:** live availability check (page 8 RPC); limited to 2 changes per 14 days; the old username is held for 14 days so you can revert.
- [ ] **Pronouns:** up to 4 from a list; "Show to followers only" toggle.
- [ ] **Bio:** 150 chars with counter; @mention / #hashtag autocomplete.
- [ ] **Links:** up to 5 (URL + optional title); add, edit, reorder, delete.
- [ ] **Gender:** Female / Male / Custom (free text) / Prefer not to say. Never shown publicly.
- [ ] **Music:** song shown on profile (needs `audio_tracks`, Phase 3).
- [ ] Discard-changes prompt on back.

### States
- Saving spinner; per-field validation errors; offline error toast.

### Sources
- [Pronouns (Instagram Help Center)](https://help.instagram.com/iphone-app/3936623839758564)
- [Pronouns launch (TechCrunch)](https://techcrunch.com/?p=2150772)
- [Profile banners (Tagembed)](https://tagembed.com/blog/instagram-updates/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Minimal fields: Name, Username, Bio (150), Links (≤5), photo, plus the temporary Private toggle. Dropped: pronouns, gender, music, banners, Threads badge, professional account. No 14-day name/username change limits.
- **Date:** 2026-10-08

## 3. Data & storage
- `profiles`: `bio` (≤150), `pronouns text[]` (≤4), `pronouns_followers_only`, `links jsonb` (≤5 `{url,title}`).
- `account_private`: `gender`, `gender_custom` (owner-only).
- `username_changes` table + `change_username()` RPC for the 14-day rules.

## 4. Implementation notes
- `app/edit-profile/index.tsx` (rows + Private switch), `app/edit-profile/[field].tsx` (name / username with live availability / bio 150), `app/edit-profile/links.tsx` (≤5 links, add/edit/remove). Username rules shared in `src/features/auth/username.ts`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (can't edit another profile; gender not readable by others)
- [x] Supabase advisors clean (db lint)
