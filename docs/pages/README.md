# Page Tracker

Single source of truth for progress. Update after **every** workflow step.

**Legend:** ☐ not started · ◐ in progress · ☑ done · Decision: `—` pending, `Clone`, or `Changes` (details in the spec + DECISIONS.md)
**Spec file:** `docs/pages/<NNN>-<slug>.md` (from `_TEMPLATE.md`)

## Current focus
**Phase 0 — Foundation:** built and checked locally (2026-10-05). Two items still open:
- **On-device check:** no Android SDK on the dev machine, and an iOS simulator needs macOS. Verified so far: both native bundles compile (`expo export`), the web build was clicked through in light and dark mode, and storage RLS was tested with two users (`node scripts/test-storage-rls.mjs`). Still to do: open in Expo Go on a real Android phone and iPhone.
- **Hosted Supabase project:** deferred by the user (2026-10-05); local stack only for now.

**Phase 1 — Onboarding & Authentication:** pages 1–13 and 15 built (2026-10-07); page 14 (2FA) deferred to Phase 11.
- Verified: `node scripts/test-auth-flow.mjs` (33 checks: sign-up, login by username/email, errors, recovery, RLS between two users), `node scripts/test-storage-rls.mjs` (19), DB lint clean, both native bundles compile, and the whole flow clicked through on web (light + dark): sign-up → onboarding → Home, add account → switch → logout → one-tap login, forgot password → reset.
- **On iPhone (Expo Go):** password login confirmed working (2026-10-07) after fixing the keychain session storage bug (chunking regex). 
- **Still to verify on a real phone (Expo Go):** native date picker (iOS wheel / Android dialog), photo upload (camera + library), contact sync, Profile-tab long-press, keychain session storage. Web can't exercise these.
- Test accounts: `node scripts/create-test-user.mjs <username>` (logins go to git-ignored `.test-users.local.json`).

**Phase 2 — Profile:** built 2026-10-08 (pages 16–27, 30, 31; 28 Archive and 29 Your activity deferred to their owning phases by decision).
- Verified: `node scripts/test-profile-rls.mjs` (42 checks: privacy, requests, lists, close friends, favorites, collections, bell), Phase 1 scripts still pass, DB lint clean, typecheck + lint clean, both native bundles compile, and clicked through on web (light + dark): own profile, private → requested → approved profile, Following sheet, lists, edit bio, links sheet, QR, Close friends, Saved collections.
- **Still to verify on a real phone (Expo Go):** QR download + scanner (camera), photo change, share sheet, swipe between profile tabs, sheets' drag-to-dismiss.

**Phase 3 — Content Creation:** built 2026-10-08 (pages 32–37, 39–42; 38 Location dropped by decision). Posts archive (posts part of page 28) built here too.
- Verified: `node scripts/test-posts-rls.mjs` (59 checks: upload→publish, private/close-friends visibility incl. signed URLs, caption limits, hashtags/mentions, tags + self-untag, reorder, alt text, collaborators, archive, pin limit, audio catalog, collection FK), Phase 0–2 scripts still pass, DB lint clean, typecheck + lint clean, both native bundles compile. Clicked through on web (dark + light): Create → Library (2 photos) → crop/ratio toggle → caption with @/# autocomplete → Tag people → music + clip window → Share → "Posted" banner → profile grid → post view → Pin / Edit caption / Archive → Posts archive.
- Music catalog: run `node scripts/seed-audio.mjs` after every `npx supabase db reset` (8 generated placeholder loops).
- **Still to verify on a real phone (Expo Go):** OS multi-picker (ordered selection), camera photo + hold-to-record video (mic permission), pinch/drag crop, long-press drag reorder, video playback/posters, upload progress + resume after killing the app + auto-retry when back online, drafts in app storage, "Save draft?" on back/swipe, music preview playback.

