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
    (home,explore,reels,profile)/  # shared routes (array group) + the per-tab Stack layout:
      [username]/{index,connections,about}  # profiles (16–18), followers/following/mutual (21–22), About (23)
      # cold deep links land in the first group alphabetically (Explore); in-app pushes stay in the current tab
  edit-profile/{index,[field],links}  # page 19 (no tab bar)
  saved/{index,new,[id]/index,[id]/edit}  # pages 26–27
  close-friends, favorites            # pages 30–31
  qr/{index,scan}                     # page 24 (full-screen modals)
  follow-requests                     # STUB of page 72 (Phase 8)
  highlights/new                      # placeholder until the Phase 5 editor
  (modals)/               # modal routes: create-entry (Phase 3), comments, share, options…
  dev/ui.tsx              # dev-only UI kit + Supabase connectivity check
  p/[id].tsx, reel/[id].tsx, stories/[userId].tsx, direct/…   # future
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
  lib/navigation.ts       # goBack(fallback): back, or replace when there's no history (deep links / reloads)
  lib/useDebounced.ts     # debounced value (search fields)
  lib/dialog.ts           # showDialog(): native Alert, browser confirm/alert on web — use instead of Alert
  lib/supabase.ts         # supabase-js client (publishable key + chunked SecureStore session)
  lib/secureStorage.ts    # Keychain/Keystore adapter (chunks values >1.8 KB)
  lib/storage.ts          # BUCKETS, storagePaths, upload/public/signed URL helpers
  lib/useMediaUrl.ts      # cached public/signed URL hook
  lib/queryClient.ts      # TanStack Query client + AppState focus
  theme/                  # tokens: colors (light/dark), spacing/radius, typography; useTheme()
  types/database.ts       # generated Supabase types (never hand-edit; npm run db:types)
scripts/
  test-storage-rls.mjs    # two-user storage RLS check against the local stack
  test-auth-flow.mjs      # Phase 1 end-to-end auth + RLS check (reads codes from Mailpit)
  test-profile-rls.mjs    # Phase 2 privacy / follows / lists / collections RLS check (three fresh users)
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
| `posts` | private (signed URLs; respects private accounts) | `{user_id}/{post_id}/{index}.{ext}` |
| `reels` | private | `{user_id}/{reel_id}/video.mp4`, `cover.jpg` |
| `stories` | private, expire after 24h (archive kept) | `{user_id}/{story_id}.{ext}` |
| `messages` | private (thread participants only) | `{thread_id}/{message_id}.{ext}` |
| `highlights-covers` | public | `{user_id}/{highlight_id}.jpg` |

The first path segment is the owner id, and storage RLS policies check it against `auth.uid()`.

## Schema registry
_Update this when a migration adds or changes tables, functions, or buckets._

| Object | Type | Created by (page/phase) | Notes |
|---|---|---|---|
| `avatars` | bucket (public, 5 MB, images) | Phase 0 | Owner-only write/select via API; anyone reads by public URL |
| `posts` | bucket (private, 100 MB, image+video) | Phase 0 | Owner-only. **Phase 3/2 must add** a select policy for followers/public accounts |
| `reels` | bucket (private, 100 MB, video+cover image) | Phase 0 | Owner-only. **Phase 6 adds** viewer select policy |
| `stories` | bucket (private, 50 MB, image+video) | Phase 0 | Owner-only. **Phase 5 adds** viewer select (24h, close friends) |
| `messages` | bucket (private, 50 MB, image/video/audio/gif) | Phase 0 | **No policies = deny all.** Phase 9 adds thread-participant policies (path `{thread_id}/…`) |
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
| `highlights` | table | Phase 2 (page 25, row only) | id, owner_id, title ≤32, cover_path (`highlights-covers/{owner}/…`), position. RLS: select `can_view_profile(owner)`; write own. **Phase 5 adds** `highlight_items` + the editor |
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
