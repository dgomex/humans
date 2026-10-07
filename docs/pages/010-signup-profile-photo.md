# Page 010 — Sign up: add profile photo

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/photo.tsx`
- **Depends on:** page 9 (profile exists); `avatars` bucket; `src/lib/storage.ts`

## 1. Research (current Instagram behavior)
### Layout
- Title "Add a profile picture". Text: "Add a profile picture so your friends know it's you. Everyone will be able to see your picture."
- A large circular placeholder silhouette.
- A blue "Add picture" button and a "Skip" text button.
- After a photo is picked: the photo appears in the circle, the title becomes "Profile picture added", a toggle "Share as a post" ("Share this picture as your first post"), a "Done" button, and "Change picture".

### Entry & exit points
- Terms → photo → find contacts / follow suggestions (page 11). "Skip" goes to page 11.
- "Add picture" opens a sheet: "Take photo", "Choose from library" ("Import from Facebook" is Meta-only).

### Features & interactions
- [ ] Camera / library picker with a square → circle crop.
- [ ] Upload with progress; the avatar is replaced atomically.
- [ ] "Share as a post" toggle creates the first post (needs Phase 3 `posts`).

### States
- Loading: upload spinner over the circle.
- Error: upload failure toast "Couldn't upload photo. Try again."
- Edge cases: camera or library permission denied, which opens a sheet explaining how to enable it in Settings.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753) ("Add a profile picture… share your profile picture as your first post").

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Full clone, minus "Import from Facebook". "Share as a post" toggle ships disabled until Phase 3 provides `posts`.
- **Date:** 2026-10-05

## 3. Data & storage
- `avatars/{user_id}/{uuid}.jpg` (Phase 0 bucket and policies); `profiles.avatar_path`.
- "Share as a post" depends on `posts` (Phase 3).

## 4. Implementation notes
- `expo-image-picker` (`allowsEditing`, aspect 1:1), `expo-image-manipulator` to resize to 320 px JPEG. Shared `useChangeAvatar` hook (reused by page 20).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (B can't overwrite A's avatar or profile)
- [ ] Supabase advisors clean
