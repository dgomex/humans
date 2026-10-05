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

## Per-page decisions
_Format: `| date | Page NNN – name | Full clone / Changes: … | spec link |`_

| Date | Page | Decision | Spec |
|---|---|---|---|
