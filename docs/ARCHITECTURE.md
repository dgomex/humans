# Architecture & Conventions

> Phase 0 created this structure (2026-10-05). Update this file whenever the structure, conventions, or schema change.

## Folder structure
```
app/                      # Expo Router routes (file = screen). Root app/, NOT src/app/.
  _layout.tsx             # root providers + AuthProvider; root Stack with Stack.Protected groups per auth gate
  (auth)/                 # gate signedOut: welcome (saved profiles or login form), login, signup/{email,code}, recover/{index,code}
  (onboarding)/           # gate onboarding: password, save-info, birthday, name, username, terms, photo, contacts, suggestions
  (recovery)/new-password # gate recovery (after a recovery code)
  (session)/save-login    # gate savePrompt ("Save your login info?" after password login)
  legal/[doc].tsx         # placeholder Terms / Privacy / Cookies pages
  (tabs)/                 # bottom tabs; each tab is its own Stack so pushed screens keep the tab bar:
    (home)/index, (explore)/explore, (reels)/reels, (profile)/profile, create (stub, opens modal)
    (home)/feed/[kind]    # page 51: Following / Favorites feeds
    (home,explore,reels,profile)/  # shared routes (array group) + the per-tab Stack layout:
      [username]/{index,connections,about}  # profiles (16–18), followers/following/mutual (21–22), About (23)
      # cold deep links land in the first group alphabetically (Explore); in-app pushes stay in the current tab
  edit-profile/{index,[field],links}  # page 19 (no tab bar)
  saved/{index,new,[id]/index,[id]/edit}  # pages 26–27
  close-friends, favorites            # pages 30–31
  qr/{index,scan}                     # page 24 (full-screen modals)
  activity/{index,requests}           # pages 71 (Notifications) + 72 (Follow requests), pushed from Home ♡ / ☰
  discover-people                     # page 73 (suggestions with reasons, Connect contacts)
  highlights/{new,[id]/edit}          # page 25 highlight editor (Phase 5)
  compose/                # Phase 3 creation flow (full-screen modal, own Stack + ComposerProvider):
    index (32 entry: Library · Camera · Drafts), camera (33), edit (34/35 crop + strip),
    details (36), tag-people (37), collaborators, music (39), advanced, alt-text, drafts (42)
  p/[id]/index            # page 44: post detail (single post, or a scroller of a grid via ?source=&owner=)
  p/[id]/comments         # page 46 (transparent modal + ScreenSheet panel)
  p/[id]/likes            # page 47 (?comment= for comment likers)
  p/[id]/edit             # page 41 Edit info
  report                  # page 50 report flow (?type=post|comment|profile|story|audio|hashtag&id=)
  archive                 # page 28: ▾ Stories archive (grid / calendar, Phase 5) · Posts archive (Phase 3)
  stories/[userId]        # page 52 viewer (tray order); stories/highlight/[id] (57); stories/view?ids= (archive, Add yours)
  story/                  # Phase 5 creation modal (own Stack + StoryComposerProvider): camera (53), editor (54), share (55)
  story-settings/{index,hidden}       # page 55 story settings + Hide story from (page 97 links here later)
  dev/ui.tsx              # dev-only UI kit + Supabase connectivity check
  reel/[id]               # page 58: one reel (link → then suggested reels) or a scroller (?source=profile|audio|remixes|tag|search&owner=)
  (explore)/explore       # page 65 Explore grid (search field → /search)
  (explore)/search        # pages 66 + 67: recents (empty field), typeahead, results For you · Accounts · Reels · Audio · Tags (?q= re-runs a keyword)
  (explore)/recent-searches  # page 67 See all + Clear all
  (home,explore,reels,profile)/tags/[tag]    # page 68 hashtag page (Top · Recent · Reels)
  (home,explore,reels,profile)/explore-feed  # page 70 post scroller (?id=&source=explore|tag|search&owner=&tab=&title=)
  (home,explore,reels,profile)/audio/[id]    # page 62 audio page (shared, keeps the tab bar)
  (home,explore,reels,profile)/remixes/[id]  # page 63 "View remixes"
  (reels)/reels           # page 58 Reels tab (vertical pager)
  compose/reel/           # Phase 6 creation (same compose Stack + ComposerProvider, `state.reel`): camera (59 + remix 63),
                          # edit (60 tools), timeline (60 Edit video), voiceover, details (61), cover (61)
  saved/audio             # page 26 → Audio tile (saved sounds)
  direct/                 # Phase 9 (pages 74–81): index (inbox + notes row), requests (?hidden=1), new (77), new-group (78),
                          # note (81 composer), send (Send to sheet: ?post|story|profile|audio|forward=), media/[messageId] (80),
                          # u/[userId] (profile Message → 1:1), join/[token] (invite link), t/[id]/{index (76), details (79),
                          # members, add, nicknames, theme, filtered (pinned · media/links/posts · scheduled · search),
                          # invite (link + QR), join-requests}
src/
  components/             # shared UI: Avatar, Button, BottomSheet, Toast, Icon, Text, TextField, UserRow, ActionRow/ActionGroup (sheet menus), SearchField (barrel: @/components)
  features/<area>/        # per-area logic: api.ts (Supabase queries), hooks.ts, components/
  features/shell/         # PlaceholderScreen for routes whose page isn't built yet
  features/auth/          # AuthProvider (gate, sessions, accounts), api.ts, savedAccounts.ts, components/ (AuthStep, LoginForm, CodeStep, SaveLoginView, AccountSwitcher, AppLogo, LanguageSelector)
  features/onboarding/    # SignupDraft (values across steps), contacts.ts (hashed email sync)
  features/follows/       # api.ts (useSuggestedAccounts, bulk useFollow), FollowButton (Follow / Follow back / Following / Requested)
  features/profile/       # api.ts (get_profile, follow actions, lists, close friends/favorites, bell, follow requests), format.ts (counts, profile URLs, openProfile),
                          # avatar.ts, saveQrImage(.web).ts, components/ (ProfileView, ProfileTabs, BioText, HighlightsRow, SuggestedStrip, ProfileSheets, ChangePhotoSheet, PeoplePickerList, TopBar)
  features/saved/         # api.ts (collections), CollectionTile
  features/create/        # Phase 3: ComposerProvider (flow state), types.ts, media.ts (OS picker, crop math, renderPhoto, video posters),
                          # UploadQueue (persisted per-account queue, page 40), drafts.ts + localFiles.ts (device-only), useOpenLibrary,
                          # useSaveDraftGuard, components/ (CropView, CroppedImage, SortableStrip, UploadBanner)
  features/posts/         # api.ts (profile_posts grids, usePost, flags, edits, collab invites, search_profiles, hashtags, music catalog),
                          # components/ (CaptionInput @/# autocomplete, CaptionText, TagEditor, PersonSearchSheet, LoopingVideo)
  features/feed/          # Phase 4: api.ts (post_cards cache per post, home / chrono / scroller feeds, likes, saves, reposts,
                          # hides, impressions, comments, likers, reports), format.ts (timeAgo, shortAge, postUrl, shared mute),
                          # components/ (PostCard, PostMedia, ZoomOverlay + ZoomProvider, FeedList, PostSheets + PostSheetsProvider
                          # = share / ⋯ options / collections / why / repost note, CommentComposer)
  features/reels/         # Phase 6: types.ts (ReelDoc v1 edit list: clips / trims / speed, volumes, voiceovers, timed overlays,
                          # remix trims), source.ts (card or composer → segments timeline), api.ts (reels_feed, scrollers,
                          # useReelSource incl. remix original + borrowed original audio, plays, audio page, remixes, saved audio),
                          # composer.ts (reel actions on the shared composer), format.ts (reel links, session mute / speed),
                          # components/ (ReelPlayer = live edit-list player with 2 alternating video players + music + voiceovers +
                          # overlays + remix layouts, ReelView, ReelPager, FeedReel, ReelGrid, ReelSheets, RangeSlider, VolumeSlider)
  features/explore/       # Phase 7: api.ts (explore_grid, Explore scroller = source list → similar_posts, hashtag page + grids,
                          # search accounts / tags / audio / posts, recent searches), format.ts (openTile, openHashtag, hashtagUrl),
                          # components/ (ExploreGrid = block layout with tall reel tiles + muted autoplay + long-press preview,
                          # TilePreview, SearchRows)
  features/activity/      # Phase 8: api.ts (activity_feed infinite query + seen state, badge, delete, inline comment like /
                          # collab answer, follow requests summary / list / answer / requestFrom, suggestions + dismissals),
                          # format.ts (section titles, action sentences, openTarget), ActivityAlerts (Realtime listener + top
                          # banner, root layout), components/ (NotificationRow, ActivityHeart = Home ♡ dot + bubble, Suggestions,
                          # RequestBanner)
  features/stories/       # Phase 5: types.ts (content doc v1, 1080×1920 canvas), style.ts (story palette, fonts), api.ts (tray, rings,
                          # reels / story_cards + signed URLs, views, likes, replies, sticker answers, viewers, archive, highlights,
                          # settings, hide list), StoryComposer (flow state), StoryUploads (persisted upload queue), viewerQueue,
                          # saveMedia(.web).ts, components/ (StoryCanvas, StickerView, StoryPlayer, StoryPager, StoryFooter,
                          # StorySheets, ViewersSheet, StoriesTray, StoryThumb, ArchiveGrid, HighlightEditor, editor/{EditableElement,
                          # TextTool, DrawTool, StickerTray})
  features/direct/        # Phase 9: api.ts (inbox / badge / thread info / messages + signed URLs, sendMessage + sendToTargets
                          # (uploads), message actions, thread RPC mutation, notes, presence, purge), format.ts (titles, previews,
                          # system lines, seen text, THEMES, mute options), realtime.tsx (DirectAlerts = inbox topic + banner +
                          # presence heartbeat + file purge; useThreadChannel = thread topic + typing), media.ts (picker, camera,
                          # 1440 px downscale), saveMedia(.web).ts, components/ (ThreadRow, ThreadAvatar, Notes = NotesRow /
                          # NoteSheet / ProfileNote, MessageBubble, MessageContent, Composer, ThreadSheets, PeoplePicker, DirectIcon)
  lib/navigation.ts       # goBack(fallback): back, or replace when there's no history (deep links / reloads)
  lib/useDebounced.ts     # debounced value (search fields)
  lib/dialog.ts           # showDialog(): native Alert, browser confirm/alert on web — use instead of Alert
  lib/supabase.ts         # supabase-js client (publishable key + chunked SecureStore session)
  lib/secureStorage.ts    # Keychain/Keystore adapter (chunks values >1.8 KB)
  lib/storage.ts          # BUCKETS, storagePaths, upload/public/signed URL helpers, uploadFileWithProgress (native upload task)
  lib/useMediaUrl.ts      # cached public/signed URL hook
  lib/queryClient.ts      # TanStack Query client + AppState focus
  theme/                  # tokens: colors (light/dark), spacing/radius, typography; useTheme()
  types/database.ts       # generated Supabase types (never hand-edit; npm run db:types)
scripts/
  test-storage-rls.mjs    # two-user storage RLS check against the local stack
  test-auth-flow.mjs      # Phase 1 end-to-end auth + RLS check (reads codes from Mailpit)
  test-profile-rls.mjs    # Phase 2 privacy / follows / lists / collections RLS check (three fresh users)
  test-posts-rls.mjs      # Phase 3 posts / media / tags / collaborators / archive / pin RLS check (three fresh users)
  test-feed-rls.mjs       # Phase 4 likes / comments / saves / reposts / feeds / hides / reports RLS check (four fresh users)
  seed-audio.mjs          # synthesize + upload the placeholder music catalog (re-run after db reset)
  seed-feed.mjs           # demo graph for the feed: dev.viewer + 4 accounts, generated photos, likes, comments, a repost
  seed-stories.mjs        # demo stories (run after seed-feed): stickers, CF story, views / likes / replies, archive + highlight
  seed-reels.mjs          # demo reels (run after seed-feed): photo-clip reels with music, timed text, speed, remixes, a linked reel
  test-reels-rls.mjs      # Phase 6 reels / plays / original audio / remix / linked reel / feed RLS check (four fresh users)
  test-explore-rls.mjs    # Phase 7 explore / similar / hashtag / search / recent searches / hashtag reports RLS check (four fresh users)
  test-activity-rls.mjs   # Phase 8 notifications / follow requests / badge / feed / suggestions RLS check (five fresh users)
  seed-activity.mjs       # demo Activity for dev.viewer + follow requests for cam.private (run after seed-feed; backdates via service key)
  test-direct-rls.mjs     # Phase 9 DMs / requests / groups / media / vanish / scheduled / notes / presence / realtime RLS check (five fresh users; --cron waits for delivery)
  seed-direct.mjs         # demo DMs for dev.viewer: chats, a group, requests, notes (run after seed-audio + seed-feed)
  test-stories-rls.mjs    # Phase 5 stories / stickers / views / replies / settings / highlights RLS check (four fresh users)
  lib/seed.mjs            # shared seed helpers (PNG encoder, get-or-create accounts)
  create-test-user.mjs    # create a finished local account; logins → .test-users.local.json (git-ignored)
supabase/
  config.toml
  migrations/             # <timestamp>_<page-or-feature>.sql
  functions/              # Edge Functions (push, fan-out, moderation…)
    account-auth/         # pre-login: lookup / login / recover-start / recover-verify (username → email stays server-side)
  templates/code.html     # 6-digit email code template (sign-up + recovery)
  seed.sql                # test users & sample content (not created yet)
docs/                     # PLAN, ARCHITECTURE, DECISIONS, pages/, EXPO_AGENTS.md (Expo SDK guidance)
```

