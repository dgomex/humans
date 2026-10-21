# Page 077 — New message / select recipients

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/new.tsx` (modal)
- **Depends on:** page 74, page 76, `search_profiles` / `search_accounts` (Phases 3/7)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** ✕ / back, title **"New message"**.
- **"To:"** field with selected people as chips (backspace removes the last).
- **Top rows:** "Create group chat" (→ page 78), "AI chats" (Meta AI — out of scope), "Create broadcast channel" (creator feature — out of scope).
- **"Suggested"** list: recent chats + people you interact with; each row avatar, name, username, round checkbox. Typing filters to account search results.
- **Bottom button:** "Chat" (one person) / "Create group chat" (2+).

### Entry & exit points
- Inbox ✎, inbox empty-state "Send message".
- One recipient → existing 1:1 thread (or a new one, created on first send). Several → group creation (78).

### Features & interactions
- [ ] Search accounts by username / name (followed + recent first).
- [ ] Multi-select with chips; tapping a chip removes it.
- [ ] Existing chat reused for the same person; a group with the same members is offered ("Go to existing chat").
- [ ] Accounts that can't be messaged (they block you / their "who can message you" setting) are greyed with a reason.

### States
- Loading: skeleton rows; Empty search: "No account found."
- Error / offline: toast.

### Sources
- Current Instagram app behavior (iOS / Android, 2025–2026); [Instagram — DMs feature page](https://about.instagram.com/features/direct).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Without Meta AI chats and broadcast channels.
- **Date:** 2026-10-13

## 3. Data & storage
- `share_suggestions(query, limit)` (recent chats, then people you follow / search results), `get_or_create_direct(other)`.

## 4. Implementation notes
- Files: `app/direct/new.tsx`, `src/features/direct/components/PeoplePicker.tsx` ("To:" chips, backspace removes the last, round checkboxes). One person → chat; 2+ → page 78.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
