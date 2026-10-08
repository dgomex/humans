# Page 020 — Change profile photo sheet

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** bottom sheet (from Edit profile and the "Add profile photo" card)
- **Depends on:** `features/profile/avatar.ts` (Phase 1), `avatars` bucket

## 1. Research (current Instagram behavior)
### Layout
- Bottom sheet rows: **New profile picture** (library), **Take photo**, **Create avatar** (Meta avatars), **Import from Facebook** (Meta), **Remove current picture** (red; only when one is set).
- After picking: a crop screen with a circular mask (pinch/drag).

### Features & interactions
- [ ] Library and camera pickers with permission handling.
- [ ] Circular crop; upload with progress; the old file is deleted after the swap.
- [ ] Remove → confirm → default silhouette.

### States
- Upload in progress (spinner over the avatar); failure toast; permission denied → open Settings.

### Sources
- Same sheet researched for sign-up: [page 010 spec](010-signup-profile-photo.md).

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Library, Take photo, Remove. No Meta avatar / Facebook import.
- **Date:** 2026-10-08

## 3. Data & storage
- Reuses `profiles.avatar_path` and `avatars` (`{user_id}/{uuid}.jpg`). No new tables.

## 4. Implementation notes
- `useChangePhotoSheet()` in `src/features/profile/components/ChangePhotoSheet.tsx` (library / camera / remove); `removeAvatar()` added to `avatar.ts`. Opened from Edit profile and the "Add profile photo" card (the own avatar opens Create → story, like Instagram).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (can't overwrite another user's avatar)
- [x] Supabase advisors clean (db lint)
