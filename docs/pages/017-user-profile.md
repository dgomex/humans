# Page 017 — Other user's Profile

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/[username].tsx` (pushed on the current stack)
- **Depends on:** page 16 `ProfileView`, `follows`, `follow_requests`

## 1. Research (current Instagram behavior)
### Layout
- **Header bar:** back ‹, **username** (verified badge if any), 🔔 bell (per-account post/story/reel/live notifications), **⋯** (profile options, page 23).
- Identity row and bio as on page 16, plus **"Followed by alice, bob and 12 others"** with stacked avatars (mutual followers → page 22).
- **Action buttons:**
  - Not following: **Follow** (blue) · **Message** · person+ (suggested accounts).
  - Following: **Following ▾** (grey) opens a sheet: Add to Close Friends ★, Add to Favorites ☆, Mute, Restrict, Unfollow · **Message** · person+.
  - They follow you, you don't: **Follow back**.
  - Private and pending: **Requested** (tap to cancel).
- Highlights row (no "New"), then tabs **Grid · Reels · Reposts · Tagged**.

### Entry & exit points
- Any username or avatar (feed, comments, search, follower lists, DMs, deep link `/<username>`).
- Message → DM thread (Phase 9; placeholder until then).

### Features & interactions
- [ ] Follow/unfollow with optimistic button + counter update. Unfollowing a **private** account asks to confirm ("you'll have to request to follow again").
- [ ] person+ toggles "Suggested for you" cards (Follow / ✕ dismiss).
- [ ] Bell: Posts / Stories / Reels / Live toggles (stored now, delivered in Phase 8).
- [ ] Following sheet: Close Friends / Favorites toggles (pages 30/31); Mute and Restrict belong to Phase 11.

### States
- Loading: skeleton.
- Not found: "Sorry, this page isn't available." with a back link.
- Blocked (Phase 11): "User not found".
- Private + not an approved follower → page 18.

### Sources
- See page 016 sources.
- [Follower categories / remove follower (Beebom)](https://beebom.com/instagram-now-lets-you-remove-followers-you-dont-follow-back/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced. Message, Mute and Restrict are entries that get wired up in Phases 9 and 11.
- **Date:** 2026-10-08

## 3. Data & storage
- `follows`, `follow_requests` (new), `profile_notification_prefs` (bell; new), `close_friends`, `favorites`.
- `profile_by_username(text)` RPC: profile + relationship (follows_me, i_follow, requested, counts, mutuals preview).

## 4. Implementation notes
- `app/(tabs)/(home,explore,reels,profile)/[username]/index.tsx` (shared route: opens in the current tab's stack, tab bar stays). Bell → `BellSheet`; ⋯ → `ProfileOptionsSheet`; Following ▾ → `FollowingSheet`. `FollowButton` now has Follow / Follow back / Following / Requested states.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
