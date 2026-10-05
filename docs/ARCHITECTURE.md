# Architecture & Conventions

> Phase 0 created this structure (2026-10-05). Update this file whenever the structure, conventions, or schema change.

## Folder structure
```
app/                      # Expo Router routes (file = screen). Root app/, NOT src/app/.
  _layout.tsx             # root providers: GestureHandler, SafeArea, QueryClient, nav theme, Toast; root Stack
  (auth)/                 # Phase 1 onboarding/login screens
  (tabs)/                 # bottom tabs: index (home), explore, create (stub, opens modal), reels, profile
  (modals)/               # modal routes: create-entry (Phase 3), comments, share, options…
  dev/ui.tsx              # dev-only UI kit + Supabase connectivity check
  [username].tsx, p/[id].tsx, reel/[id].tsx, stories/[userId].tsx, direct/…
src/
  components/             # shared UI: Avatar, Button, BottomSheet, Toast, Icon, Text (barrel: @/components)
  features/<area>/        # per-area logic: api.ts (Supabase queries), hooks.ts, components/
  features/shell/         # PlaceholderScreen for routes whose page isn't built yet
  lib/supabase.ts         # supabase-js client (publishable key + chunked SecureStore session)
  lib/secureStorage.ts    # Keychain/Keystore adapter (chunks values >1.8 KB)
  lib/storage.ts          # BUCKETS, storagePaths, upload/public/signed URL helpers
  lib/useMediaUrl.ts      # cached public/signed URL hook
  lib/queryClient.ts      # TanStack Query client + AppState focus
  theme/                  # tokens: colors (light/dark), spacing/radius, typography; useTheme()
  types/database.ts       # generated Supabase types (never hand-edit; npm run db:types)
scripts/
  test-storage-rls.mjs    # two-user storage RLS check against the local stack
supabase/
  config.toml
  migrations/             # <timestamp>_<page-or-feature>.sql
  functions/              # Edge Functions (push, fan-out, moderation…)
  seed.sql                # test users & sample content (not created yet)
docs/                     # PLAN, ARCHITECTURE, DECISIONS, pages/, EXPO_AGENTS.md (Expo SDK guidance)
```

## Environment & local dev
- `.env.local` (git-ignored, template `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable key). Values: `npx supabase status`.
- On Android, `supabase.ts` rewrites `127.0.0.1`/`localhost` to `10.0.2.2` (emulator host). On a physical device, use the PC's LAN IP.
- Install packages with `npx expo install <pkg>` (SDK-matched versions). Expo SDK 57: check the versioned docs, not memory (see `docs/EXPO_AGENTS.md`).
- Scripts: `npm run typecheck | lint | format | db:start | db:reset | db:types`; `node scripts/test-storage-rls.mjs`.

## Coding conventions
- TypeScript strict. Functional components + hooks.
- Data fetching: TanStack Query wrapping Supabase calls in `src/features/<area>/api.ts`.
- Screens stay thin; logic lives in `features/`.
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