**Phase 4 — Home Feed & Post Interactions:** built 2026-10-08 (pages 43–51; Changes on 46 = no GIFs / translation, 48 = DM + story sharing wait for Phases 9 / 5).
- Verified: `node scripts/test-feed-rls.mjs` (105 checks: likes incl. hidden counts, comments / replies / pin ≤3 / hide / delete, comment likes, saves ↔ collections, reposts rules + note + Reposts tab, Home / suggested / Following / Favorites feeds, hides, impressions, reports), Phase 0–3 scripts still pass, DB lint clean, typecheck + lint clean, both native bundles compile. Clicked through on web (dark + light, phone viewport) as `dev.viewer`: ranked Home with favorite boost, repost line, close-friends badge, hidden like count, "You're all caught up" → suggested posts with Follow, comment + emoji + reply thread, ⋯ options, report → thanks + post gone from Home, share sheet → Repost (count + Reposts tab), Favorites feed, profile grid → post scroller.
- Demo data: `node scripts/seed-feed.mjs` after every `npx supabase db reset` (and `node scripts/seed-audio.mjs`). Log in as `dev.viewer` (password in `.test-users.local.json`).
- **Still to verify on a real phone (Expo Go):** pinch-to-zoom overlay, double-tap heart + haptics, comments form sheet (detents, keyboard), video autoplay / shared mute in the feed, long-press bookmark, share "Share to…" OS sheet, scroller keeping position when earlier posts are revealed.
- **Not built yet from page 29 (Your activity):** the "Interactions" section (your likes / comments) was scheduled for Phase 4 by the page 29 decision; it needs the Settings / Your activity hub (Phase 11) or a small screen now — ask before building.

**Phase 5 — Stories:** built 2026-10-09 (pages 52–57, plus the page 25 highlight editor and the page 28 stories archive). Decisions: 52 Changes (replies stored until DMs), 53 Changes (+ Boomerang, Layout, Hands-free, Create), 54 Changes (core stickers + photo sticker, no GIF / location / filters), 55 Changes (full story settings now), 56 + 57 Full clone (archive Calendar, no Map).
- Verified: `node scripts/test-stories-rls.mjs` (112 checks: publishing + file checks, Close Friends / private / hide-from visibility incl. signed URLs, tray + rings, views (48 h names), private likes, replies + reply settings, poll / quiz / slider / question / countdown rules incl. hidden quiz answers, mentions, Add yours chains, expiry, archive + purge, highlights, post sticker + resharing setting, reports, deletion), Phase 0–4 scripts still pass, DB lint clean, typecheck + lint clean, both native bundles compile. Clicked through on web (phone viewport, dark + light): tray rings (unseen / Close Friends / own) → viewer auto-advance, cube transition to the next user, countdown "Remind me", own story → Activity sheet (quiz voters, ranked viewers with likes / replies / answers), Create → text with @ suggestions → poll sticker → Your story (upload + publish), stories archive grid + calendar, highlight viewer, New highlight → profile row, story settings.
- Demo data: `node scripts/seed-stories.mjs` after `seed-audio` + `seed-feed` (re-run after every `npx supabase db reset`).
- **Still to verify on a real phone (Expo Go):** camera capture (tap / hold / Hands-free), Boomerang burst speed, Layout capture, library multi-pick, pinch / rotate of items and media, drawing feel, video stories + music playback, hold-to-pause, swipe up / down gestures, keyboard + quick reactions, Save to photos, upload queue resume after restart.

Next: Phase 6 — Reels (`/start-phase 6`): needs Phase 3 (media pipeline) and Phase 4 (comments / share components), both done.

## Prerequisite stubs
_Minimal objects created ahead of their owning phase (so they get finished properly later)._

