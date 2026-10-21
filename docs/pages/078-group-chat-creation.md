# Page 078 — Group chat creation

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/new-group.tsx` (step after page 77)
- **Depends on:** page 77, `messages` bucket (group photo)

## 1. Research (current Instagram behavior)
### Layout
- After selecting 2+ people: optional **group name** field ("Group name (optional)"), optional **group photo**, member chips, **Create** button.
- New thread opens with system lines "You created the group." / "You named the group x".

### Entry & exit points
- New message (77) "Create group chat"; chat details (79) "Create group chat with x".
- Create → the new group thread (76).

### Features & interactions
- [ ] 2–249 others (Instagram groups go up to 250 members).
- [ ] Creator is **admin**; admins can add / remove members, make admins, turn on **Approve new members**, rename, change the photo.
- [ ] Unnamed groups display the member names ("Ana, Ben and 3 others").
- [ ] **Invite link / QR** (admin creates; any member shares; reset invalidates; ≤250 joins per link per day).
- [ ] Adding a member who doesn't follow the adder → the group lands in their **Requests**.

### States
- Error: "Couldn't create group" toast; members who can't be added are listed.

### Sources
- [Instagram Help — group chat invite links](https://help.instagram.com/iphone-app/1078739702690433)
- [Taplink — How to create an Instagram group chat](https://taplink.at/en/blog/create-instagram-group-chat.html)
- [TechCrunch — QR group invites (Feb 2025)](https://techcrunch.com/2025/02/19/instagram-upgrades-dms-with-music-sharing-message-scheduling-translation-and-more/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Groups ≤250 with name / photo, admins, add / remove, Approve new members, invite link + QR.
- **Date:** 2026-10-13

## 3. Data & storage
- `create_group_thread(ids, title)` (creator is admin; members who don't follow the creator get it as a request), `set_thread_photo` (`{thread}/group-{uuid}.jpg`), `add_thread_members` / `thread_join_requests` / `answer_join_request` (Approve new members), `create_thread_invite` / `disable_thread_invite` / `thread_invite_preview` / `join_thread_by_invite` (≤250 members, ≤250 joins per link per day).

## 4. Implementation notes
- Files: `app/direct/new-group.tsx`, `app/direct/t/[id]/invite.tsx` (link + QR, copy / share / reset / turn off), `app/direct/t/[id]/join-requests.tsx`, `app/direct/join/[token].tsx` (preview + Join / Request to join). Link format: `https://humans.app/direct/join/{token}`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
