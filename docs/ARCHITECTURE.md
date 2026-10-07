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
  (tabs)/                 # bottom tabs: index (home), explore, create (stub, opens modal), reels, profile
  (modals)/               # modal routes: create-entry (Phase 3), comments, share, options…
  dev/ui.tsx              # dev-only UI kit + Supabase connectivity check
  [username].tsx, p/[id].tsx, reel/[id].tsx, stories/[userId].tsx, direct/…
src/
  components/             # shared UI: Avatar, Button, BottomSheet, Toast, Icon, Text (barrel: @/components)
  features/<area>/        # per-area logic: api.ts (Supabase queries), hooks.ts, components/
  features/shell/         # PlaceholderScreen for routes whose page isn't built yet
  features/auth/          # AuthProvider (gate, sessions, accounts), api.ts, savedAccounts.ts, components/ (AuthStep, LoginForm, CodeStep, SaveLoginView, AccountSwitcher, AppLogo, LanguageSelector)
  features/onboarding/    # SignupDraft (values across steps), contacts.ts (hashed email sync)
  features/follows/       # api.ts (useFollow, useSuggestedAccounts), FollowButton  [Phase 2 owns]
  features/profile/       # avatar.ts (pick, resize 320px, upload, swap)
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
| `follows` | table (**stub**) | Phase 1 (page 011) → owned by Phase 2 | (follower_id, following_id) PK, no self-follow. RLS: select authenticated; insert/delete own |
| `contact_hashes` | table | Phase 1 (page 011) | (owner_id, sha256 of lowercased email). RLS: select/insert/delete own |
| `is_valid_username(text)` | function (immutable) | Phase 1 | Instagram username rules + reserved names; used by the profiles check |
| `username_available(text)`, `suggest_usernames(text,int)` | RPCs (authenticated) | Phase 1 (page 008) | suggestions use `unaccent` |
| `complete_signup(username, full_name, birthday)` | RPC, security definer | Phase 1 (page 009) | creates profile + private row; errors `too_young` (<13), `username_taken`, `invalid_username` |
| `suggested_accounts(int)` | RPC, security definer | Phase 1 (page 011) | contacts (hashed email match) first, then most-followed; excludes self + already followed |
| `auth_lookup(text)` | RPC, security definer, **service_role only** | Phase 1 | username/email → account; used by `account-auth` |
| `set_updated_at()` | trigger function | Phase 1 | profiles.updated_at |
| `unaccent` | extension (schema extensions) | Phase 1 | |
| `account-auth` | Edge Function (verify_jwt off, publishable key) | Phase 1 (pages 003/004/012) | lookup, login, recover-start, recover-verify |
