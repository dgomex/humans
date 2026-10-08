# Decision Log

Decisions agreed with the user. Append new entries; don't rewrite old ones (add a new entry that supersedes instead).

| Date | Scope | Decision | Notes |
|---|---|---|---|
| 2026-10-05 | Project | Clone Instagram consumer features for Android + iOS | Scoped per page |
| 2026-10-05 | Stack | Expo (React Native, TypeScript, Expo Router) | Chosen over Flutter / bare RN |
| 2026-10-05 | Backend | Supabase for DB/Auth/Realtime; Supabase Storage acts as the S3 bucket | |
| 2026-10-05 | Scope | Exclude business/monetization surfaces | Ads, Shopping, Subscriptions, Pro dashboard, Meta Verified |
| 2026-10-05 | Process | Every page: deep research, then ask the user to fully clone or change, then build | |
| 2026-10-05 | Foundation | Expo SDK 57 (RN 0.86, React 19.2, React Compiler on); routes in root `app/`, code in `src/` | Matches ARCHITECTURE.md; template's `src/app` not used |
| 2026-10-05 | Foundation | Tab order Home · Explore · Create · Reels · Profile (from PLAN); Create opens a full-screen modal, not a tab screen | Instagram's live tab order changes; PLAN order kept |
| 2026-10-05 | Foundation | System fonts (SF Pro / Roboto), as Instagram uses; icons from @expo/vector-icons behind a semantic `Icon` registry | Glyphs can be swapped for custom SVGs later in one file |
| 2026-10-05 | Foundation | Own BottomSheet (Modal + Reanimated + Gesture Handler) and Toast instead of third-party libs | Avoids version lock with Reanimated 4 |
| 2026-10-05 | Foundation | Auth session in SecureStore (chunked) on native, localStorage on web | |
| 2026-10-05 | Foundation | Storage baseline = owner-only; cross-user read policies are added by the phase owning the related table | See schema registry |
| 2026-10-05 | Foundation | Hosted Supabase project deferred; develop against the local stack for now | User decision |
| 2026-10-05 | Phase 1 | Accounts use **email only** (no phone sign-up/login/recovery, no SMS provider) | Phone may be added later |
| 2026-10-05 | Phase 1 | **Drop all Meta/Facebook surfaces** (from-Meta splash, Facebook login/import, Accounts Center, cross-app profiles); no replacement social login | |
| 2026-10-05 | Phase 1 | **2FA deferred** to Phase 11 (page 14 not built now) | |
| 2026-10-07 | Product | **No teen accounts**: all accounts have the same features; only under-13s are blocked at sign-up | Applies to every later phase (privacy, DMs…) |
| 2026-10-07 | Auth (tech) | Saved logins keep the account's refresh token on the device and are **not revoked** on logout (enables one-tap login like Instagram); "Not now" logins are fully signed out | Removing a saved profile only forgets it locally |
| 2026-10-07 | Auth (tech) | Login/recovery by username go through the `account-auth` Edge Function; login reports unknown account vs wrong password, like Instagram | Consistent with the page 012 choice |
| 2026-10-07 | Phase 1 | Language selector shows English (US) only until translations exist; the notifications permission prompt at the end of sign-up waits for Phase 8 (push) | |
| 2026-10-08 | Navigation (tech) | Each tab is its own Stack; profile routes are shared (`(home,explore,reels,profile)/[username]`) so profiles open inside the current tab with the tab bar visible, like Instagram | Cold deep links open in the Explore tab |
| 2026-10-08 | Phase 2 (tech) | Until Settings (Phase 11) and Activity (Phase 8) exist: ☰ opens a small temporary menu (Saved, Close Friends, Favorites, Follow requests, QR, Log out), Edit profile has a temporary Private switch, and follow requests are answered on a stub screen | Tracked in Prerequisite stubs |
| 2026-10-08 | Phase 2 (tech) | Profile links / QR codes use `https://humans.app/<username>` as a placeholder origin (`PUBLIC_WEB_ORIGIN`) | Change when a real domain exists |

## Per-page decisions
_Format: `| date | Page NNN – name | Full clone / Changes: … | spec link |`_