| Object | Created for page | Owning phase | Status |
|---|---|---|---|
| `follows` table (follower/following, select-all, insert/delete own) + `useFollow`, `FollowButton` | 011 | 2 — Profile | **Resolved** in Phase 2 (privacy-aware RLS, requests, counters). Notifications still Phase 8 |
| Own-profile placeholder (username ▾ switcher, temporary Log out) | 015 | 2 — Profile (page 16) / 11 — Settings (log out) | **Resolved** by page 16; Log out moved to the ☰ menu stub below |
| ☰ "Settings and activity" sheet (Saved, Close Friends, Favorites, Follow requests, QR, Log out) | 016 | 11 — Settings (page 86) | Stub: replace with the real Settings hub |
| `app/follow-requests.tsx` (Confirm / Delete) + `useFollowRequests` | 018 | 8 — Notifications (page 72) | Stub: move into Activity |
| Temporary "Private account" switch in Edit profile | 018/019 | 11 — Settings (page 91) | Stub: move to Account privacy |
| Message button, Mute, Restrict, Block, Report, Hide story entries ("Coming soon") | 017/023 | 4, 5, 9, 11 | Wire up when each feature exists |
| Highlights editor placeholder (`app/highlights/new.tsx`) | 025 | 5 — Stories | **Resolved** in Phase 5 (editor, `highlight_items`, viewer) |
| `saved_collection_items.post_id` without FK; collections empty | 026/027 | 3 (FK) / 4 (saves, bookmark) | **Resolved**: FK in Phase 3; `saves`, bookmark and real Saved grids in Phase 4 |
| Own-post viewer `app/p/[id]` (media, tags, music, caption, ⋯ Edit/Archive/Pin/Hide likes/Commenting/Delete; others: Remove me, About, Report placeholder) | 041 | 4 — Feed (page 44) | **Resolved** by page 44 (own-post menu and "Remove me from post" now live in the shared ⋯ options sheet) |
| Home header ♡ (Activity) and Direct icons → "coming soon" toast | 043 | 8 — Notifications (71) / 9 — Direct (74) | Stub: wire to Activity and Inbox |
| Stories tray shows only your own "Your story" circle (toast) | 043 | 5 — Stories (52/53) | **Resolved** in Phase 5 (real tray, rings, upload progress) |
| Share sheet "Send to friends" + "Add to story" entries (toast) | 048 | 9 — Direct (76/77) / 5 — Stories (54) | "Add to story" **resolved** (post sticker); "Send to friends" still a Phase 9 stub |
| "Mute <user>" (hidden-post panel, report follow-ups), Restrict, Block | 049/050 | 11 — Settings (92–94) | Stub: "coming soon" until `mutes` / `blocks` / `restricts` exist; feeds must then exclude them |
| Report status / support requests (reports are stored only) | 050 | 11 — Settings (108) | Stub: no moderation UI |
| `app/collab-invites` (Accept / Decline) + ☰ "Collaboration invites" | 036 | 8 — Notifications (page 71) | Stub: move into Activity |
| `hashtags` / `post_hashtags` (caption-parsed, counts) | 036 | 7 — Explore (pages 66/68) | Stub: hashtag pages + search in Phase 7 |
| ☰ menu gains "Archive" (posts + stories archive, page 28) | 041 | 11 — Settings (page 86) / 10 (live archive) | Part of the ☰ stub; stories archive added in Phase 5 |
| Music on posts = placeholder catalog (`source = placeholder`) | 039 | 6 — Reels (audio page 62) | Replace with real CC0/licensed tracks |
| Story replies / quick reactions stored in `story_replies`; story ✈ share, "Send", viewer-row ✈ and share-screen "Send to chats" show "coming soon" | 052/055/056 | 9 — Direct (76) | Stub: move replies into DM threads, wire sending |
| Story countdown reminders + mentions stored without notifications | 054 | 8 — Notifications (71) | Stub: notify mentioned users and reminder holders |
| Story ⋯ "Mute" ("coming soon"); hashtag sticker tap ("coming soon") | 052 | 11 — Settings (94) / 7 — Explore (68) | Stub |
| Story settings screen lives at `app/story-settings` | 055 | 11 — Settings (page 97) | Page 97 links to it |

## Phase 0 — Foundation

| Task | Status |
|---|---|
| Expo app scaffold (TS, Expo Router, ESLint/Prettier) | ☑ Expo SDK 57, RN 0.86, React Compiler on |
| Theme tokens (light/dark), icons, fonts | ☑ `src/theme/`; `Icon` registry (Ionicons/MaterialCommunityIcons); system fonts |
| Shared components: Avatar, Button, BottomSheet, Toast | ☑ plus `Text`, `Icon`; demo at `/dev/ui` (dev only) |
| Supabase local CLI + project link + `src/lib/supabase.ts` | ☑ local stack + client; hosted project deferred (user decision) |
| Storage buckets + storage RLS + `src/lib/storage.ts` | ☑ migration `20261005165703_phase0_storage_buckets.sql`; 19/19 two-user RLS checks pass |
| Generated DB types + TanStack Query setup | ☑ `npm run db:types`; `src/lib/queryClient.ts`, `useMediaUrl` |
| Bottom tab shell (Home · Explore · Create · Reels · Profile) | ☑ Create opens the `/create-entry` modal |
| Verified on Android emulator + iOS simulator | ◐ bundles compile for both platforms + web UI checked; real-device run pending |

