# Page 055 — Story audience / share options

- **Phase:** 5 — Stories
- **Status:** Verifying (built; on-device check pending)
- **Route:** editor footer + `app/story/share.tsx` ("Send to" sheet)
- **Depends on:** `close_friends` (page 30), story editor (54); DMs (Phase 9) for sending to chats; Settings (Phase 11, page 97) for story controls

## 1. Research (current Instagram behavior)
### Layout
- Editor footer: **Your story** (avatar) · **Close Friends** (green star circle) · **→** arrow.
- **Send to** screen (→): rows **Your story** (with ⚙ "Story settings"), **Close Friends** (with "Edit" → list, page 30), then a search field and a list of DM chats/people with "Send" buttons; footer "Share" / "Done".
- Close Friends stories show a **green ring** in the tray and a green "Close Friends" badge in the viewer.

### Entry & exit points
- From the editor (54). Close Friends "Edit" → page 30. Story settings ⚙ → page 97 (Phase 11).
- After share → back to Home with "Your story" uploading.

### Features & interactions
- [ ] Share to **Your story** (followers / everyone for public accounts) or **Close Friends** only.
- [ ] Send the story as a DM to selected chats (Phase 9).
- [ ] **Hide story from** (exclude specific followers) — story setting.
- [ ] Allow replies: everyone / people you follow / off; allow resharing to stories / messages.
- [ ] Save story to archive (on by default), save to device.
- [ ] Private account: only approved followers see stories.

### States
- Empty Close Friends list → tapping it opens the list editor first.

### Sources
- [Close Friends launch (BetaNews)](https://betanews.com/2018/11/30/instagram-close-friends)
- [What is Close Friends (Inro)](https://www.inro.social/blog/what-are-instagram-close-friends)
- Instagram app (iOS/Android), story share options.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Your story / Close Friends (+ Edit list) and "Send to" screen (DM chats wait for Phase 9), **plus full story settings now**: Hide story from, replies (everyone / people you follow / off), allow resharing to stories, save to archive. Page 97 (Phase 11) later links to the same screen.
- **Date:** 2026-10-09

## 3. Data & storage
- `stories.audience` (everyone / close_friends), `story_settings` (replies everyone / following / off, allow_resharing, save_to_archive; owner-only RLS; defaults when no row), `story_hidden_from` (owner-only; enforced in `can_view_story`, so stories, highlights and files disappear for hidden people).
- `story_replies_allowed(author, sender)` checks the replies setting; `publish_story` copies save_to_archive into `stories.keep_in_archive`; `my_purgeable_stories()` lists expired unarchived stories, removed on launch.

## 4. Implementation notes
- `app/story/share.tsx` (Your story / Close Friends with count and Edit, ⚙ settings, "Send to chats" note for Phase 9), `app/story-settings/index.tsx` (Hide story from, Close Friends, Replying, Allow sharing to story, Save story to archive), `app/story-settings/hidden.tsx` (people picker with checks). Page 97 (Phase 11) will link to the same screen.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (hide list, replies settings, resharing, archive purge)
- [x] Supabase advisors clean
