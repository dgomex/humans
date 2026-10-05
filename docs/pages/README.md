# Page Tracker

Single source of truth for progress. Update after **every** workflow step.

**Legend:** ☐ not started · ◐ in progress · ☑ done · Decision: `—` pending, `Clone`, or `Changes` (details in the spec + DECISIONS.md)
**Spec file:** `docs/pages/<NNN>-<slug>.md` (from `_TEMPLATE.md`)

## Current focus
**Phase 0 — Foundation:** built and checked locally (2026-10-05). Two items still open:
- **On-device check:** no Android SDK on the dev machine, and an iOS simulator needs macOS. Verified so far: both native bundles compile (`expo export`), the web build was clicked through in light and dark mode, and storage RLS was tested with two users (`node scripts/test-storage-rls.mjs`). Still to do: open in Expo Go on a real Android phone and iPhone.
- **Hosted Supabase project:** not created or linked yet. Waiting on the user's go-ahead; local development doesn't need it.

Next: Phase 1 — Onboarding & Authentication (`/start-phase 1`).

## Prerequisite stubs
_Minimal objects created ahead of their owning phase (so they get finished properly later)._

| Object | Created for page | Owning phase | Status |
|---|---|---|---|

## Phase 0 — Foundation

| Task | Status |
|---|---|
| Expo app scaffold (TS, Expo Router, ESLint/Prettier) | ☑ Expo SDK 57, RN 0.86, React Compiler on |
| Theme tokens (light/dark), icons, fonts | ☑ `src/theme/`; `Icon` registry (Ionicons/MaterialCommunityIcons); system fonts |
| Shared components: Avatar, Button, BottomSheet, Toast | ☑ plus `Text`, `Icon`; demo at `/dev/ui` (dev only) |
| Supabase local CLI + project link + `src/lib/supabase.ts` | ◐ local stack + client ☑; hosted project link pending the user's approval |
| Storage buckets + storage RLS + `src/lib/storage.ts` | ☑ migration `20261005165703_phase0_storage_buckets.sql`; 19/19 two-user RLS checks pass |
| Generated DB types + TanStack Query setup | ☑ `npm run db:types`; `src/lib/queryClient.ts`, `useMediaUrl` |
| Bottom tab shell (Home · Explore · Create · Reels · Profile) | ☑ Create opens the `/create-entry` modal |
| Verified on Android emulator + iOS simulator | ◐ bundles compile for both platforms + web UI checked; real-device run pending |

## Phase 1 — Onboarding & Authentication

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 1 | Splash / Launch screen | — | ☐ | — | ☐ | ☐ |
| 2 | Welcome / Landing (Log in vs. Create account) | — | ☐ | — | ☐ | ☐ |
| 3 | Log in | — | ☐ | — | ☐ | ☐ |
| 4 | Sign up – phone or email entry | — | ☐ | — | ☐ | ☐ |
| 5 | Sign up – confirmation code | — | ☐ | — | ☐ | ☐ |
| 6 | Sign up – full name & password | — | ☐ | — | ☐ | ☐ |
| 7 | Sign up – birthday | — | ☐ | — | ☐ | ☐ |
| 8 | Sign up – username | — | ☐ | — | ☐ | ☐ |
| 9 | Sign up – terms & policies agreement | — | ☐ | — | ☐ | ☐ |
| 10 | Sign up – add profile photo | — | ☐ | — | ☐ | ☐ |
| 11 | Sign up – find contacts / follow suggestions | — | ☐ | — | ☐ | ☐ |
| 12 | Forgot password / account recovery | — | ☐ | — | ☐ | ☐ |
| 13 | Reset password | — | ☐ | — | ☐ | ☐ |
| 14 | Two-factor authentication code entry | — | ☐ | — | ☐ | ☐ |
| 15 | Account switcher (multiple accounts) sheet | — | ☐ | — | ☐ | ☐ |

## Phase 2 — Profile

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 16 | Own Profile (grid / reels / tagged tabs) | — | ☐ | — | ☐ | ☐ |
| 17 | Other user's Profile | — | ☐ | — | ☐ | ☐ |
| 18 | Private account profile (locked state) | — | ☐ | — | ☐ | ☐ |
| 19 | Edit Profile (name, username, pronouns, bio, links, gender) | — | ☐ | — | ☐ | ☐ |
| 20 | Change profile photo sheet | — | ☐ | — | ☐ | ☐ |
| 21 | Followers / Following lists | — | ☐ | — | ☐ | ☐ |
| 22 | Mutual followers list | — | ☐ | — | ☐ | ☐ |
| 23 | Profile options menu (share, QR code, copy URL, about this account) | — | ☐ | — | ☐ | ☐ |
| 24 | QR code / Nametag page | — | ☐ | — | ☐ | ☐ |
| 25 | Story Highlights – create / edit / cover selection | — | ☐ | — | ☐ | ☐ |
| 26 | Saved (collections list) | — | ☐ | — | ☐ | ☐ |
| 27 | Saved collection detail / create & edit collection | — | ☐ | — | ☐ | ☐ |
| 28 | Archive (posts, stories, live archive) | — | ☐ | — | ☐ | ☐ |
| 29 | Your activity (interactions, time spent, recently deleted) | — | ☐ | — | ☐ | ☐ |
| 30 | Close Friends list management | — | ☐ | — | ☐ | ☐ |
| 31 | Favorites list management | — | ☐ | — | ☐ | ☐ |

