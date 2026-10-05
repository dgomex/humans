# Humans — Instagram clone (Android + iOS)

A cross-platform mobile app that clones Instagram's consumer social features. Work is scoped **per page**; every page goes through research → user decision → build.

## Read first (in this order)
1. `docs/PLAN.md`: stack, phases, the full list of 111 pages, and the dependencies between phases.
2. `docs/pages/README.md`: **progress tracker** (single source of truth for what's done).
3. `docs/ARCHITECTURE.md`: folder structure, coding conventions, Supabase/storage conventions, **schema registry** (tables/buckets that exist).
4. `docs/DECISIONS.md`: decisions already made with the user. Do not reopen them.
5. `docs/pages/<NNN>-<slug>.md`: spec for a specific page (if it exists).

## Stack (decided)
- **App:** Expo (React Native) + TypeScript + Expo Router; EAS Build for store binaries.
- **Backend:** Supabase: Postgres, Auth, Realtime, Edge Functions.
- **Media:** Supabase Storage acts as the S3 bucket (no AWS).
- **Out of scope:** business/monetization surfaces (Ads, Shopping checkout, Subscriptions, Professional dashboard/Insights, Meta Verified).

## Mandatory per-page workflow
Use the project skills: `/start-page <number>`, `/start-phase <number>` (0 = foundation), `/project-status` (where are we, what's next). Steps:
1. **Deep research** of the real Instagram page (layout, navigation, states, interactions, gestures, features, data).
2. **Write spec** from `docs/pages/_TEMPLATE.md` → `docs/pages/<NNN>-<slug>.md`.
3. **Ask the user**: full clone, or which changes? Never skip this. Record the answer in the spec and `docs/DECISIONS.md`.
4. **Schema & storage**: migration in `supabase/migrations/`, RLS on every table, update the schema registry in `docs/ARCHITECTURE.md`.
5. **Build** the screen + components.
6. **Verify** on Android and iOS; test RLS with two users.
7. **Update the tracker** `docs/pages/README.md` after each step.

## Rules
- Phase 0 (foundation) must be done before any page is built. If it isn't, do it first, or ask the user.
- Before starting a page, check its phase dependencies in `docs/PLAN.md`. If a prerequisite table or component is missing, add only the minimal prerequisite schema/component, note it in the tracker, and tell the user.
- Reuse shared components from `src/components/` before creating new ones.
- Every table has RLS enabled. Private media uses signed URLs. Never ship a service-role key in the app.
- Keep docs current: tracker, schema registry and decisions are what let a fresh session resume at any phase.

## Commands (available once Phase 0 is done)
```bash
npx expo start            # dev server (a = Android, i = iOS)
npx supabase start        # local Supabase stack
npx supabase migration new <name>
npx supabase db reset     # re-apply all migrations locally
npx supabase gen types typescript --local > src/types/database.ts
npx tsc --noEmit && npx eslint .
```

## Tooling notes
- Supabase MCP tools are connected in this environment (migrations, SQL, advisors, type generation). Prefer the local CLI for development; run `get_advisors` after every migration.
- Use web research for the deep-research step (current Instagram behavior on iOS/Android).
