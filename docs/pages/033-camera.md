# Page 033 — Camera (photo/video capture)

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/create/camera.tsx`
- **Depends on:** page 32 (composer). Story/Reel cameras (pages 53, 59) reuse it later.

## 1. Research (current Instagram behavior)
### Layout
- Full-screen viewfinder. Top: ✕ · flash (off / on / auto) · settings gear.
- Bottom: large white **shutter** (tap = photo, hold = video with a red progress ring), gallery thumbnail (bottom-left, back to the picker), **flip camera** (bottom-right).
- Post-mode camera is simple; effects, timer, layout and Boomerang belong to the Story/Reel cameras.

### Entry & exit points
- Camera button in the picker (page 32). After capture → Filters & edit (page 35) with the captured media as the only item. ✕ → back to the picker.

### Features & interactions
- [ ] Photo capture (tap), video capture (press and hold, up to 60 s for posts).
- [ ] Front/back flip (button and double-tap on the viewfinder).
- [ ] Flash modes; pinch to zoom; tap to focus.
- [ ] Saves captures to the device library (setting).
- [ ] Haptic on capture.

### States
- Permission prompts for camera (and microphone for video); denied → "Allow camera access" screen with a Settings link.
- No camera (simulator / web): message.

### Sources
- [Expo Camera docs](https://docs.expo.dev/versions/latest/sdk/camera/)
- Instagram app (iOS/Android), post camera.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: tap = photo, hold = video (≤60 s), flip (button + double-tap), flash off/on/auto, pinch zoom, tap to focus.
- **Date:** 2026-10-08

## 3. Data & storage
- None (device capture only). Microphone permission added to `app.json` (expo-camera `recordAudioAndroid`, iOS `microphonePermission`).

## 4. Implementation notes
- `app/compose/camera.tsx`: `CameraView` (picture ↔ video mode on long press), SVG progress ring, pinch zoom (gesture → `zoom`), double-tap flip, tap shows the focus square (expo-camera focuses continuously; no point-of-interest API). Video size comes from the poster frame.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
