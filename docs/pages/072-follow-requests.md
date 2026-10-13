# Page 072 — Follow requests (private accounts)

- **Phase:** 8 — Notifications / Activity
- **Status:** Verifying (built 2026-10-13; real-device checks pending)
- **Route:** `app/activity/requests.tsx` (replaces the Phase 2 stub `app/follow-requests.tsx`)
- **Depends on:** `follow_requests`, `approve_follow_request`, `follows`, `suggested_accounts` (Phase 2); page 71 (entry row)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** back chevron, title **"Follow requests"**.
- Optional search field on accounts with many requests (Android shows it on long lists; recent builds show it always).
- **List:** avatar (story ring if active), username (bold) + full name (grey), **Confirm** (blue filled) and **Delete** (grey) buttons.
- After **Confirm**: buttons swap to **Follow back** (blue) / **Following** if you already follow them; row stays until you leave.
- After **Delete**: row shows "Request removed" briefly, then disappears on next load.
- **"Suggested for you"** section below the list with Follow + ✕ and "See all" (→ page 73).
- No "Confirm all" / "Delete all" in the app (bulk exists only on the web, and only sporadically).

### Entry & exit points
- Activity (page 71) "Follow requests" row — shown only while the account is private or has pending requests.
- Push "x requested to follow you" → here.
- Rows → profile (the requester's profile shows a banner "x wants to follow you · Confirm / Delete").
- Back → Activity.

### Features & interactions
- [ ] Newest first; paginated.
- [ ] Confirm → requester becomes a follower; requester gets "x accepted your follow request" in their Activity.
- [ ] Delete → request removed silently (requester's button reverts to "Follow" without notice).
- [ ] Follow back inline after confirming (private target → "Requested").
- [ ] Requester cancelling (unfollow "Requested") removes the row and the Activity notification.
- [ ] Profile banner on the requester's profile: "<user> wants to follow you" with Confirm / Delete.
- [ ] Going public auto-approves all pending requests (already in Phase 2).

### States
- Loading: skeleton rows.
- Empty: "No pending requests" (the Activity row disappears anyway).
- Error / offline: toast "Couldn't update the request", optimistic state rolled back.
- Edge cases: requester deleted / cancelled → row gone on refresh; acting twice is a no-op.

### Sources
- [eSafety Commissioner — Controlling your Instagram privacy settings](https://beconnected.esafety.gov.au/topic-library/social-media-apps/introduction-to-instagram/controlling-your-instagram-privacy-settings) (private owners accept / deny requests from a notification)
- [pvstory — Instagram Notification Settings Guide (2026)](https://pvstory.co.uk/instagram-notification-settings/) (follow requests + accepted requests notifications)
- Current Instagram app behavior; Phase 2 page 18 spec ([018](018-private-profile.md)).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced (replaces the Phase 2 stub screen). No bulk Confirm all.
- **Date:** 2026-10-13

## 3. Data & storage
- Reused: `follow_requests`, `approve_follow_request` (now also notifies the requester with `follow_accepted`).
- New RPCs: `follow_request_summary()` (count + two newest, Activity row), `my_follow_requests(search, offset, limit)` (with i_follow / requested for Follow back).
- RLS unchanged (select / delete by either party). Realtime on `follow_requests` refreshes the row / badge.

## 4. Implementation notes
- Files: `app/activity/requests.tsx` (replaces the Phase 2 stub `app/follow-requests.tsx`), `RequestBanner` on other profiles (`ProfileView`), `useAnswerRequest`, `useRequestFrom`.
- Rows stay after answering (Follow back / "Request removed") until you leave; search is server-side (username / unaccented name).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`test-activity-rls.mjs`: summary / list privacy, approve, cancel)
- [x] Supabase advisors clean
