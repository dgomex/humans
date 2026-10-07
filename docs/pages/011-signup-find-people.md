# Page 011 — Sign up: find contacts & follow suggestions

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/contacts.tsx`, `app/(auth)/signup/suggestions.tsx`
- **Depends on:** page 10; `follows` (Phase 2, so a stub is needed); contacts permission

## 1. Research (current Instagram behavior)
### Layout
- **Contacts:** an illustration, title "Find your contacts" / "Allow access to your contacts", text "Connect your contacts to find people you know on Instagram. Your contacts will be periodically synced and stored on Instagram servers…", "Next" (which triggers the OS permission prompt), and "Skip".
- **Suggestions:** title "Follow 5 or more people" / "Discover people", then a list of rows (avatar, username, full name, a reason such as "In your contacts" / "Popular", and a blue "Follow" button that toggles to a gray "Following"). Header "Follow all" when the list comes from contacts. A "Next" / "Done" button at the bottom.
- Then: a notifications permission prompt ("Turn on notifications"), then Home with a welcome feed of suggestions.

### Entry & exit points
- Photo → contacts → suggestions → Home. "Skip" goes straight on.

### Features & interactions
- [ ] Contact upload (phones and emails, hashed) matched against accounts.
- [ ] Follow / unfollow inline; "Follow all".
- [ ] Contacts kept syncing in the background (managed in Settings → Contacts syncing, Phase 11).

### States
- Loading: skeleton rows.
- Empty: no matches, so popular accounts are suggested instead.
- Error: permission denied leads straight to suggestions; network-error toast.

### Sources
- [Find people you know on Instagram](https://help.instagram.com/195069860617299/), [What happens when you connect contacts](https://help.instagram.com/227486307449481), [Disconnect contacts syncing](https://help.instagram.com/236691729788553).

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Contact sync + follow suggestions + Follow buttons. With email-only accounts, contacts are matched on hashed **emails** only. Adds a minimal `follows` stub (owned by Phase 2).
- **Date:** 2026-10-05

## 3. Data & storage
- Stub `follows (follower_id, following_id, created_at)` (owned by Phase 2) is needed for Follow buttons.
- Contacts: `contact_hashes (owner_id, hash)` + `profiles` phone/email hashes, matched by RPC `match_contacts(hashes text[])`. Hashes only (SHA-256 of normalized E.164 / lowercased email); never raw contacts.
- `suggested_accounts()` RPC: contacts matches, then the most-followed accounts.

## 4. Implementation notes
- `expo-contacts`, `expo-crypto` (hashing on device). Reusable `UserRow` + `FollowButton` components (reused by Phase 2 lists).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (B can't read A's contact hashes; can't follow as A)
- [ ] Supabase advisors clean