## Environment & local dev
- `.env.local` (git-ignored, template `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable key). Values: `npx supabase status`.
- On Android, `supabase.ts` rewrites `127.0.0.1`/`localhost` to `10.0.2.2` (emulator host). On a physical device, use the PC's LAN IP.
- Install packages with `npx expo install <pkg>` (SDK-matched versions). Expo SDK 57: check the versioned docs, not memory (see `docs/EXPO_AGENTS.md`).
- Scripts: `npm run typecheck | lint | format | db:start | db:reset | db:types`; `node scripts/test-storage-rls.mjs`.

## Auth model (Phase 1)
- Email-only accounts. Sign-up = email OTP (creates `auth.users`, no profile) → password → … → `complete_signup()` on "I agree". A session without a `profiles` row = unfinished sign-up → onboarding.
- `AuthProvider.gate`: `loading | signedOut | onboarding | recovery | savePrompt | signedIn`; the root layout guards route groups with it (no manual redirects in screens).
- Login by username goes through the `account-auth` Edge Function so clients never see another user's email.
- Multiple accounts: `savedAccounts` (SecureStore) keeps each account's refresh token; switching = `refreshSession(token)`; `forgetLocalSession()` drops the active session locally **without revoking** it (needed for saved logins). Query cache is cleared on every account change.
- Local Supabase URL in dev is rewritten to the Expo dev-server host, so Expo Go on a phone reaches the PC's stack.

## Coding conventions
- TypeScript strict. Functional components + hooks.
- Data fetching: TanStack Query wrapping Supabase calls in `src/features/<area>/api.ts`.
- Screens stay thin; logic lives in `features/`.
- Forms: `TextField` (floating label, eye toggle, status, error). Dialogs: `showDialog` from `@/lib/dialog`, never `Alert` directly.
- Styling: theme tokens only via `useTheme()` (no hard-coded colors), with light and dark mode. Use `<Text variant color>` and `<Icon name>` (semantic names in `Icon.tsx`; add new glyphs there).
- Reanimated 4 + React Compiler: use `sv.get()/sv.set()` (not `.value`) and `scheduleOnRN` from `react-native-worklets` (not `runOnJS`). Lint enforces the compiler rules.
- Names: components `PascalCase.tsx`, hooks `useX.ts`, routes kebab-case or Expo Router conventions.

## Supabase conventions
- Tables: `snake_case`, plural (`posts`, `post_media`, `follows`). PK `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`.
- `profiles.id` = `auth.users.id` (1:1).
- RLS enabled on **every** table; policies named `<table>_<action>_<who>`.
- Counters (likes, followers) are kept by triggers or views, never updated from the client.
- One migration per page/feature; never edit an applied migration.

## Storage (S3 simulation)
| Bucket | Visibility | Path pattern |
|---|---|---|
| `avatars` | public | `{user_id}/{uuid}.jpg` |
| `posts` | private (signed URLs; `can_view_post`) | `{user_id}/{post_id}/{media_id}.{jpg\|mp4\|mov}`, video poster `{media_id}-thumb.jpg` |
| `reels` | private | `{user_id}/{reel_id}/video.mp4`, `cover.jpg` |
| `stories` | private (signed URLs; `can_view_story`), visible 24h (archive / highlights kept) | `{user_id}/{story_id}/{media.jpg\|media.mp4\|thumb.jpg\|cell-N.jpg\|frame-N.jpg\|sticker-{id}.jpg}` |
| `messages` | private (signed URLs; `can_view_message_object`: thread readers, view-once only right after `open_message_media`) | `{thread_id}/{message_id}.{jpg\|mp4\|m4a\|webm…}`, video poster `{message_id}-thumb.jpg`, group photo `{thread_id}/group-{uuid}.jpg`. **First segment is the thread, not the owner**; uploader = `owner_id` |
| `highlights-covers` | public | `{user_id}/{highlight_id}.jpg` |
| `audio` | public | `placeholder/{slug}.wav` (catalog, written by the service role only) |

The first path segment is the owner id, and storage RLS policies check it against `auth.uid()`.

## Schema registry
_Update this when a migration adds or changes tables, functions, or buckets._

| Object | Type | Created by (page/phase) | Notes |
|---|---|---|---|
| `avatars` | bucket (public, 5 MB, images) | Phase 0 | Owner-only write/select via API; anyone reads by public URL |
| `posts` | bucket (private, 100 MB, image+video) | Phase 0 | Owner write. Viewer select `posts_select_viewer` (Phase 3) = `can_view_post_object(name)` |
| `reels` | bucket (private, 100 MB, video+cover image) | Phase 0 | **Unused**: reels are posts, so their files live in the `posts` bucket (Phase 6 decision) |
| `stories` | bucket (private, 50 MB, image+video) | Phase 0 | Owner write. Viewer select `stories_select_viewer` (Phase 5) = `can_view_story_object(name)` |
| `messages` | bucket (private, 50 MB, image/video/audio/gif) | Phase 0 → Phase 9 | Phase 9 policies: insert by non-left members into `{thread_id}/…`; select own uploads (`owner_id`) or `can_view_message_object`; delete own uploads. + audio/webm, ogg, x-m4a |
| `highlights-covers` | bucket (public, 5 MB, images) | Phase 0 | Owner-only write |
| `<bucket>_{select,insert,update,delete}_owner` | storage.objects RLS policies | Phase 0 | 20 policies; check `(storage.foldername(name))[1] = auth.uid()` |
| `profiles` | table | Phase 1 (pages 008/009) | id = auth.users.id; username (unique, lowercase, `is_valid_username`), full_name ≤64, avatar_path (own folder). RLS: select authenticated; update own (username, full_name, avatar_path only); no client insert/delete |
| `account_private` | table | Phase 1 (pages 007/009) | birthday, terms_accepted_at. RLS: select own; writes only via `complete_signup` |
| `follows` | table | Phase 1 stub → finished Phase 2 | (follower_id, following_id) PK, no self-follow. RLS: select when `can_view_profile` of either side; insert own **only to public targets** (private → `follow_requests` / `follow_user`); delete by follower (unfollow) or followed (remove follower). Trigger keeps profile counters, removes the favorite on unfollow |
| `profiles` (Phase 2 columns) | columns | Phase 2 (pages 16–19) | `bio` ≤150, `links` jsonb ≤5 `{url,title}` (`is_valid_profile_links`), `is_private`; trigger-kept `followers_count`, `following_count`, `posts_count` (Phase 3 maintains posts). Client may update `username, full_name, avatar_path, bio, links, is_private`. Going public auto-approves pending requests |
| `follow_requests` | table | Phase 2 (page 18) | (requester_id, target_id). RLS: select/delete by either party; insert own only to private targets. Approve via `approve_follow_request` (UI = page 72, stub in Phase 2) |
| `close_friends` | table | Phase 2 (page 30) | (owner_id, friend_id). Owner-only RLS; members can't see the list (Phase 5 checks membership with a definer helper) |
| `favorites` | table | Phase 2 (page 31) | (owner_id, favorite_id). Owner-only RLS; trigger: must follow, max 50 (`favorites_must_follow`, `favorites_limit`) |
| `profile_notification_prefs` | table | Phase 2 (page 17) | Bell per profile: posts/stories/reels/live. Owner-only RLS. Delivery = Phase 8 |
| `highlights` | table | Phase 2 (page 25, row only) | id, owner_id, title ≤32, cover_path (`highlights-covers/{owner}/…`), position. RLS: select `can_view_profile(owner)`; write own. Items: `highlight_items` (Phase 5) |
| `saved_collections`, `saved_collection_items` | tables | Phase 2 (pages 26/27) | Owner-only RLS. `post_id` has **no FK yet: Phase 3 adds it** (→ posts, on delete cascade). Saves (`saves`) = Phase 4 |
| `username_changes` | table | Phase 2 (page 23) | Trigger-logged on every username change (old, new, changed_at). RLS: owner select only; count exposed via `account_about` |
| `account_about(uuid)` | RPC, security definer | Phase 2 (page 23) | id, username, avatar, date_joined, former_usernames_count |
| `is_valid_username` reserved list | function update | Phase 2 | + route names: archive, create, dev, favorites, highlights, legal, profile, qr, saved |
| `can_view_profile(uuid)` | function, security definer | Phase 2 | self, public, or approved follower. **Use in every later visibility policy** (posts, stories, reels…) |
| `follow_user(uuid)` → 'following'/'requested', `unfollow_user(uuid)`, `approve_follow_request(uuid)` | RPCs | Phase 2 | unfollow also cancels a pending request |
| `get_profile(p_username, p_user_id)` | RPC (invoker) | Phase 2 | profile + relationship (is_self, can_view, i_follow, follows_me, requested, is_close_friend, is_favorite, mutual_count, mutual_preview[3]) |
| `profile_connections(user, kind, search, offset, limit)` | RPC (invoker) | Phase 2 (pages 21/22) | kind = followers / following / mutual; empty unless `can_view_profile` (mutual always allowed) |
| `people_picker(search, limit)` | RPC (invoker) | Phase 2 (pages 30/31) | my followers ∪ following, with close-friend/favorite flags |
| `contact_hashes` | table | Phase 1 (page 011) | (owner_id, sha256 of lowercased email). RLS: select/insert/delete own |
| `is_valid_username(text)` | function (immutable) | Phase 1 | Instagram username rules + reserved names; used by the profiles check |
| `username_available(text)`, `suggest_usernames(text,int)` | RPCs (authenticated) | Phase 1 (page 008) | suggestions use `unaccent` |
| `complete_signup(username, full_name, birthday)` | RPC, security definer | Phase 1 (page 009) | creates profile + private row; errors `too_young` (<13), `username_taken`, `invalid_username` |
| `suggested_accounts(int)` | RPC, security definer | Phase 1 (page 011), updated Phase 2 | contacts (hashed email match) first, then most-followed; excludes self, followed, requested; returns `is_private` |
| `auth_lookup(text)` | RPC, security definer, **service_role only** | Phase 1 | username/email → account; used by `account-auth` |
| `set_updated_at()` | trigger function | Phase 1 | profiles.updated_at |
| `unaccent` | extension (schema extensions) | Phase 1 | |
| `account-auth` | Edge Function (verify_jwt off, publishable key) | Phase 1 (pages 003/004/012) | lookup, login, recover-start, recover-verify |
| `posts` | table | Phase 3 (pages 36/40/41) | author_id, caption (`is_valid_caption`: ≤2,200, ≤30 #, ≤20 @), aspect_ratio 0.75–1.91, status `uploading`→`published` (only via `publish_post`), audience everyone/close_friends, hide_like_counts, comments_disabled, audio_track_id + audio_start_ms, archived_at, pinned_at (≤3), published_at, edited_at. RLS select `can_view_post(id)`; insert own as uploading; update own (column grants: caption, hide_like_counts, comments_disabled, archived_at, pinned_at); delete own. Triggers: archive unpins, pin limit, edited_at, posts_count, caption refs |
| `post_media` | table | Phase 3 | post_id, author_id, position 0–19 (unique, deferrable), type image/video, path/thumb_path (must be `{uid}/{post}/…`), width/height, duration_ms ≤60 s, alt_text ≤1,000. Insert own only while uploading (max 20); update alt_text only; the last slide of a published post can't be deleted |
| `can_view_post(uuid)`, `can_view_post_object(text)` | functions, security definer | Phase 3 | author, any collaborator row, or published + not archived + `can_view_profile(author)` + close-friends membership for CF posts. **Use for comments/likes/saves visibility (Phase 4)** |
| `post_tags` | table | Phase 3 (page 37) | (media_id, tagged_user_id) unique, x/y 0–1 (null on video). Insert/update by author; delete by author or the tagged user; ≤20 people per post |
| `post_collaborators` | table | Phase 3 (page 36) | (post_id, user_id) status pending/accepted, ≤5. Insert by author (pending, not self); accept/decline via `respond_collab_invite`; delete by either party. Accepted posts appear on the collaborator's grid |
| `post_mentions` | table | Phase 3 | Trigger-parsed @usernames of published captions (for Phase 8 notifications). Select: mentioned user or post viewers |
| `hashtags`, `post_hashtags` | tables | Phase 3 stub → finished Phase 7 | Trigger-parsed from published captions; `hashtags.post_count` trigger-kept (every published post using the tag, incl. private / archived). Read-only to clients; pages / search via the Phase 7 RPCs |
| `audio_tracks`, `saved_audio` | tables | Phase 3 (page 39) | Catalog readable by authenticated, written by service role (`scripts/seed-audio.mjs`, source = placeholder). saved_audio owner-only (Saved tab; Phase 6 Saved → Audio) |
| `audio` | bucket (public, 20 MB, audio + cover images) | Phase 3 | No client write policies |
| `publish_post(uuid)` | RPC, security definer | Phase 3 (page 40) | author only; ≥1 media and every path/thumb present in storage → published |
| `reorder_post_media(uuid, uuid[])` | RPC, security definer | Phase 3 (pages 35/41) | author only; exact id set |
| `profile_posts(user, kind, offset, limit)` | RPC (invoker) | Phase 3 | kind grid (own + accepted collabs, pinned first) / tagged / archived (own only); cover path, media_count, is_pinned |
| `search_profiles(query, limit)` | RPC (invoker) | Phase 3 | mentions / Tag people / collaborators; accounts you follow first |
| `my_collab_invites()`, `respond_collab_invite(uuid, bool)` | RPCs | Phase 3 | pending invites inbox (stub UI until page 71) |
| `saved_collection_items.post_id`, `saved_collections.cover_post_id` | FKs | Phase 3 | → posts (cascade / set null) |
| `is_valid_username` reserved list | function update | Phase 3 | + compose |
| `posts.like_count`, `comment_count`, `repost_count` | columns | Phase 4 | Trigger-kept; no client grant. `post_cards` masks `like_count` (null) for non-authors when `hide_like_counts` |
| `likes` | table | Phase 4 (pages 43/47) | (post_id, user_id) PK. RLS: select `can_view_post` (likers visible even with hidden counts); insert own on visible posts; delete own |
| `comments` | table | Phase 4 (page 46) | post_id, author_id, parent_id (one level; trigger re-points replies-to-replies), body (`is_valid_comment`: 1–2,200, ≤30 #, ≤5 @), like_count, reply_count, pinned_at (≤3, top-level), hidden_at. RLS: select `can_view_post` + (not hidden, writer, or post author); insert own (published, commenting on; column grant id, post_id, parent_id, body); delete by writer or post author; no updates (pin/hide via RPCs) |
| `comment_likes` | table | Phase 4 | (comment_id, user_id). Visible / insertable when the comment is visible; delete own |
| `saves` | table | Phase 4 (pages 43/49, 26/27) | (user_id, post_id). Owner-only; insert needs `can_view_post`. Trigger: unsave removes the post from the user's collections; inserting a `saved_collection_items` row saves the post |
| `reposts` | table | Phase 4 (page 48) | (user_id, post_id), note ≤60 (updatable). Insert only published, non-archived, Everyone posts of public accounts, not your own. Select `can_view_profile(user)` + `can_view_post`. Trigger-kept `posts.repost_count` |
| `post_hides` | table | Phase 4 (page 49/50) | (user_id, post_id, reason hidden / not_interested / reported). Owner-only. Excluded from every feed |
| `post_seen` | table | Phase 4 (page 43) | (user_id, post_id, seen_at) impressions for ranking. Owner-only; written by `mark_posts_seen` |
| `reports` | table | Phase 4 (page 50) | reporter, target_type post/comment/profile, target_id, reason (9 values), sub_reason, status. One per reporter+target. Trigger: target visible, not self; reported posts → `post_hides`. RLS: insert own (column grant), select own. **Moderation UI: none yet** (Phase 11 page 108 support requests) |
| `post_cards(uuid[])` | RPC (invoker) | Phase 4 | jsonb per post in input order: author, media, tags, collaborators, audio, masked counts, liked / saved / reposted / can_repost, follow / favorite flags, liked_by (someone you follow), 2 preview comments |
| `home_feed(snapshot, offset, limit)`, `suggested_posts(snapshot, offset, limit)` | RPCs (invoker) | Phase 4 (page 43) | Ranked; snapshot keeps paging stable. Home = followed / own / followed collaborators / reposts by people you follow, last 3 days. Suggested = public posts from accounts you don't follow (≤30 days) |
| `following_feed(kind, before, before_id, limit)` | RPC (invoker) | Phase 4 (page 51) | Chronological Following / Favorites, keyset paging |
| `mark_posts_seen(uuid[])` | RPC (invoker) | Phase 4 | Ignores posts the caller can't view |
| `post_comments(post, kind, parent, offset, limit)`, `set_comment_pinned`, `set_comment_hidden` | RPCs | Phase 4 (page 46) | kinds top / replies / hidden (post author only). Pin/hide: post author only (definer) |
| `post_likers(...)`, `comment_likers(...)` | RPCs (invoker) | Phase 4 (page 47) | you, then people you follow, then newest; search |
| `saved_posts(collection, offset, limit)` | RPC (invoker) | Phase 4 (pages 26/27) | All posts (null) or one collection; cover path for grids |
| `profile_posts` kind `reposts` | function update | Phase 4 | Profile Reposts tab |
| `is_valid_username` reserved list | function update | Phase 4 | + feed, report |
| `stories` | table | Phase 5 (pages 52–57) | author_id, status uploading→published (only via `publish_story`), kind photo/video/text/boomerang/layout, media_path / thumb_path / files[] (all in `{author}/{story}/`), width/height, duration_ms ≤60 s, content (overlay JSON v1, <64 KB), audience everyone/close_friends, audio_track_id + start, reshared_post_id (post sticker; public Everyone posts whose author allows resharing, or your own), keep_in_archive, view/like/reply counters (author-only via `story_cards`). RLS select author or `can_view_story`; insert own as uploading (column grant); delete own; no updates |
| `can_view_story(uuid)`, `can_view_story_object(text)`, `story_is_active(uuid)` | functions, security definer | Phase 5 | author, or published + `can_view_profile` + not hidden from you + CF membership for CF stories + (<24 h or in a highlight). Active = published <24 h (likes, replies, answers) |
| `story_stickers` | table | Phase 5 (page 54) | poll / quiz / question / slider / countdown / add_yours, data (validated by `is_valid_story_sticker`), correct_option (quiz; **not selectable** by clients, column grant), chain_id (Add yours root). One of each type per story; insert only while the story is uploading; select `can_view_story` |
| `story_sticker_responses` | table | Phase 5 (pages 52/56) | option / value / body per type; one per person except questions; not on own story; only while active. Select: responder or story author; delete only countdown reminders |
| `story_mentions` | table | Phase 5 | (story_id, user_id) ≤10, insert while uploading. Select `can_view_story`. For Phase 8 notifications |
| `story_views`, `story_likes`, `story_replies` | tables | Phase 5 (pages 52/56) | Views: insert own on visible stories (not your own), author reads names for 48 h. Likes: private (liker + author), active stories only. Replies (+ quick reactions): sender + author, gated by `story_replies_allowed`; **Phase 9 moves them into DMs**. Trigger-kept counters on `stories` |
| `story_settings`, `story_hidden_from` | tables | Phase 5 (page 55) | Owner-only. Settings: replies everyone/following/off, allow_resharing, save_to_archive (defaults when no row). Hide list enforced in `can_view_story` (stories, highlights, files) |
| `highlight_items` | table | Phase 5 (pages 25/57) | (highlight_id, story_id, owner_id, position). Select `can_view_profile(owner)` + `can_view_story`; insert own published stories into own highlights; ≤100; last item removed → highlight deleted |
| `publish_story(uuid)` | RPC, security definer | Phase 5 | author only; every file in storage → published; copies save_to_archive |
| `stories_tray()`, `story_rings(uuid[])` | RPCs (invoker) | Phase 5 (page 43/52) | Tray: you + followed accounts with active stories (unseen first, Favorites boost, newest). Rings: count / has_unseen / has_close_friends per user |
| `story_cards(uuid[])`, `story_reel(user)`, `highlight_reel(id)` | RPCs (invoker) | Phase 5 | jsonb per story: author, media, content, audio, seen / liked, replies_allowed, stickers + my answers + `story_sticker_results` (definer: aggregates after answering, quiz answer revealed then), author-only counters + highlight ids |
| `mark_stories_viewed(uuid[])`, `story_viewers(...)`, `story_responses(story)`, `add_yours_chain(...)` | RPCs (invoker) | Phase 5 (pages 52/56) | Viewers ranked by interaction; responses author-only; Add yours chain = visible stories with the chain's sticker |
| `save_highlight(id, title, cover, ids[])`, `profile_highlights(user)`, `story_archive(...)`, `my_purgeable_stories()` | RPCs (invoker) | Phase 5 (pages 25/28/57) | Create / update a highlight in one call; highlights with ≥1 visible item; own archive; expired unarchived stories + abandoned uploads (client deletes files + rows on launch) |
| `reports` target_type `story` | constraint + trigger update | Phase 5 | Story must be visible, not your own |
| `is_valid_username` reserved list | function update | Phase 5 | + story |
| `posts` (Phase 6 columns) | columns | Phase 6 (pages 58–64) | `kind` post/reel (single-video posts are reels), `reel` jsonb edit document (<64 KB), `cover_path` (own folder), `cover_offset` (3:4 grid window), trigger-free `play_count` (via `record_reel_play`), `allow_remix`, `allow_download` (updatable), `remix_of` (→ posts, set null on delete) + `remix_layout` side_by_side/react/sequence, `linked_reel_id` (own published reel). Reels 0.5…1.91 aspect. Insert trigger `posts_before_insert` checks cover path, remix permission (public, Everyone, allow_remix, visible; own always), linked reel |
| `post_media` limits | constraint + trigger update | Phase 6 | positions 0–49 (reels ≤ 50 clips, posts ≤ 20); clips ≤ 180.5 s (posts' videos stay ≤ 60.5 s) |
| `publish_post` | function update | Phase 6 | + reel document checks (clips = own media, trims, speed 0.25–4, total ≤ 3 min), cover + voiceover files present (voiceovers in the post folder), creates **original audio** for reels with a video clip and no music |
| `posts` bucket MIME | bucket update | Phase 6 | + audio types (voiceovers) |
| `audio_tracks` (Phase 6 columns) | columns + policy | Phase 6 (page 62) | `source = 'original'` rows: `owner_id`, `origin_post_id` (unique, cascade), no `audio_path`, `renamed_at`. Select: catalog, own, or `can_view_post(origin)`. `saved_audio` insert needs a visible track. `rename_original_audio(track, title)` owner only, 1–60 chars |
| `reel_plays` | table | Phase 6 (page 58) | (user_id, post_id) plays, first/last played. Owner select only; writes only via `record_reel_play` (definer: visible, not own, repeat after 5 s, also marks `post_seen`) |
| `post_cards` | function update | Phase 6 | + kind, reel, cover, play_count (masked with hidden counts), allow_remix / allow_download / can_remix, remix {layout, post_id, username}, remix_count, linked_reel_id (if visible), audio source / origin / owner |
| `reels_feed(snapshot, offset, limit)` | RPC (invoker) | Phase 6 (page 58) | Followed (any visible) + public reels; engagement × recency, Favorites / following boost, own fresh reel first, seen (plays / impressions) × 0.1, Not interested authors × 0.2 |
| `profile_posts` | function replaced | Phase 6 | + kind `reels`; returns kind, play_count (masked), cover_offset; reel cover first. `saved_posts` uses reel covers |
| `audio_page(track)`, `audio_reels(track, …)`, `reel_remixes(post, …)`, `my_reels(limit)` | RPCs (invoker) | Phase 6 (pages 61–63) | Audio page header (reel count, saved, owner), grid (original first, then popular), remixes, own reels to link |
| `reports` target_type `audio` | constraint + trigger update | Phase 6 | Visible track, not your own |
| `is_valid_username` reserved list | function update | Phase 6 | + audio, reel-create |
| `post_tile(uuid)`, `post_base_score(...)` | helper functions (invoker / immutable) | Phase 7 | Grid tile (cover = reel cover or first slide / poster, media_count, masked play_count, cover_offset); engagement ÷ time decay shared by the Explore / hashtag / search rankings |
| `posts_caption_fts_idx` | GIN index | Phase 7 (page 66) | `to_tsvector('simple', caption)` for keyword search |
| `explore_grid(snapshot, offset, limit)` | RPC (invoker) | Phase 7 (page 65) | Public Everyone posts + reels, not own / hidden; affinity to hashtags + authors you engaged with (likes, saves, comments, plays) and accounts your follows follow; followed ×0.5, seen ×0.3, Not-interested authors ×0.2, per-snapshot shuffle. Returns tiles |
| `similar_posts(post, snapshot, offset, limit)` | RPC (invoker) | Phase 7 (page 70) | similarity = same author 3 + same audio 2 + shared hashtags 1.5 each + co-likers 0.5 each (≤ 6); similar first, then the rest of Explore |
| `normalize_hashtag(text)`, `hashtag_page(name)`, `hashtag_posts(name, tab, offset, limit)` | RPCs (invoker) | Phase 7 (page 68) | Header (count + top visible post cover); tabs top / recent / reels; visibility via posts RLS |
| `search_accounts`, `search_hashtags`, `search_audio`, `search_posts(query, kind top/reels, …)` | RPCs (invoker) | Phase 7 (page 66) | Accounts: username / unaccented full name; exact → following → mutuals → prefix → followers, + followed_by / mutual_count. Tags: prefix by post_count. Audio: title / artist / owner (RLS hides invisible original audio), reel_count. Posts: caption FTS, exact hashtag or author username |
| `search_history` | table | Phase 7 (page 67) | user_id, kind account / hashtag / audio / keyword, target_id or query; unique per (user, kind, target or lower(query)). RLS select / delete own; **writes only via `record_search(kind, target, query)`** (definer: target exists + visible, bumps repeats, keeps 50). `recent_searches(limit)` joins display data and skips unavailable targets |
| `reports` target_type `hashtag` | constraint + trigger update | Phase 7 | Hashtag must exist (no owner) |
| `is_valid_username` reserved list | function update | Phase 7 | + explore-feed, recent-searches, search, tags |
| `notifications` | table | Phase 8 (page 71) | recipient, actor, type (21 kinds: likes, comments / replies / comment likes / mentions, caption mentions, tags, follows, follow_accepted, collab invite / accepted, reposts, story likes / mentions, remix, audio_use, countdown_ended, add_yours, bell_post / reel / story), post / comment / story / audio FKs (cascade), data jsonb; unique per recipient+type+actor+targets, no self. RLS select / delete own; **written only by definer triggers** (`notify()`), retractions delete rows. In `supabase_realtime` |
| `activity_state` | table | Phase 8 | user_id, seen_at (last Activity visit). Select own; written by `mark_activity_seen()` (returns the previous value for the New section) |
| `*_notify` triggers | trigger functions (definer) | Phase 8 | on likes, comment_likes, comments, follows, reposts, story_likes, post_mentions, post_tags, post_collaborators; `posts_notify_publish` (tags, collab invites, remix, original-audio use, bell), `stories_notify_publish` (mentions, Add yours to the chain starter, bell). Likes / comments / reposts reach the author + accepted collaborators (`post_owners`) |
| `approve_follow_request` | function update | Phase 8 (page 72) | + `follow_accepted` notification to the requester |
| `sync_countdown_notifications()` | RPC (definer) | Phase 8 | Ended countdowns you set a reminder for (≤30 days) → `countdown_ended`; called by `activity_badge` (no cron) |
| `visible_notifications(before)`, `activity_feed(seen, before, tz, offset, limit)`, `activity_badge()`, `notification_preview(id)` | RPCs (invoker) | Phase 8 | Visible = target passes posts / comments / stories RLS (story mentions + countdowns kept after expiry). Feed: sections new / today / yesterday (in tz) / week / month / older; groups likes per post, comment likes per comment, story likes per story, audio uses per track, follows; returns 2 latest actors, count, post tile, comment (+ liked), story thumb, audio, follow-back state, collab status. Badge: unseen counts (likes / comments / follows / new requests) |
| `follow_request_summary()`, `my_follow_requests(search, offset, limit)` | RPCs (invoker) | Phase 8 (page 72) | Activity row (count + 2 newest) and the list with Follow back flags. `follow_requests` added to `supabase_realtime` |
| `suggestion_dismissals` | table | Phase 8 (page 73) | (user_id, target_id). Owner-only select / insert / delete. Dismissed accounts skipped for 180 days |
| `suggested_accounts(max_count, p_offset)` | RPC (definer) replaced | Phase 8 (page 73) | One source for Discover people, Activity / Home / profile / Explore strips, onboarding: follows you > contacts > friends of friends > co-likers > new > popular; reason, follows_me, mutual_count, mutual_username |
| `my_collab_invites()` | RPC | Phase 3 | **Unused since Phase 8** (invites live in Activity) |
| `is_valid_username` reserved list | function update | Phase 8 | + activity, discover-people |
| `threads` | table | Phase 9 (pages 74–79) | kind direct (one per pair: `direct_key`) / group (title ≤100, photo_path, approval_required, invite_token), theme (10 presets), vanish_mode (1:1), last_message_at / last_message_id (trigger-kept). RLS select members (any status); **no client writes** (RPCs) |
| `thread_members` | table | Phase 9 | (thread, user) role admin/member, status active / request / hidden / left, joined_via, joined_at (history starts here), left_at, last_read_at, read_receipts, muted_until, pinned_at (≤3 per user), marked_unread, cleared_at ("Delete chat"), nickname. RLS select / update **own row** (column grant: read_receipts, muted_until, pinned_at, marked_unread); others' rows only via `thread_info` |
| `thread_join_requests` | table | Phase 9 (page 78) | Approve new members: (thread, user, added_by null = invite link). Select: the person or active admins; writes via RPCs |
| `messages` | table | Phase 9 (page 76) | kind text / media / voice / post / story / profile / audio / system; body ≤1000; reply_to_id; post / story / profile / audio / note FKs (set null → "unavailable"); media_type, media_path / thumb_path (`{thread}/{id}…`, must exist + be yours), width / height, duration (video ≤180 s, voice 0.3–300 s), waveform; view_mode keep / once / replay; data (system event, story_reply / reaction, note snapshot); vanish; pinned_at (≤3 per chat); edited_at; scheduled_for. RLS select `can_read_message` (joined_at … left_at, after cleared_at; scheduled = sender only); insert own (column grant, `messages_before_insert` validates: membership, **request = one text message until accepted** (story replies exempt), kind/column rules, files, reply in same thread, schedule 30 s…29 days text only); delete own (unsend). Edit / pin via RPCs |
| `message_reactions` | table | Phase 9 | (message, user) one emoji. Select when the message is readable; insert / update / delete own, active members only |
| `message_views` | table | Phase 9 (page 80) | view-once / replay views (count, screenshot_at). Select: viewer or sender; written by `open_message_media` / `note_screenshot` |
| `notes`, `note_likes` | tables | Phase 9 (page 81) | Note ≤60 chars and/or catalog song (+ start), audience mutuals / close_friends, 24 h, one active per author (trigger). `can_view_note`. Likes: liker + author read; insert on visible, not own. Expired notes purged by the cron job |
| `user_presence` | table | Phase 9 | last_active_at (own select only); written by `touch_presence()`, read via `presence_of(ids)` (follow either way, or a shared accepted chat) |
| `can_read_message`, `can_view_message_object`, `can_view_note`, `my_thread_status`, `realtime_thread_member`, `is_flagged_text` | helper functions | Phase 9 | Visibility helpers used by RLS / storage / realtime policies. `is_flagged_text` = built-in Hidden requests word list (page 95 adds personal Hidden words) |
| `get_or_create_direct(other)`, `create_group_thread(ids, title)`, `add_thread_members`, `answer_join_request`, `thread_join_request_list`, `remove_thread_member`, `leave_thread`, `set_thread_admin`, `rename_thread`, `set_thread_photo`, `set_thread_theme`, `set_thread_approval`, `set_nickname`, `set_vanish_mode`, `end_vanish_session`, `note_screenshot`, `create_thread_invite` / `disable_thread_invite` / `thread_invite_preview` / `join_thread_by_invite`, `accept_thread`, `clear_thread`, `clear_requests`, `mark_thread_read`, `edit_message` (15 min), `pin_message`, `open_message_media`, `my_purgeable_message_files` | RPCs (definer) | Phase 9 | Thread / group / message writes; every change posts a system line (`data.event`: created, renamed, photo, theme, added, removed, left, joined, admin, nickname, vanish_on / vanish_off, pinned, approval, screenshot). Last admin leaving promotes the longest-standing member (ties: earliest accepted; follow-up migration `phase9_admin_tiebreak`). Invite links ≤250 joins / day |
| `inbox_threads(folder, before, limit, query)`, `direct_badge()`, `thread_info(thread)`, `thread_messages(thread, before, limit, filter, query)`, `share_suggestions(query, limit)`, `notes_tray()`, `note_likers(note)`, `presence_of(ids)`, `touch_presence()` | RPCs | Phase 9 | Inbox / Requests / Hidden (pinned first, unread count ≤5, seen), ✈ badge, header + members + seen times (receipts on both sides), messages with reply / story / profile / audio snippets + reactions + views (filters pinned / media / links / posts / scheduled + search), Send-to targets |
| Realtime broadcast | private topics | Phase 9 | Triggers `realtime.send` to `thread:{id}` (message, message_updated, message_deleted, reaction, read, accepted, join_requests) and `inbox:{user}`; clients send `typing` on `thread:{id}`. `realtime.messages` policies: receive inbox (own) / thread (non-left member); send thread (active member) |
| `story_replies_to_dm` | trigger | Phase 9 | Story replies / reactions also become a 1:1 message (`story_id`, `data.story_reply`, `reaction`); pre-Phase-9 replies backfilled |
| `deliver_scheduled_messages()` | pg_cron job (every minute) | Phase 9 | Delivers due scheduled messages, drops those of senders who left, purges notes expired >1 day. **First pg_cron job** in the project |
| `reports` target_type `message`, `thread` | constraint + trigger update | Phase 9 | Readable message (not your own) / a group you're in |