## Phase 3 — Content Creation

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 32 | Create entry / media picker (post, story, reel, live switcher) | — | ☐ | — | ☐ | ☐ |
| 33 | Camera (photo/video capture) | — | ☐ | — | ☐ | ☐ |
| 34 | Multi-select & crop (carousel) | — | ☐ | — | ☐ | ☐ |
| 35 | Filters & edit (adjust, brightness, etc.) | — | ☐ | — | ☐ | ☐ |
| 36 | New post details (caption, tag people, location, music, alt text, advanced settings) | — | ☐ | — | ☐ | ☐ |
| 37 | Tag people | — | ☐ | — | ☐ | ☐ |
| 38 | Location search / add location | — | ☐ | — | ☐ | ☐ |
| 39 | Music picker | — | ☐ | — | ☐ | ☐ |
| 40 | Upload progress / posting state | — | ☐ | — | ☐ | ☐ |
| 41 | Edit existing post | — | ☐ | — | ☐ | ☐ |
| 42 | Drafts | — | ☐ | — | ☐ | ☐ |

## Phase 4 — Home Feed & Post Interactions

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 43 | Home Feed (header, stories tray, post feed, suggested posts) | — | ☐ | — | ☐ | ☐ |
| 44 | Post detail (single post view) | — | ☐ | — | ☐ | ☐ |
| 45 | Carousel viewer / media zoom | — | ☐ | — | ☐ | ☐ |
| 46 | Comments (threaded replies, likes, pin, emoji bar) | — | ☐ | — | ☐ | ☐ |
| 47 | Likes list | — | ☐ | — | ☐ | ☐ |
| 48 | Share sheet (send to DMs, add to story, copy link) | — | ☐ | — | ☐ | ☐ |
| 49 | Post options menu (save, report, hide, unfollow, not interested, about this account) | — | ☐ | — | ☐ | ☐ |
| 50 | Report flow | — | ☐ | — | ☐ | ☐ |
| 51 | Feed variants: Following / Favorites feeds | — | ☐ | — | ☐ | ☐ |

## Phase 5 — Stories

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 52 | Story viewer (progress bars, reply, react, swipe between users) | — | ☐ | — | ☐ | ☐ |
| 53 | Story camera | — | ☐ | — | ☐ | ☐ |
| 54 | Story editor (text, stickers, drawing, mentions, music, links, polls, questions, quiz, countdown, emoji slider) | — | ☐ | — | ☐ | ☐ |
| 55 | Story audience / share options (Your story vs. Close Friends) | — | ☐ | — | ☐ | ☐ |
| 56 | Story viewers list & insights (own story) | — | ☐ | — | ☐ | ☐ |
| 57 | Highlights viewer | — | ☐ | — | ☐ | ☐ |

## Phase 6 — Reels

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 58 | Reels feed (vertical full-screen player) | — | ☐ | — | ☐ | ☐ |
| 59 | Reels camera / recorder (timer, speed, segments) | — | ☐ | — | ☐ | ☐ |
| 60 | Reels editor (trim, audio, text, effects, voiceover) | — | ☐ | — | ☐ | ☐ |
| 61 | Reel share details (caption, cover, audience) | — | ☐ | — | ☐ | ☐ |
| 62 | Audio page (all reels using a sound) | — | ☐ | — | ☐ | ☐ |
| 63 | Remix / Sequence entry | — | ☐ | — | ☐ | ☐ |
| 64 | Reels comments & share (reuse Phase 4 components) | — | ☐ | — | ☐ | ☐ |

## Phase 7 — Search & Explore

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 65 | Explore grid | — | ☐ | — | ☐ | ☐ |
| 66 | Search results (top, accounts, audio, tags, places) | — | ☐ | — | ☐ | ☐ |
| 67 | Recent searches | — | ☐ | — | ☐ | ☐ |
| 68 | Hashtag page | — | ☐ | — | ☐ | ☐ |
| 69 | Location / Place page | — | ☐ | — | ☐ | ☐ |
| 70 | Explore post scroller (post opened from Explore) | — | ☐ | — | ☐ | ☐ |

