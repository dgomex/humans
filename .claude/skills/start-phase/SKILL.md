---
name: start-phase
description: Start or resume a whole phase of the Instagram clone (e.g. "/start-phase 4", or "/start-phase 0" for foundation). Loads project context, checks dependencies, then runs the start-page workflow for each page in the phase in order.
argument-hint: <phase number 0-11>
---

# Start / resume phase $ARGUMENTS

1. Read `CLAUDE.md`, `docs/PLAN.md`, `docs/pages/README.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`.
2. **Phase 0 (foundation):** work through the tracker's Phase 0 task table using `docs/PLAN.md` (Phase 0) and `docs/ARCHITECTURE.md` (folder structure, buckets). Ask the user before creating or linking a hosted Supabase project; the local stack needs no approval. Mark each task ☑ as you finish it, and fill in the schema registry.
3. **Phases 1–11:**
   - Check the phase's row in **Phase dependencies** (`docs/PLAN.md`) against the schema registry. Report which prerequisites are present and which need stubs.
   - List the phase's pages with their tracker status, and continue from the first page that isn't Done.
   - For each page, follow `.claude/skills/start-page/SKILL.md` exactly. The research and the **user decision** happen per page. Batching is allowed: you may research several pages, then ask the user about them together in one AskUserQuestion round (max 4 questions per round).
   - Pages that share a flow (e.g. sign-up steps 4–11) may share one migration and components. Each page still gets its own spec file.
4. Keep "Current focus" in the tracker up to date. At phase end, summarize and propose the next phase based on the dependencies.