## Phase 1 — Onboarding & Authentication

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 1 | Splash / Launch screen | [spec](001-splash.md) | ☑ | Full clone | ☑ | ◐ |
| 2 | Welcome / Landing (Log in vs. Create account) | [spec](002-welcome.md) | ☑ | Full clone | ☑ | ◐ |
| 3 | Log in | [spec](003-login.md) | ☑ | Full clone | ☑ | ◐ |
| 4 | Sign up – phone or email entry | [spec](004-signup-contact.md) | ☑ | Changes | ☑ | ◐ |
| 5 | Sign up – confirmation code | [spec](005-signup-code.md) | ☑ | Changes | ☑ | ◐ |
| 6 | Sign up – full name & password | [spec](006-signup-name-password.md) | ☑ | Full clone | ☑ | ◐ |
| 7 | Sign up – birthday | [spec](007-signup-birthday.md) | ☑ | Changes | ☑ | ◐ |
| 8 | Sign up – username | [spec](008-signup-username.md) | ☑ | Full clone | ☑ | ◐ |
| 9 | Sign up – terms & policies agreement | [spec](009-signup-terms.md) | ☑ | Full clone | ☑ | ◐ |
| 10 | Sign up – add profile photo | [spec](010-signup-profile-photo.md) | ☑ | Changes | ☑ | ◐ |
| 11 | Sign up – find contacts / follow suggestions | [spec](011-signup-find-people.md) | ☑ | Full clone | ☑ | ◐ |
| 12 | Forgot password / account recovery | [spec](012-forgot-password.md) | ☑ | Changes | ☑ | ◐ |
| 13 | Reset password | [spec](013-reset-password.md) | ☑ | Full clone | ☑ | ◐ |
| 14 | Two-factor authentication code entry | [spec](014-two-factor-code.md) | ☑ | Deferred | — | — |
| 15 | Account switcher (multiple accounts) sheet | [spec](015-account-switcher.md) | ☑ | Full clone | ☑ | ◐ |

## Phase 2 — Profile

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 16 | Own Profile (grid / reels / tagged tabs) | [spec](016-own-profile.md) | ☑ | Full clone | ☑ | ◐ |
| 17 | Other user's Profile | [spec](017-user-profile.md) | ☑ | Full clone | ☑ | ◐ |
| 18 | Private account profile (locked state) | [spec](018-private-profile.md) | ☑ | Full clone | ☑ | ◐ |
| 19 | Edit Profile (name, username, pronouns, bio, links, gender) | [spec](019-edit-profile.md) | ☑ | Changes | ☑ | ◐ |
| 20 | Change profile photo sheet | [spec](020-change-profile-photo.md) | ☑ | Changes | ☑ | ◐ |
| 21 | Followers / Following lists | [spec](021-follow-lists.md) | ☑ | Changes | ☑ | ◐ |
| 22 | Mutual followers list | [spec](022-mutual-followers.md) | ☑ | Changes | ☑ | ◐ |
| 23 | Profile options menu (share, QR code, copy URL, about this account) | [spec](023-profile-options.md) | ☑ | Changes | ☑ | ◐ |
| 24 | QR code / Nametag page | [spec](024-qr-code.md) | ☑ | Changes | ☑ | ◐ |
| 25 | Story Highlights – create / edit / cover selection | [spec](025-highlights-editor.md) | ☑ | Changes | ☑ row (Phase 2) + editor (Phase 5) | ◐ |
| 26 | Saved (collections list) | [spec](026-saved.md) | ☑ | Changes | ☑ | ◐ |
| 27 | Saved collection detail / create & edit collection | [spec](027-saved-collection.md) | ☑ | Changes | ☑ | ◐ |
| 28 | Archive (posts, stories, live archive) | [spec](028-archive.md) | ☑ | Deferred | ◐ posts (Phase 3) + stories (Phase 5); live 10 | ◐ |
| 29 | Your activity (interactions, time spent, recently deleted) | [spec](029-your-activity.md) | ☑ | Deferred | — | — |
| 30 | Close Friends list management | [spec](030-close-friends.md) | ☑ | Full clone | ☑ | ◐ |
| 31 | Favorites list management | [spec](031-favorites.md) | ☑ | Full clone | ☑ | ◐ |