| Date | Page | Decision | Spec |
|---|---|---|---|
| 2026-10-05 | Page 004 | Changes: Email only: drop the mobile-number path and the "Sign up with mobile number" toggle (no SMS provider). Phone may be added later. | [spec](pages/004-signup-contact.md) |
| 2026-10-05 | Page 005 | Changes: Email code only (no SMS autofill path). | [spec](pages/005-signup-code.md) |
| 2026-10-05 | Page 010 | Changes: Full clone, minus "Import from Facebook". "Share as a post" toggle ships disabled until Phase 3 provides `posts`. | [spec](pages/010-signup-profile-photo.md) |
| 2026-10-05 | Page 011 | Full clone: Contact sync + follow suggestions + Follow buttons. With email-only accounts, contacts are matched on hashed **emails** only. Adds a minimal `follows` stub (owned by Phase 2). | [spec](pages/011-signup-find-people.md) |
| 2026-10-05 | Page 012 | Changes: Recovery by username or email only (no SMS method). | [spec](pages/012-forgot-password.md) |
| 2026-10-05 | Page 014 | Deferred: Skip 2FA for now; revisit together with Settings → Password and security in Phase 11. Login does not branch to a 2FA screen yet. | [spec](pages/014-two-factor-code.md) |
| 2026-10-07 | Page 001 | Full clone: Drop the "from ∞ Meta" wordmark; splash shows only the app glyph. | [spec](pages/001-splash.md) |
| 2026-10-07 | Page 002 | Full clone: Drop profiles from other Meta apps / Google accounts; only accounts saved on this device appear. | [spec](pages/002-welcome.md) |
| 2026-10-07 | Page 003 | Full clone: Drop "Log in with Facebook" and the Meta wordmark; login identifier = username or email (no phone). | [spec](pages/003-login.md) |
| 2026-10-07 | Page 006 | Full clone: As specced (separate password and name steps). | [spec](pages/006-signup-name-password.md) |
| 2026-10-07 | Page 007 | Changes: Block under-13s only. **No teen accounts**: every account gets the same features (no is_teen flag, no teen defaults). | [spec](pages/007-signup-birthday.md) |
| 2026-10-07 | Page 008 | Full clone: As specced. | [spec](pages/008-signup-username.md) |
| 2026-10-07 | Page 009 | Full clone: As specced. | [spec](pages/009-signup-terms.md) |
| 2026-10-07 | Page 013 | Full clone: As specced. | [spec](pages/013-reset-password.md) |
| 2026-10-07 | Page 015 | Full clone: Drop "Go to Accounts Center". | [spec](pages/015-account-switcher.md) |
| 2026-10-07 | Page 012 | Changes (add): unknown account shows "We couldn't find your account", like Instagram | [spec](pages/012-forgot-password.md) |
| 2026-10-08 | Page 016 | Full clone: Current 2026 behavior: 3:4 grid, Grid · Reels · Reposts · Tagged tabs, highlights row above the tabs. A temporary "Private account" toggle lives in Edit profile until page 91 (Phase 11). | [spec](pages/016-own-profile.md) |
| 2026-10-08 | Page 017 | Full clone: As specced. Message, Mute and Restrict are entries that get wired up in Phases 9 and 11. | [spec](pages/017-user-profile.md) |
| 2026-10-08 | Page 018 | Full clone: As specced; privacy enforced by RLS. | [spec](pages/018-private-profile.md) |
| 2026-10-08 | Page 019 | Changes: Minimal fields: Name, Username, Bio (150), Links (≤5), photo, plus the temporary Private toggle. Dropped: pronouns, gender, music, banners, Threads badge, professional account. No 14-day name/username change limits. | [spec](pages/019-edit-profile.md) |
| 2026-10-08 | Page 020 | Changes: Library, Take photo, Remove. No Meta avatar / Facebook import. | [spec](pages/020-change-profile-photo.md) |
| 2026-10-08 | Page 021 | Changes: Simple lists: tabs, search, inline Follow / Follow back / Following, Remove follower. No categories and no sort. | [spec](pages/021-follow-lists.md) |
| 2026-10-08 | Page 022 | Changes: Simple: "Followed by…" line + Mutual tab with search (same simple rows as page 21). | [spec](pages/022-mutual-followers.md) |
| 2026-10-08 | Page 023 | Changes: Clone minus "Account based in" country. Report / Block / Restrict / Hide story are entries wired in Phases 4, 5 and 11. | [spec](pages/023-profile-options.md) |
| 2026-10-08 | Page 024 | Changes: Clone minus Selfie background mode (Color + Emoji only); share, copy link, download, scanner. | [spec](pages/024-qr-code.md) |
| 2026-10-08 | Page 025 | Changes: Highlights tables + profile highlights row (and "New" circle) now; the editor (archive picker, title, cover crop) is built in Phase 5 when stories exist. No stories stub. | [spec](pages/025-highlights-editor.md) |
| 2026-10-08 | Page 026 | Changes: Build now with empty states. No Audio tile (Phase 6) and no collaborative collections (Phase 9). Post FKs added when posts exist (Phase 3); saves come from Phase 4. | [spec](pages/026-saved.md) |
| 2026-10-08 | Page 027 | Changes: Same as page 26: build now; empty until posts/saves exist. | [spec](pages/027-saved-collection.md) |
| 2026-10-08 | Page 028 | Deferred: Not built in Phase 2. Posts archive with Phase 3, stories archive with Phase 5, live archive with Phase 10. | [spec](pages/028-archive.md) |
| 2026-10-08 | Page 029 | Deferred: Not built in Phase 2. Sections land with their phases: interactions (4), posts/recently deleted (3), searches (7), time spent (11, page 103). | [spec](pages/029-your-activity.md) |
| 2026-10-08 | Page 030 | Full clone: As specced. | [spec](pages/030-close-friends.md) |
| 2026-10-08 | Page 031 | Full clone: As specced (max 50, only accounts you follow). | [spec](pages/031-favorites.md) |
