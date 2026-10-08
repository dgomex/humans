# Page 023 — Profile options menu

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** bottom sheet from ⋯ on page 17; Share profile sheet from page 16; `app/[username]/about.tsx`
- **Depends on:** pages 17, 24; blocks/restrict/report come from Phases 4 and 11

## 1. Research (current Instagram behavior)
### Layout
- **⋯ on another profile (sheet):** Report… (red), Block (red), About this account, Restrict, See shared activity, Hide your story, Remove follower (only if they follow you), Copy profile URL, Show QR code, Share this profile.
- **Share profile (own, page 16):** opens the QR screen (page 24) with Share profile / Copy link / Download actions.
- **About this account:** avatar, username; **Date joined** (month + year); **Account based in** (country, from activity); **Former usernames** (count only); verified status; "Accounts with shared followers".

### Features & interactions
- [ ] Copy profile URL → clipboard + toast "Link copied".
- [ ] Share this profile → OS share sheet with `https://<domain>/<username>`.
- [ ] Remove follower → confirm.
- [ ] Hide your story from this person (needs stories, Phase 5).
- [ ] Report (page 50, Phase 4), Block / Restrict (Phase 11).

### States
- Items depend on the relationship (follows you, private, own).

### Sources
- [About this account (Instagram Help Center)](https://help.instagram.com/697961817256175)
- [Remove follower via ⋯ (Beebom)](https://beebom.com/instagram-now-lets-you-remove-followers-you-dont-follow-back/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Clone minus "Account based in" country. Report / Block / Restrict / Hide story are entries wired in Phases 4, 5 and 11.
- **Date:** 2026-10-08

## 3. Data & storage
- About: `profiles.created_at`, username change count from `username_changes` (page 19). "Account based in" would need a stored country.
- Hide story: `story_hidden_from` (Phase 5).

## 4. Implementation notes
- `ProfileOptionsSheet` (Report/Block/Restrict/Hide story show "Coming soon" until their phases); `app/(tabs)/(home,explore,reels,profile)/[username]/about.tsx` (`account_about` RPC: date joined + former usernames count from `username_changes`).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users
- [x] Supabase advisors clean (db lint)
