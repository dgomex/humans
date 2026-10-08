# Page 049 — Post options menu

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** component (`PostOptionsSheet`), from ⋯ on any post
- **Depends on:** saves, favorites (Phase 2), follows, report flow (50), mute (Phase 11)

## 1. Research (current Instagram behavior)
### Layout (someone else's post)
- Bottom sheet. Top row of round icon buttons: **Save** (bookmark) · **Remix** (reels only) · **QR code** (some builds).
- List: **Add to favorites / Remove from favorites** · **Unfollow** · **About this account** · **Why you're seeing this post** · **Hide** · **Not interested** (suggested posts) · **Report** (red).
- Hide / Not interested replace the card in place with "Post hidden — We'll suggest fewer posts like this" + **Undo**, plus follow-ups (Snooze suggested posts 30 days, Mute <user>, Unfollow, Report).
- Own posts: Phase 3 items (Edit, Archive, Pin, Hide like count, Turn off commenting, Delete) plus Share to…, Copy link.

### Features & interactions
- [ ] Save/unsave (mirrors the bookmark).
- [ ] Favorites toggle (≤50, must follow — Phase 2 rules).
- [ ] Unfollow (confirm on private accounts: you'd need to request again).
- [ ] About this account (Phase 2 page 23).
- [ ] Why you're seeing this post: "You follow <user>" / "Suggested because…" / "<user> is in your Favorites".
- [ ] Hide (feed only) with Undo; Not interested (suggested posts) with Undo — feeds into ranking.
- [ ] Mute <user> posts (follow-up; Phase 11 owns the Muted accounts list).
- [ ] Report → page 50.

### States
- Actions are optimistic with toasts; failures revert.

### Sources
- [Not interested list (Instagram Help)](https://help.instagram.com/iphone-app/1856051198102846)
- [Undo Not interested (ITGeared)](https://www.itgeared.com/how-to-undo-not-interested-on-instagram/)
- [Mute without unfollowing (SimpleHelp)](https://www.simplehelp.net/2019/07/01/how-to-ignore-an-instagram-account-without-unfollowing-it/amp/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced. Mute / Snooze follow-ups show as "coming soon" (mutes owned by Phase 11).
- **Date:** 2026-10-08

## 3. Data & storage
- `saves` (owner-only; adding to a collection saves the post; unsaving removes it from every collection), `post_hides`, `favorites` / `follows` (Phase 2).

## 4. Implementation notes
- `PostSheets.tsx` OptionsSheet. Others' posts: Save / Copy link, Add to / Remove from favorites, Unfollow (confirm for private accounts), Why you're seeing this post, Hide / Not interested (feeds only; the card becomes "Post hidden" + Undo, Mute = coming soon, Report), Remove me from post (if tagged, page 37), About this account, Report. Own posts: Copy link, Share to..., Edit, Archive / Show on profile, Pin, Hide like count, Turn off commenting, Delete.
- Bookmark: tap = save ("Saved / Save to collection" toast), long-press = collection picker. Saved grids now show real posts (`saved_posts`).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
