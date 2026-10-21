# Page 080 — Media viewer in chat (incl. view-once)

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/media/[messageId].tsx` (transparent full-screen modal)
- **Depends on:** page 76, `messages` bucket, Phase 4 `ZoomOverlay`

## 1. Research (current Instagram behavior)
### Layout
- Full-screen black background; header: sender avatar + name + time, ✕; footer: **Reply** field / quick reactions, ⋯ (Save, Forward, Unsend, Report).
- Carousels of several photos sent together swipe horizontally.
- **View-once / replay media:** bubble shows "Photo" / "Video" with a ▶ icon and "Tap to view"; after opening: "Opened" (or "Replayed"); sender sees "Opened" / "Screenshot". No save / forward. Media taken with the in-chat camera defaults to **View once**, with a toggle **View once · Allow replay · Keep in chat** before sending.

### Entry & exit points
- Tap a photo / video bubble in the thread (76); swipe down or ✕ closes.

### Features & interactions
- [ ] Pinch zoom (photos), video playback with sound + scrub.
- [ ] Double-tap ❤️ react, reply from the viewer.
- [ ] Save to device (normal media only), Forward.
- [ ] View-once: server marks it opened for that viewer; can't be reopened (replay allows one more view); files deleted once every recipient has opened (or after 14 days in Instagram's rules).
- [ ] Screenshot notification for disappearing media (iOS can detect; Android only via FLAG_SECURE blocking).

### States
- Loading: blurred thumbnail + spinner; Error: "Couldn't load media. Tap to retry"; expired / opened: "Photo · Opened".

### Sources
- [Instagram Help — Vanish mode / disappearing media](https://help.instagram.com/android-app/888592124998543)
- [Socialz — vanish mode vs view once](https://socialz.ai/blog/what-does-vanish-mode-mean-on-instagram)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Zoom, save, forward; View once / Allow replay / Keep in chat; screenshot notice where the OS allows.
- **Date:** 2026-10-13

## 3. Data & storage
- `messages.view_mode` keep / once / replay. `open_message_media` registers the view (1 or 2 allowed) and the storage policy lets that viewer read the file for 5 minutes; 14-day expiry. `message_views.screenshot_at` via `note_screenshot`. Used-up / expired / orphaned files are deleted by the uploader's app on launch (`my_purgeable_message_files`).

## 4. Implementation notes
- Files: `app/direct/media/[messageId].tsx` (transparent modal, swipe down to close, Save / Forward for kept media), `src/features/direct/media.ts` (picker / camera / 1440 px downscale), `saveMedia(.web).ts`. Screenshot listener: `expo-screen-capture` (iOS / Android 14+; none on web).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
