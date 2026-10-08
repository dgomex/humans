# Page 048 — Share sheet

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** component (`ShareSheet`), opened from ✈ on any post
- **Depends on:** DMs (Phase 9) for Send, Stories (Phase 5) for Add to story

## 1. Research (current Instagram behavior)
### Layout
- Bottom sheet with a **search** field ("Search"), then a **grid of recent DM contacts/groups** (avatars, 3–4 per row, ~2 rows; tap selects with a blue ✓; multi-select). When someone is selected: "Write a message…" field + **Send** (or "Send separately" for several).
- Bottom row of round action buttons, horizontally scrollable: **Add to story**, **Repost** (Aug 2025; or on the action row ⟳), **Copy link**, **Share to…** (system share), WhatsApp / Messenger / Threads / SMS / Facebook shortcuts (external apps), "Add to" / "Save" on some builds.
- Repost: tap → reposted (toast "Reposted"); optional note bubble; shows in followers' feeds as "<you> reposted" and in your profile's **Reposts** tab. Tap again → "Undo repost". Only public posts can be reposted.

### Features & interactions
- [ ] Send a post to one or more DM threads with an optional message (Phase 9).
- [ ] Add to story: opens the story editor with a post sticker (Phase 5).
- [ ] Repost / Undo repost, with optional note.
- [ ] Copy link (`humans.app/p/<id>`) → "Link copied" toast.
- [ ] Share to… → OS share sheet with the link.
- [ ] Private / close-friends posts: no Repost; link only works for people who can see the post.

### States
- No DM threads yet: grid shows suggested accounts (people you follow).
- Sending: per-avatar spinner then "Sent".

### Sources
- [How to repost on Instagram in 2026 (MessengerBot)](https://messengerbot.app/how-to-repost-on-instagram-in-2026-stories-reels-and-feed/)
- [Instagram repost is here (Brandaid)](https://brandaidmultimedia.com/2025/08/08/repost/)
- [Instagram 2025 update: Reposts (Torro)](https://torro.io/blog/instagram-reposts-map-update)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Build now: **Repost / Undo repost** (optional note; profile Reposts tab; "<user> reposted" in feeds; public posts only), Copy link, Share to… (OS sheet). Send to DMs grid and Add to story appear as "coming soon" entries, wired in Phases 9 / 5. No external-app shortcuts.
- **Date:** 2026-10-08

## 3. Data & storage
- `reposts` (user_id, post_id, note up to 60 chars). Insert only for published, non-archived, Everyone-audience posts of public accounts that aren't yours; note editable (update own); delete own. Select = `can_view_profile(reposter)` and `can_view_post`. `profile_posts(kind 'reposts')` fills the profile Reposts tab; `home_feed` shows reposts by people you follow ("<user> reposted . note").
- No `shares` table yet: sending to chats arrives with Direct (Phase 9).

## 4. Implementation notes
- `PostSheets.tsx` ShareSheet: "Send to friends" stub (Phase 9), Add to story (toast, Phase 5), Repost / Undo repost, Copy link (`humans.app/p/<id>`), Share to... (OS sheet). Repost also sits on the card's action row; the "Reposted / Add note" toast opens the note sheet.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
