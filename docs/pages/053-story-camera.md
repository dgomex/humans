# Page 053 — Story camera

- **Phase:** 5 — Stories
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/story/camera.tsx` (full-screen modal)
- **Depends on:** Phase 3 camera (page 33, `expo-camera`), OS picker (page 32), story editor (page 54)

## 1. Research (current Instagram behavior)
### Layout
- Full-screen viewfinder. **Top:** ✕ · flash · settings gear (Story settings).
- **Left rail (tools):** **Aa Create** (text-only / templates / prompts), **Boomerang**, **Layout** (2–6 photo grid), **Hands-free** (record without holding), **Dual** (front + back), timer, retouch, a ▾ for more.
- **Bottom:** gallery thumbnail (last photo → picker with "Recents", multi-select up to 10 → one story each), large **shutter** surrounded by a **carousel of AR effects**, flip camera. Under it the mode switcher **POST · STORY · REEL · LIVE**.
- Swipe right from Home (or tap the "Your story" circle / + ) opens the story camera.

### Entry & exit points
- Home tray "Your story" (+), swipe from Home, Create (+) → STORY mode, share sheet "Add to story" (post sticker, page 48), reply to a story with a story ("Add yours", mention reshare).
- After capture/pick → story editor (page 54). ✕ → back.

### Features & interactions
- [ ] Tap = photo, hold = video (stories are split into 60 s segments; up to ~60 s per clip shown as one story each).
- [ ] Flip (button + double-tap), flash, pinch zoom, tap to focus (same as page 33).
- [ ] Library: recent photos/videos from the last 24 h on top; multi-select up to 10 → posted as separate stories.
- [ ] **Create mode:** colored/gradient background with text, "Add yours" templates, polls/questions without a photo.
- [ ] **Boomerang:** burst of frames played forward/backward (variants Slowmo, Echo, Duo).
- [ ] **Layout:** 2–6 cell grid filled one photo at a time.
- [ ] **Hands-free:** tap once to start/stop recording.
- [ ] **AR effects/filters** carousel (Spark AR) — closed platform.
- [ ] Haptic on capture; camera + microphone permissions.

### States
- Permission denied → "Allow access to camera" with Settings link (reuse page 33).
- No camera (web/simulator) → library-only + Create mode.

### Sources
- [Boomerang modes and Layout (Search Engine Journal)](https://searchenginejournal.com/instagram-is-working-on-layouts-for-stories-new-boomerangs-more/321423)
- [New Boomerang effects and Layout (newsfeed.org)](https://newsfeed.org/?p=18719)
- [Instagram Stories tips 2026 (Hootsuite)](https://blog.hootsuite.com/instagram-stories/)
- Instagram app (iOS/Android), story camera.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Phase 3 camera (tap / hold, flip, flash, zoom, focus) + Library (multi-select ≤10, one story each) + **Create** (text on colour/gradient) + **Boomerang**, **Layout** (2–6 photo grid) and **Hands-free**. No AR effects.
- **Date:** 2026-10-09

## 3. Data & storage
- None directly: captures go to the editor; files are uploaded by the story upload queue (page 54).

## 4. Implementation notes
- Route `app/story/camera.tsx` inside the `app/story` modal stack (`StoryComposerProvider`).
- Modes: normal (tap photo, hold video ≤ 60 s), Create (gradient + text → editor with the text tool), Boomerang (hold the shutter: photos are burst-captured until release, 3–20 frames, played forward / back by `StoryBase`; no video encoding), Layout (5 grids, cells filled from the camera or the library, tap a cell to retake), Hands-free (tap to start / stop recording). Library: OS picker, ≤ 10, one story each.
- Shortcuts: `?postId=` (share sheet "Add to story" → post sticker), `?answerPrompt=&answerBody=` (share a question answer), `?chain=&prompt=` (Add yours).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending: camera, mic, burst speed)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; camera UI is always dark)
- [x] RLS tested with two users (n/a: no own tables)
- [x] Supabase advisors clean
