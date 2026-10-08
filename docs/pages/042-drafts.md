# Page 042 — Drafts

- **Phase:** 3 — Content Creation
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/create/drafts.tsx` (+ "Drafts" row in the picker)
- **Depends on:** pages 32–36

## 1. Research (current Instagram behavior)
### Layout
- Leaving the flow after the edit step → sheet "**Save draft?** If you go back now, you'll lose all the edits you've made." → **Save draft** / **Discard** / Cancel.
- Picker (page 32): a **Drafts** section above the gallery (horizontal row of draft thumbnails, "Manage") or a Drafts album in the dropdown.
- Manage: grid of drafts → **Edit** → select → **Discard posts**.
- Opening a draft restores media, filters, crop, caption, tags, location, music and settings, at the edit step.

### Features & interactions
- [ ] Save on exit, open, discard (bulk).
- [ ] Drafts are **stored on the device only**: they don't sync across devices and are lost if the app is deleted (Instagram Help Center).
- [ ] Reels drafts live on the profile Reels tab (Phase 6); story drafts are 7-day (Phase 5).

### States
- No drafts → the Drafts row is hidden.
- A draft whose source photo was deleted from the library → keeps the edited copy (Instagram copies media into its sandbox).

### Sources
- [Where to see drafts (help-center mirror)](https://myshare-cms.siemens.com/where-to-see-drafts-in-instagram)
- [Save as draft (RFG Creative)](https://rfgcreative.com/misc/how-to-save-as-draft-on-instagram.html)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Device-only drafts like Instagram (per account, media copied into app storage): Save draft? on exit, Drafts row in Create, Manage → discard.
- **Date:** 2026-10-08

## 3. Data & storage
- Device-only: `documents/drafts/<userId>/index.json` + one folder of media copies per draft (web: memory only).

## 4. Implementation notes
- `src/features/create/{drafts.ts,localFiles.ts}`, Drafts row on the Create screen, `app/compose/drafts.tsx` (Select → Discard). Posting a draft deletes it.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-posts-rls.mjs`)
- [x] Supabase advisors clean (db lint)
