# Page 018 — Private account profile (locked state)

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/[username].tsx` (a state of page 17)
- **Depends on:** `profiles.is_private`, `follow_requests`. The privacy switch itself is page 91 (Phase 11), so a minimal toggle is needed now to test this.

## 1. Research (current Instagram behavior)
### Layout
- Same header, avatar, name, bio, links and **counters (numbers visible)**.
- Instead of highlights/tabs/grid: lock-in-circle icon, **"This account is private"**, "Follow this account to see their photos and videos."
- **Follow** → **Requested** (grey). Message may still be offered, depending on the target's message settings.
- Below: "Suggested for you" accounts.

### Entry & exit points
- Same as page 17. Followers/following counts are not tappable (lists hidden).
- Once the owner approves (follow requests, page 72), the profile unlocks.

### Features & interactions
- [ ] Request → **Requested**; tap Requested → "Cancel request?".
- [ ] Posts, reels, tagged, highlights, stories and follower/following lists are hidden from non-approved users **server-side** (RLS), not only in the UI.
- [ ] Switching from private to public auto-approves pending requests.

### States
- Requested vs not requested. A removed follower sees the locked state again.

### Sources
- [What non-followers see (Kitemetric)](https://kitemetric.com/blogs/can-you-view-a-private-instagram-account-ethical-ways-risks)
- [Follower list visibility (Otto)](https://joinotto.com/blog/how-to-hide-followers-on-instagram/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced; privacy enforced by RLS.
- **Date:** 2026-10-08

## 3. Data & storage
- `profiles.is_private boolean default false`.
- `follow_requests (requester_id, target_id, created_at)`. RLS: requester inserts/deletes own, target selects/deletes; approval via `approve_follow_request` RPC (moves the row into `follows`).
- `can_view_profile(target uuid)` helper: self, public, or approved follower. Later RLS (posts, stories, lists) reuses it.
- `follows` insert tightened: direct follow only when the target is public.

## 4. Implementation notes
- Same route; `ProfileView` renders `PrivateNotice` + suggestions when `can_view` is false. Temporary Private switch in Edit profile. Approving requests: `app/follow-requests.tsx` (stub of page 72).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (non-follower can't read a private account's follower lists)
- [x] Supabase advisors clean (db lint)
