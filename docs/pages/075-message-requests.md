# Page 075 — Message requests

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/requests.tsx`, `app/direct/requests/hidden.tsx`
- **Depends on:** page 74 (inbox), page 76 (thread), `follows`

## 1. Research (current Instagram behavior)
### Layout
- **Requests list:** header "Message requests", note "Open a chat to get more info about who's messaging you. They won't know you've seen it until you accept." List of request rows (avatar, name, preview, age). **Hidden requests** (renamed "Spam" on recent builds) link at the bottom with count. **Delete all** action.
- **Request thread:** profile card (avatar, name, username, "x followers · y posts", "You don't follow each other", mutual followers, "View profile"), the message(s); media from strangers blurred with "Tap to view". Bottom bar: **Block** · **Delete** · **Accept** (Android: Block / Report, Delete, Accept stacked).

### Entry & exit points
- Inbox "Requests (n)" link; push "x wants to send you a message".
- Accept → thread moves to the main inbox (76). Delete → gone (sender isn't told). Block → block sheet (Phase 11 page 92) + optional Report.

### Features & interactions
- [ ] A message goes to Requests when the recipient doesn't follow the sender (1:1) or when a non-followed account adds you to a group.
- [ ] Until accepted the sender can send **one text-only message** (Instagram's 2023 limit); further sends are blocked with "You can send more messages after x accepts your request".
- [ ] No read receipts, typing or active status until accepted; calls not possible.
- [ ] Offensive / spam requests (Hidden words filter, page 95) go to **Hidden requests**, no notification.
- [ ] Delete all (with confirm); swipe / long-press a row → Delete.
- [ ] Recipient can reply = accept.
- [ ] "Who can message you" settings (page 98, Phase 11) decide whether requests are allowed at all.

### States
- Loading: skeleton rows.
- Empty: "No message requests" + text "You don't have any message requests."
- Error / offline: toast, action rolled back.
- Edge cases: sender deletes / unsends → request disappears; sender blocks you → gone.

### Sources
- [Instagram Help — Message requests that may be offensive, unwanted, spam or hidden by Hidden Words](https://help.instagram.com/iphone-app/194599462478093)
- [Creatorflow — Message requests not showing / where to look](https://creatorflow.so/blog/instagram-message-requests-not-showing/) (Hidden requests → "Spam" rename)
- Meta newsroom (Oct 2023): message requests limited to one text-only message until accepted.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** One text-only message until accepted; no receipts / typing / active status before accepting; Accept / Delete / Block (Block = "coming soon" until page 92), Delete all, Hidden requests filtered by a built-in word list (page 95 adds personal Hidden words).
- **Date:** 2026-10-13

## 3. Data & storage
- `thread_members.status` request / hidden: set when the thread is created (recipient doesn't follow the sender), flipped to hidden by `is_flagged_text` on the first message.
- `messages_before_insert`: while the other person is request / hidden, one text message only (`request_pending`, `request_text_only`); story replies are exempt.
- RPCs: `accept_thread`, `clear_thread` (delete a request / chat for me), `clear_requests(hidden)`. Replying accepts. No read receipts / typing until accepted (`thread_info` hides last_read_at; realtime send needs active status).

## 4. Implementation notes
- Files: `app/direct/requests.tsx` (`?hidden=1` = Hidden requests, Delete all); a request opens `app/direct/t/[id]` with the Block · Delete · Accept bar.
- Block = "coming soon" until page 92; personal Hidden words wait for page 95; "Who can message you" for page 98.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
