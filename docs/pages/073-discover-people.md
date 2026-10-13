# Page 073 — Suggested for you / Discover people

- **Phase:** 8 — Notifications / Activity
- **Status:** Verifying (built 2026-10-13; real-device checks pending)
- **Route:** `app/discover-people.tsx` (pushed; reachable from Activity, Home suggested strip "See all", profile suggested strip, ☰ menu)
- **Depends on:** `suggested_accounts` (Phases 1/2), `contact_hashes` + contact sync (page 11), `follows`, `FollowButton`, `SuggestedStrip`

## 1. Research (current Instagram behavior)
### Layout
- **Header:** back chevron, title **"Discover people"** (iOS) / **"Suggested for you"** on some entry points.
- **Connect contacts** card at the top when contacts aren't synced: "Connect contacts · Follow people you know" + Connect button (→ OS permission → page 11 sync); hidden once connected.
- **"All suggestions"** list: avatar (story ring if active), username + full name, **reason line** in grey ("Followed by alex + 3 more", "Follows you", "From your contacts", "Suggested for you", "New to Instagram"), **Follow** button (blue; "Follow back" when they follow you), **✕** to dismiss.
- Infinite list (~50–100 accounts), pull to refresh.

### Entry & exit points
- Activity (page 71) "Suggested for you" → **See all**.
- Home feed "Suggested for you" strip → See all; profile "Suggested for you" strip (page 17) → See all.
- ☰ menu → "Discover people" (older builds; currently via Follow & invite friends).
- Rows → profile. Back → previous screen.

### Features & interactions
- [ ] Ranking: mutual connections (friends-of-friends, weighted by count), people who follow you and you don't follow back, contacts, accounts engaging with the same content, popular new accounts.
- [ ] Follow inline (public → Following, private → Requested); the row stays in place.
- [ ] ✕ dismiss: row animates out; that account is not suggested again for a long while (persisted server-side, also hidden from the Home / profile strips).
- [ ] Exclusions: yourself, people you follow, pending requests, blocked (Phase 11), dismissed.
- [ ] Strips elsewhere (Home, profile, Activity) use the same source and dismissals.

### States
- Loading: skeleton rows.
- Empty: "No suggestions right now" + Connect contacts card.
- Error / offline: retry button.
- Edge cases: account deleted / became followed elsewhere → dropped on refresh; private accounts show "Requested" after following.

### Sources
- [Taplink — How to remove suggested accounts on Instagram](https://taplink.at/en/blog/how-to-remove-suggested-accounts-on-instagram.html) (See all list, ✕ per account, ☰ → Discover people, suggestions come back after a while)
- [pvstory — Instagram Notification Settings Guide (2026)](https://pvstory.co.uk/instagram-notification-settings/) (account suggestion notifications)
- Current Instagram app behavior; Phase 1 page 11 and Phase 2 page 17 specs.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: one shared suggestions source with server-side ✕ dismissals used by Discover people and the Home / profile / Activity strips.
- **Date:** 2026-10-13

## 3. Data & storage
- New table `suggestion_dismissals` (user, target, created_at; owner-only RLS select / insert / delete).
- `suggested_accounts(max_count, p_offset)` replaced: follows you (100) > contacts (80) > friends of friends (10 per mutual, ≤20) > co-likers (3 each, ≤10) > new accounts (5) > ln(followers); returns reason, follows_me, mutual_count, mutual_username; excludes self, followed, requested, dismissed < 180 days.

## 4. Implementation notes
- Files: `app/discover-people.tsx`, `SuggestionRow` / `SuggestionsSection` (Activity, Follow requests), `SuggestedStrip` now persists ✕ and links See all; onboarding / Home welcome use the same RPC.
- Connect contacts card reuses page 11's `syncContacts` (native only; hidden on web).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending: contacts permission)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (dismissals private, ranking reasons)
- [x] Supabase advisors clean
