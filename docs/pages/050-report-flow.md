# Page 050 — Report flow

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/report.tsx` (modal stack; params: target type + id)
- **Depends on:** `reports` (this phase); block/restrict (Phase 11)

## 1. Research (current Instagram behavior)
### Layout
- Full-height sheet/screen titled **Report**. Step 1: "Why are you reporting this post?" with a note that reports are anonymous (except intellectual property). Reasons (2025–2026):
  1. I just don't like it
  2. Bullying or unwanted contact
  3. Suicide, self-injury or eating disorders
  4. Violence, hate or exploitation
  5. Selling or promoting restricted items
  6. Nudity or sexual activity
  7. Scam, fraud or spam
  8. False information
  9. Intellectual property
- Most reasons open a sub-reason list (e.g. Violence → credible threat, hate speech, terrorism…; Bullying → me / someone I know / someone else), sometimes a short explainer, then **Submit report**.
- Final screen: ✓ "Thanks for your feedback" + what happens next, and actions: **Block <user>**, **Restrict**, **Unfollow**, **Mute**, "Learn more about our Community Guidelines". "I just don't like it" skips submission and offers Hide/Unfollow/Mute instead.
- Same flow for comments, accounts, and later stories/reels/messages/live.
- Self-injury reports also show support resources.

### Features & interactions
- [ ] Multi-step navigation with back; can't report own content.
- [ ] Reported post is hidden from your feed afterwards.
- [ ] "Support requests" / report status inbox (Settings → Help) — Phase 11 page 108.

### States
- Submitting spinner; error toast "Couldn't send report"; duplicate report = silently accepted.

### Sources
- [Report a post: reasons and outcomes (YouReputation)](https://youreputationsolution.com/blog/report-a-post-on-instagram-what-happens/)
- [Report a comment, post or story (Clearline)](https://clearlinereputation.pro/blog/instagram-report-comment/)
- [Report problematic posts (Alibaba Insights)](https://www.alibaba.com/product-insights/how-to-effectively-report-and-resolve-problematic-instagram-posts.html)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** 9 reasons → sub-reasons → submit → thanks screen with Unfollow; Block / Restrict / Mute entries "coming in Phase 11". Reports stored in `reports`; no moderator dashboard.
- **Date:** 2026-10-08

## 3. Data & storage
- `reports` (reporter, target_type post | comment | profile, target_id, reason = one of the 9 reasons, sub_reason up to 80 chars, status open / reviewed / actioned / dismissed). One per person per target (a repeat is a no-op). Trigger: the target must exist and be visible, and you can't report yourself; a reported post goes into `post_hides` (reason reported). RLS: insert own, select own (support requests later); no client update/delete. No moderator UI.

## 4. Implementation notes
- `app/report.tsx` (modal; `?type=post|comment|profile&id=`): reasons -> sub-reasons (self-injury shows a support note) -> thanks screen with Unfollow (works) and Mute / Restrict / Block ("coming soon", Phase 11). "I just don't like it" doesn't file a report: it offers Hide this post + the same follow-ups.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
