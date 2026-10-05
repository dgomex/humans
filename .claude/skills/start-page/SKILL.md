---
name: start-page
description: Start or resume work on one page of the Instagram clone by its number from docs/PLAN.md (e.g. "/start-page 43"). Runs the mandatory workflow: deep research, then a spec, then asking the user to clone or change, then schema, build, verify, and tracker updates.
argument-hint: <page number>
---

# Start / resume page $ARGUMENTS

## 0. Load context
1. Read `CLAUDE.md`, `docs/PLAN.md`, `docs/pages/README.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`.
2. Find page `$ARGUMENTS` in the tracker: its name, phase, and current status. If no number was given, ask which page.
3. If a spec `docs/pages/<NNN>-*.md` already exists, read it and **resume from the first incomplete step**. Don't redo finished steps.

## 1. Preconditions
- Phase 0 must be done (tracker "Phase 0" table). If it isn't, stop and offer to do Phase 0 first.
- Check the page's phase in the **Phase dependencies** table of `docs/PLAN.md` against the **Schema registry** in `docs/ARCHITECTURE.md`. List missing prerequisites. Plan only **minimal** stubs for them, and record each in the tracker's "Prerequisite stubs" table.

## 2. Deep research
Research the current Instagram page on both iOS and Android with web search/fetch: help center, recent feature announcements, UI teardown articles. Cover:
- layout from top to bottom, and iOS vs Android differences
- entry/exit points and the destination of every control
- every feature, gesture, animation and haptic
- loading / empty / error / offline states, plus edge cases (private, blocked, deleted, limits)
- the data each element needs

Copy `docs/pages/_TEMPLATE.md` to `docs/pages/<NNN>-<slug>.md` (3-digit number, kebab-case slug) and fill section 1 with sources. Tracker: Spec = link, Research = ☑.

## 3. User decision (never skip)
Summarize the researched features as a concise checklist. Use AskUserQuestion: **Full clone**, or **Changes** (which features to drop, alter, or add)? Record the answer in spec section 2, in `docs/DECISIONS.md` (per-page table), and in the tracker Decision column.

## 4. Data & storage
Fill spec section 3. Create a migration with `npx supabase migration new <NNN>_<slug>`. Enable RLS on every table and add storage policies following the bucket conventions. Apply locally, regenerate types, and run Supabase advisors. Update the **Schema registry** in `docs/ARCHITECTURE.md`.

## 5. Build
Follow the conventions in `docs/ARCHITECTURE.md`. Reuse `src/components/` and `src/features/*`. Set the tracker "Current focus" to this page, and Built = ◐ then ☑.

## 6. Verify
`npx tsc --noEmit`, lint, then run on the Android emulator and iOS simulator. Walk the spec's acceptance checklist, including light/dark mode and RLS with two test users (seed). Tracker: Verified = ☑. Spec status: Done.

## 7. Wrap up
Update "Current focus" in the tracker, and report to the user what was done and what's next.
