# Instagram Clone — Master Plan & Page Inventory

## Context
Goal: an Instagram-like app for Android and iOS that clones Instagram's consumer social features. Work is scoped **per page**. This plan only establishes the stack, the per-page workflow, and the full list of pages; it intentionally does **not** describe how each page works — that is produced by the deep research step when each page's work starts.

Decisions made:
- **Framework:** Expo (React Native, TypeScript, Expo Router, EAS Build).
- **Backend:** Supabase (Postgres + Auth + Realtime + Edge Functions).
- **Media storage:** Supabase Storage used as the S3-bucket equivalent.
- **Out of scope:** business/monetization surfaces (Ads Manager, Shopping checkout, Subscriptions, Professional dashboard/Insights, Meta Verified).

## Per-page workflow (applied to every page below)
1. **Deep research** — layout, navigation in/out, states (empty/loading/error), interactions, gestures, features, and the data each element needs. Use current Instagram (iOS + Android) as reference.
2. **Write a page spec** from `docs/pages/_TEMPLATE.md` → `docs/pages/<NNN>-<slug>.md` (e.g. `001-splash.md`, `043-home-feed.md`).
3. **Ask the user**: fully clone, or apply changes (drop / alter / add features)? Record the answer in the spec.
4. **Schema & storage** — Supabase migration(s), RLS policies, buckets/paths needed by the page.
5. **Build** the screen + components, wire to Supabase.
6. **Verify** on Android emulator and iOS simulator (Expo Go / dev client); check RLS with a second test user.
7. Mark the page done in the tracker (`docs/pages/README.md`).

## Phase 0 — Foundation (not a page; prerequisite)
- Expo app scaffold (TypeScript, Expo Router, ESLint/Prettier), design tokens (light/dark), icon set, shared components (Avatar, Button, BottomSheet, Toast).
- Supabase project + local CLI, `supabase/migrations/`, generated TS types, `supabase-js` client.
- Storage buckets (S3 simulation): `avatars`, `posts`, `reels`, `stories`, `messages`, `highlights-covers` — with RLS-based access policies and signed URLs for private content.
- Bottom tab navigator shell: Home · Search/Explore · Create · Reels · Profile.

## Phase dependencies
Phases can be started in any order once Phase 0 is done. If a prerequisite isn't built yet, create only the **minimal prerequisite** (table, stub component, seed data), mark it in the tracker, and tell the user.

| Phase | Needs | Provides (core objects) |
|---|---|---|
| 0 Foundation | — | app shell, Supabase client, buckets, theme, shared UI |
| 1 Auth | 0 | `profiles`, auth session, account switching |
| 2 Profile | 1 · (3 for real grids; otherwise empty states) | `follows`, `follow_requests`, `close_friends`, `favorites`, `saved_collections`, `highlights` |
| 3 Creation | 1 | `posts`, `post_media`, `post_tags`, `locations`, `audio_tracks`, `drafts`, media upload pipeline |
| 4 Feed | 2, 3 | `likes`, `comments`, `saves`, `shares`, `reports`; PostCard, Comments, ShareSheet |
| 5 Stories | 1, 3 (media pipeline) · 4 (stories tray placement) | `stories`, `story_views`, `story_stickers` |
| 6 Reels | 3, 4 | `reels` (or `posts.type = reel`), video player, remix |
| 7 Explore | 3 · 4 for post views | `hashtags`, `post_hashtags`, `search_history`, discovery queries |
| 8 Notifications | 2, 4 | `notifications`, push token storage, Edge Function fan-out |
| 9 Direct | 2 · 4 (sharing posts) | `threads`, `thread_members`, `messages`, `notes`, Realtime channels |
| 10 Live | 5 · needs streaming-provider decision at research time | `live_sessions`, live comments |
| 11 Settings | 1 · each setting needs the feature it controls | `user_settings`, `blocks`, `mutes`, `restricts`, `hidden_words` |

## Page Inventory (build order by phase)

### Phase 1 — Onboarding & Authentication
1. Splash / Launch screen
2. Welcome / Landing (Log in vs. Create account)
3. Log in
4. Sign up – phone or email entry
5. Sign up – confirmation code
6. Sign up – full name & password
7. Sign up – birthday
8. Sign up – username
9. Sign up – terms & policies agreement
10. Sign up – add profile photo
11. Sign up – find contacts / follow suggestions
12. Forgot password / account recovery
13. Reset password
14. Two-factor authentication code entry
15. Account switcher (multiple accounts) sheet

### Phase 2 — Profile
16. Own Profile (grid / reels / tagged tabs)
17. Other user's Profile
18. Private account profile (locked state)
19. Edit Profile (name, username, pronouns, bio, links, gender)
20. Change profile photo sheet
21. Followers / Following lists
22. Mutual followers list
23. Profile options menu (share, QR code, copy URL, about this account)
24. QR code / Nametag page
25. Story Highlights – create / edit / cover selection
26. Saved (collections list)
27. Saved collection detail / create & edit collection
28. Archive (posts, stories, live archive)
29. Your activity (interactions, time spent, recently deleted)
30. Close Friends list management
31. Favorites list management

