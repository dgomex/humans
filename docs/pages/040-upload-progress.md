# Page 040 — Upload progress / posting state

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** banner component on Home (`app/(tabs)/(home)/index.tsx`) + profile grid placeholder
- **Depends on:** page 36; Home feed itself is Phase 4 (page 43)

## 1. Research (current Instagram behavior)
### Layout
- After Share, the app jumps to **Home**; at the top of the feed a row: small thumbnail · "Posting…" / "Finishing up" · thin **progress bar**.
- Done → row shows "✓ Posted" briefly (and on newer versions a "Send to friends" / share shortcut), then collapses; the new post is first in the feed and on the profile grid.
- Failure → "Couldn't post. Tap to retry" with ⟳ Retry and ⋯ (Discard / Save draft). Retries automatically when the connection comes back.
- Instagram keeps uploading in the background if you leave the app briefly.

### Features & interactions
- [ ] Optimistic placeholder on the profile grid (dimmed tile with spinner).
- [ ] Progress for multi-item uploads (per file).
- [ ] Retry / discard / save as draft.
- [ ] Haptic + toast when done.

### States
- Offline: queued, "Waiting for network".
- App killed mid-upload: the pending post is restored on next launch and resumed / offered to retry.

### Sources
- Instagram app (iOS/Android), posting state.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced, including the persisted queue that resumes after an app restart, auto-retry when back online, Retry / Discard / Save draft on failure.
- **Date:** 2026-10-08

## 3. Data & storage
- `posts.status` uploading → published via `publish_post` (checks every file in storage); `profiles.posts_count` trigger counts published, non-archived posts.

## 4. Implementation notes
- `UploadQueueProvider` (root): per-account queue JSON + media copies in app documents; idempotent steps (client ids, upserted files, duplicate-safe inserts); byte progress with `File.upload` (expo-file-system); auto-retry on reconnect / foreground (expo-network) with backoff; Retry / Save draft / Discard. `UploadBanner` on Home; dimmed placeholder tiles on the own grid.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
