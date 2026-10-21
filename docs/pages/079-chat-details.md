# Page 079 — Chat details / settings

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/t/[id]/details.tsx` (+ `members`, `nicknames`, `theme`, `media` sub-screens)
- **Depends on:** page 76; `reports` (Phase 4); blocks / restricts (Phase 11 pages 92–93, stubs today)

## 1. Research (current Instagram behavior)
### Layout
- **1:1:** large avatar, name, username; round buttons **Audio · Video · Profile · Mute · Search**. Rows: **Theme**, **Nicknames**, **Disappearing messages / Vanish mode**, **Privacy & safety** (Read receipts, Restrict, Block, Report), **Create group chat with x**, **Media, files and links** (shared photos, videos, posts, links), **Pinned messages**, **Notifications** (Mute messages, Mute calls, for 15 min / 1 h / 8 h / 24 h / until changed).
- **Group:** group photo + name (**Change name / photo**), **Members (n)** with Admin labels → member actions (Message, View profile, Make admin, Remove from group), **Add people**, **Invite link**, **Approve new members** toggle (admins), Theme, Nicknames, Mute, Media, **Leave chat**, Report.

### Entry & exit points
- Tap the name in the thread header (76).

### Features & interactions
- [ ] **Themes**: preset colour / gradient themes (also seasonal / illustrated); change shown to everyone with a system line.
- [ ] **Nicknames** per member, visible to everyone in the chat.
- [ ] **Vanish mode** (1:1 only): swipe up in the thread or toggle here; messages disappear when someone leaves the chat; no copy / save / forward; screenshot notice.
- [ ] **Mute** messages / calls, timed.
- [ ] **Read receipts** off for this chat.
- [ ] **Search in conversation**.
- [ ] **Block** (also blocks new accounts they create), **Restrict** (their messages go to Requests, no read receipts), **Report** (account or chat).
- [ ] Leave group (others see "x left"); admin removal ("x removed y").

### States
- Edge cases: last admin leaves → oldest member becomes admin; blocked user in group shows a banner.

### Sources
- [Instagram Help — Vanish mode](https://help.instagram.com/android-app/888592124998543)
- [Social Media Today — read receipts](https://www.socialmediatoday.com/news/instagram-now-lets-opt-out-read-receipts-dms/705653/)
- [Instagram Help — group chat invite links](https://help.instagram.com/iphone-app/1078739702690433)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Themes, nicknames, timed mute, per-chat read receipts, search in chat, shared media / links, pinned messages, vanish mode (1:1), leave, report. Block / Restrict stay "coming soon" until Phase 11.
- **Date:** 2026-10-13

## 3. Data & storage
- RPCs: `rename_thread`, `set_thread_photo`, `set_thread_theme` (10 presets), `set_nickname`, `set_vanish_mode` / `end_vanish_session` / `note_screenshot`, `set_thread_admin`, `remove_thread_member`, `leave_thread` (last admin → oldest member), `set_thread_approval`; every change posts a system line.
- Own member row: read_receipts, muted_until (timed), pinned_at, marked_unread. Reports: `reports.target_type` message / thread.

## 4. Implementation notes
- Files: `app/direct/t/[id]/{details,members,add,nicknames,theme,filtered}.tsx` (`filtered` = pinned, Media · Links · Posts tabs, scheduled, search in chat).
- Block / Restrict show "coming soon" (Phase 11 pages 92–93).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
