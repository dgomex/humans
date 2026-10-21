# Page 074 — Inbox (chats list, notes row)

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/index.tsx` (pushed from the Home ✈ icon)
- **Depends on:** `profiles`, `follows`, `close_friends` (Phase 2); story rings (Phase 5); `ActivityAlerts` Realtime pattern (Phase 8)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** back chevron (→ Home), **username ▾** (account switcher, page 15), ✎ **New message** icon (page 77). Android puts the same icons on the right.
- **Search field** ("Search"; Instagram now shows "Ask Meta AI / Search" — Meta AI is out of scope).
- **Notes row** (page 81): your own bubble first ("Note…" / your note + avatar), then notes from followers you follow back / Close Friends, horizontally scrollable. Each = avatar + speech bubble above it (text, or ♪ song).
- **Section title "Messages"** on the left, **"Requests (n)"** link on the right (page 75).
- **Professional accounts only:** Primary / General / Requests tabs and filter chips (Unread, Story replies, Followers…). Personal accounts have one list + Requests.
- **Chat rows:** avatar (story ring if active; green dot when active now; stacked double avatar for groups), name (bold when unread), preview line — last message ("You: …", "Sent a reel by x", "Liked a message", "Replied to your story", "4+ new messages", "Seen", "Sent 2h", "Typing…") · age, right side: blue unread dot, 🔕 if muted, 📷 quick camera button.
- **Pinned chats** (≤3) at the top.

### Entry & exit points
- Home ✈ (top right, with an unread count badge); old swipe-left from Home on some builds.
- Profile **Message** button, post/reel/story share sheets ("Send to"), story reply, push / in-app banner of a new message.
- Row → chat thread (76); 📷 → camera to send a photo/video (view-once by default); note bubble → note sheet (81); ✎ → New message (77); Requests → page 75.

### Features & interactions
- [ ] Chats sorted by last activity; infinite scroll.
- [ ] Unread state (bold + blue dot); badge count on Home ✈ = number of unread chats.
- [ ] Realtime: new messages move the chat to the top, typing shows "Typing…" in the preview.
- [ ] Active status: green dot / "Active now" / "Active 12m ago" (only between accounts that follow each other or have chatted, and only when both have Activity status on).
- [ ] Swipe left on a row (iOS) / long-press (both): **Pin**, **Mute** (messages / calls), **Mark as unread**, **Delete** (deletes for you only), More.
- [ ] Search: people and group names across chats, then other accounts (start a new chat).
- [ ] Pull to refresh.

### States
- Loading: skeleton rows.
- Empty: "Message your friends" illustration + "Send message" / suggestions with Send buttons.
- Error / offline: cached list + "No internet connection" banner; sends queue.
- Edge cases: deleted / deactivated account → "Instagram User" with blank avatar; blocked users keep the chat but can't message; left groups show "You left".

### Sources
- [TechCrunch — Instagram upgrades DMs (Feb 2025)](https://techcrunch.com/2025/02/19/instagram-upgrades-dms-with-music-sharing-message-scheduling-translation-and-more/)
- [Social Media Today — Instagram adds DM message management options](https://www.socialmediatoday.com/news/instagram-adds-new-dm-message-management-options/758938/) (filters / folders for professional accounts)
- [Metricool — Instagram DM guide 2026](https://metricool.com/de/instagram-dm/) (pin up to 3 chats)
- [Instagram — DMs feature page](https://about.instagram.com/features/direct)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Personal-account inbox: one list + Requests (no Primary / General tabs or filter chips, no Meta AI, no broadcast channels). Notes row, pin ≤3, mute, mark unread, delete for me, active status, unread badge on Home ✈, realtime, search, quick camera.
- **Date:** 2026-10-13

## 3. Data & storage
- Tables: `threads`, `thread_members` (pin / mute / unread / cleared per member), `messages`, `notes`, `user_presence`.
- RPCs: `inbox_threads(folder, before, limit, query)` (pinned first, unread ≤5, seen, preview), `direct_badge()` (✈ count), `presence_of(ids)`, `touch_presence()`.
- RLS: members read their threads; own member row only (column grant: read_receipts, muted_until, pinned_at, marked_unread); ≤3 pinned (trigger).
- Realtime: `inbox:{user}` private broadcast from DB triggers (new messages, reactions, reads) → inbox + badge refresh; in-app banner (`DirectAlerts`).

## 4. Implementation notes
- Files: `app/direct/index.tsx`, `src/features/direct/{api,format,realtime}.ts(x)`, components `ThreadRow` (swipe Mute / Delete / More), `ThreadAvatar`, `Notes` (row), `DirectIcon` (Home ✈ badge).
- Long-press / More: Pin, Mute (15 min … until changed), Mark as read / unread, Delete (for me). 📷 opens the thread with the camera.
- Username ▾ opens the account switcher (provider mounted on the screen).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