### Phase 3 — Content Creation
32. Create entry / media picker (post, story, reel, live switcher)
33. Camera (photo/video capture)
34. Multi-select & crop (carousel)
35. Filters & edit (adjust, brightness, etc.)
36. New post details (caption, tag people, location, music, alt text, advanced settings)
37. Tag people
38. Location search / add location
39. Music picker
40. Upload progress / posting state
41. Edit existing post
42. Drafts

### Phase 4 — Home Feed & Post Interactions
43. Home Feed (header, stories tray, post feed, suggested posts)
44. Post detail (single post view)
45. Carousel viewer / media zoom
46. Comments (threaded replies, likes, pin, emoji bar)
47. Likes list
48. Share sheet (send to DMs, add to story, copy link)
49. Post options menu (save, report, hide, unfollow, not interested, about this account)
50. Report flow
51. Feed variants: Following / Favorites feeds

### Phase 5 — Stories
52. Story viewer (progress bars, reply, react, swipe between users)
53. Story camera
54. Story editor (text, stickers, drawing, mentions, music, links, polls, questions, quiz, countdown, emoji slider)
55. Story audience / share options (Your story vs. Close Friends)
56. Story viewers list & insights (own story)
57. Highlights viewer

### Phase 6 — Reels
58. Reels feed (vertical full-screen player)
59. Reels camera / recorder (timer, speed, segments)
60. Reels editor (trim, audio, text, effects, voiceover)
61. Reel share details (caption, cover, audience)
62. Audio page (all reels using a sound)
63. Remix / Sequence entry
64. Reels comments & share (reuse Phase 4 components)

### Phase 7 — Search & Explore
65. Explore grid
66. Search results (top, accounts, audio, tags, places)
67. Recent searches
68. Hashtag page
69. Location / Place page
70. Explore post scroller (post opened from Explore)

### Phase 8 — Notifications / Activity
71. Notifications (Activity) feed
72. Follow requests (private accounts)
73. Suggested for you / Discover people

### Phase 9 — Direct Messages
74. Inbox (chats list, primary/general/requests tabs, notes row)
75. Message requests
76. Chat thread (text, media, voice notes, reactions, replies, shared posts/reels, typing & seen states)
77. New message / select recipients
78. Group chat creation
79. Chat details / settings (mute, members, theme, nickname, vanish mode, block, report)
80. Media viewer in chat (incl. view-once)
81. Notes (create / view)
82. Voice & video call screens

### Phase 10 — Live
83. Go Live (broadcaster setup & broadcast)
84. Live viewer (comments, hearts, requests to join)
85. Live replay / archive

### Phase 11 — Settings & Privacy
86. Settings & activity hub
87. Accounts Center (personal details, password & security)
88. Change password
89. Two-factor authentication settings
90. Login activity
91. Account privacy (public/private)
92. Blocked accounts
93. Restricted accounts
94. Muted accounts
95. Hidden words / comment controls
96. Tags & mentions controls
97. Story, Live & location settings
98. Messages & story replies controls
99. Sharing & reuse (remix) settings
100. Notification settings (push & email)
101. Content preferences / sensitive content
102. Suggested content / Not interested management
103. Time management (daily limit, quiet mode)
104. Language, theme (dark mode) & accessibility (captions)
105. Data & media (cellular usage, upload quality)
106. Download your information
107. Supervision / Family Center (teen accounts)
108. Help center / report a problem
109. About (terms, privacy policy, open-source libraries)
110. Deactivate / delete account
111. Log out (single / all accounts)

### Cross-cutting (built alongside pages, not standalone)
- Push notifications (Expo Notifications + Supabase Edge Function triggers)
- Deep links (profile, post, reel, story URLs)
- Realtime (DMs, typing, notifications, live comments) via Supabase Realtime
- Media pipeline: client-side compression, thumbnails, video transcoding strategy
- Feed ranking / Explore recommendation queries
- Moderation & reporting backend

## Critical files to create (Phase 0)
- `app/` (Expo Router routes: `(auth)/`, `(tabs)/`, modal routes)
- `src/lib/supabase.ts`, `src/theme/`, `src/components/`
- `supabase/migrations/`, `supabase/config.toml`
- `docs/pages/README.md` (tracker) and `docs/pages/<page-id>.md` (per-page specs)

## Verification
- Phase 0: app boots on Android emulator + iOS simulator; Supabase client authenticates; a test file uploads to and downloads from each storage bucket with RLS enforced.
- Per page: the spec's feature checklist passes on both platforms; RLS checked with two test accounts; Supabase advisors (`get_advisors`) report no security issues after each migration.