## Phase 3 — Content Creation

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 32 | Create entry / media picker (post, story, reel, live switcher) | [spec](032-create-entry.md) | ☑ | Changes | ☑ | ◐ |
| 33 | Camera (photo/video capture) | [spec](033-camera.md) | ☑ | Full clone | ☑ | ◐ |
| 34 | Multi-select & crop (carousel) | [spec](034-multi-select-crop.md) | ☑ | Full clone | ☑ | ◐ |
| 35 | Filters & edit (adjust, brightness, etc.) | [spec](035-filters-edit.md) | ☑ | Changes | ☑ | ◐ |
| 36 | New post details (caption, tag people, location, music, alt text, advanced settings) | [spec](036-new-post-details.md) | ☑ | Changes | ☑ | ◐ |
| 37 | Tag people | [spec](037-tag-people.md) | ☑ | Full clone | ☑ | ◐ |
| 38 | Location search / add location | [spec](038-location-search.md) | ☑ | Dropped | — | — |
| 39 | Music picker | [spec](039-music-picker.md) | ☑ | Changes | ☑ | ◐ |
| 40 | Upload progress / posting state | [spec](040-upload-progress.md) | ☑ | Full clone | ☑ | ◐ |
| 41 | Edit existing post | [spec](041-edit-post.md) | ☑ | Changes | ☑ | ◐ |
| 42 | Drafts | [spec](042-drafts.md) | ☑ | Full clone | ☑ | ◐ |

## Phase 4 — Home Feed & Post Interactions

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 43 | Home Feed (header, stories tray, post feed, suggested posts) | [spec](043-home-feed.md) | ☑ | Full clone | ☑ | ◐ |
| 44 | Post detail (single post view) | [spec](044-post-detail.md) | ☑ | Full clone | ☑ | ◐ |
| 45 | Carousel viewer / media zoom | [spec](045-carousel-zoom.md) | ☑ | Full clone | ☑ | ◐ |
| 46 | Comments (threaded replies, likes, pin, emoji bar) | [spec](046-comments.md) | ☑ | Changes | ☑ | ◐ |
| 47 | Likes list | [spec](047-likes-list.md) | ☑ | Full clone | ☑ | ◐ |
| 48 | Share sheet (send to DMs, add to story, copy link) | [spec](048-share-sheet.md) | ☑ | Changes | ☑ | ◐ |
| 49 | Post options menu (save, report, hide, unfollow, not interested, about this account) | [spec](049-post-options.md) | ☑ | Full clone | ☑ | ◐ |
| 50 | Report flow | [spec](050-report-flow.md) | ☑ | Full clone | ☑ | ◐ |
| 51 | Feed variants: Following / Favorites feeds | [spec](051-following-favorites-feeds.md) | ☑ | Full clone | ☑ | ◐ |

## Phase 5 — Stories

| # | Page | Spec | Research | Decision | Built | Verified |
|---|------|------|----------|----------|-------|----------|
| 52 | Story viewer (progress bars, reply, react, swipe between users) | [spec](052-story-viewer.md) | ☑ | Changes | ☑ | ◐ |
| 53 | Story camera | [spec](053-story-camera.md) | ☑ | Changes | ☑ | ◐ |
| 54 | Story editor (text, stickers, drawing, mentions, music, links, polls, questions, quiz, countdown, emoji slider) | [spec](054-story-editor.md) | ☑ | Changes | ☑ | ◐ |
| 55 | Story audience / share options (Your story vs. Close Friends) | [spec](055-story-audience.md) | ☑ | Changes | ☑ | ◐ |
| 56 | Story viewers list & insights (own story) | [spec](056-story-viewers.md) | ☑ | Full clone | ☑ | ◐ |
| 57 | Highlights viewer | [spec](057-highlights-viewer.md) | ☑ | Full clone | ☑ | ◐ |

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
| Media pipeline (compression, thumbnails, video) | ◐ | Phase 3: photos cropped + resized to 1080 px JPEG on device; video uploaded as recorded (≤60 s) with an on-device poster; no server transcoding. Phase 5: stories reuse it (photos 1080 px, Boomerang frames / photo stickers 720 px) |
| Feed ranking / Explore recommendations | ◐ | Phase 4: SQL-ranked Home (`home_feed`) + suggested posts (`suggested_posts`) with impressions and hides; Explore in Phase 7 |
| Moderation & reporting backend | ◐ | Phase 4: `reports` table + report flow (stored only, reporter's feeds hide the post); no review tooling |