## Phase 8 — Notifications / Activity

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 71 | Notifications (Activity) feed | — | ☐ | — | ☐ | ☐ |
| 72 | Follow requests (private accounts) | — | ☐ | — | ☐ | ☐ |
| 73 | Suggested for you / Discover people | — | ☐ | — | ☐ | ☐ |

## Phase 9 — Direct Messages

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 74 | Inbox (chats list, primary/general/requests tabs, notes row) | — | ☐ | — | ☐ | ☐ |
| 75 | Message requests | — | ☐ | — | ☐ | ☐ |
| 76 | Chat thread (text, media, voice notes, reactions, replies, shared posts/reels, typing & seen states) | — | ☐ | — | ☐ | ☐ |
| 77 | New message / select recipients | — | ☐ | — | ☐ | ☐ |
| 78 | Group chat creation | — | ☐ | — | ☐ | ☐ |
| 79 | Chat details / settings (mute, members, theme, nickname, vanish mode, block, report) | — | ☐ | — | ☐ | ☐ |
| 80 | Media viewer in chat (incl. view-once) | — | ☐ | — | ☐ | ☐ |
| 81 | Notes (create / view) | — | ☐ | — | ☐ | ☐ |
| 82 | Voice & video call screens | — | ☐ | — | ☐ | ☐ |

## Phase 10 — Live

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 83 | Go Live (broadcaster setup & broadcast) | — | ☐ | — | ☐ | ☐ |
| 84 | Live viewer (comments, hearts, requests to join) | — | ☐ | — | ☐ | ☐ |
| 85 | Live replay / archive | — | ☐ | — | ☐ | ☐ |

## Phase 11 — Settings & Privacy

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 86 | Settings & activity hub | — | ☐ | — | ☐ | ☐ |
| 87 | Accounts Center (personal details, password & security) | — | ☐ | — | ☐ | ☐ |
| 88 | Change password | — | ☐ | — | ☐ | ☐ |
| 89 | Two-factor authentication settings | — | ☐ | — | ☐ | ☐ |
| 90 | Login activity | — | ☐ | — | ☐ | ☐ |
| 91 | Account privacy (public/private) | — | ☐ | — | ☐ | ☐ |
| 92 | Blocked accounts | — | ☐ | — | ☐ | ☐ |
| 93 | Restricted accounts | — | ☐ | — | ☐ | ☐ |
| 94 | Muted accounts | — | ☐ | — | ☐ | ☐ |
| 95 | Hidden words / comment controls | — | ☐ | — | ☐ | ☐ |
| 96 | Tags & mentions controls | — | ☐ | — | ☐ | ☐ |
| 97 | Story, Live & location settings | — | ☐ | — | ☐ | ☐ |
| 98 | Messages & story replies controls | — | ☐ | — | ☐ | ☐ |
| 99 | Sharing & reuse (remix) settings | — | ☐ | — | ☐ | ☐ |
| 100 | Notification settings (push & email) | — | ☐ | — | ☐ | ☐ |
| 101 | Content preferences / sensitive content | — | ☐ | — | ☐ | ☐ |
| 102 | Suggested content / Not interested management | — | ☐ | — | ☐ | ☐ |
| 103 | Time management (daily limit, quiet mode) | — | ☐ | — | ☐ | ☐ |
| 104 | Language, theme (dark mode) & accessibility (captions) | — | ☐ | — | ☐ | ☐ |
| 105 | Data & media (cellular usage, upload quality) | — | ☐ | — | ☐ | ☐ |
| 106 | Download your information | — | ☐ | — | ☐ | ☐ |
| 107 | Supervision / Family Center (teen accounts) | — | ☐ | — | ☐ | ☐ |
| 108 | Help center / report a problem | — | ☐ | — | ☐ | ☐ |
| 109 | About (terms, privacy policy, open-source libraries) | — | ☐ | — | ☐ | ☐ |
| 110 | Deactivate / delete account | — | ☐ | — | ☐ | ☐ |
| 111 | Log out (single / all accounts) | — | ☐ | — | ☐ | ☐ |

## Cross-cutting

| Item | Status | Notes |
|---|---|---|
| Push notifications (Expo Notifications + Edge Functions) | ☐ | |
| Deep links (profile, post, reel, story) | ☐ | |
| Realtime (DMs, typing, notifications, live comments) | ☐ | |
| Media pipeline (compression, thumbnails, video) | ☐ | |
| Feed ranking / Explore recommendations | ☐ | |
| Moderation & reporting backend | ☐ | |
