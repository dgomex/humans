# Page 021 — Followers / Following lists

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/[username]/connections.tsx?tab=followers|following` (also from own profile)
- **Depends on:** `follows`, `can_view_profile()` (page 18)

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ username. Top tabs: **N followers · N following** (+ "Subscriptions" for creators, out of scope; + "Mutual" when viewing someone else → page 22). Swipe between tabs.
- Search field at the top.
- **Own Followers:** "Categories" section (**Accounts you don't follow back**, **Least interacted with**), then "All followers" rows: avatar, username, full name, a "· Follow" link if you don't follow back, and a **Remove** button (→ "Remove follower?" confirm; they are not notified).
- **Own Following:** "Categories" (**Least interacted with**, **Most shown in feed**), "Sorted by **Default** ⇅" (sheet: Default / Date followed: latest / Date followed: earliest), rows with a **Following** button and **⋯** (Close Friends, Favorites, Mute, Unfollow).
- **Other user's lists:** rows with Follow / Following buttons relative to *you*; mutual followers listed first.

### Entry & exit points
- Counters on pages 16/17. Row → that profile.

### Features & interactions
- [ ] Infinite scroll; search filters by username/name (server-side).
- [ ] Remove follower (own list only), unfollow, follow/follow back inline with optimistic state.
- [ ] Sort (own following).
- [ ] Categories need interaction data from Phase 4 ("least interacted with" = no likes/comments/DMs in 90 days).

### States
- Loading: skeleton rows. Empty: "People who follow you will appear here" / "You'll see all the people you follow here".
- Private account and not an approved follower: lists are not reachable.

### Sources
- [Follower categories, remove follower (Beebom)](https://beebom.com/instagram-now-lets-you-remove-followers-you-dont-follow-back/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Simple lists: tabs, search, inline Follow / Follow back / Following, Remove follower. No categories and no sort.
- **Date:** 2026-10-08

## 3. Data & storage
- `follows` with a new select policy: rows visible when `can_view_profile()` of the list owner.
- `remove_follower(uuid)` RPC (deletes a row where *you* are `following_id`).
- Paged RPC `profile_connections(user, kind, search, sort, cursor)` returning rows + my relationship.

## 4. Implementation notes
- `app/(tabs)/(home,explore,reels,profile)/[username]/connections.tsx`: tabs, debounced server search, infinite list (`profile_connections`), own followers: Follow back + Remove; others: `FollowButton`.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
