# Page 071 — Notifications (Activity) feed

- **Phase:** 8 — Notifications / Activity
- **Status:** Verifying (built 2026-10-13; real-device checks pending)
- **Route:** `app/activity/index.tsx` (pushed from Home ♡; full screen, no tab bar, like Instagram)
- **Depends on:** `follows`, `follow_requests` (Phase 2), `likes`, `comments`, `comment_likes`, `reposts` (Phase 4), `post_mentions`, `post_tags`, `post_collaborators` (Phase 3), `story_mentions`, `story_likes`, `story_sticker_responses` (countdown reminders), `stories` (Phase 5), `posts.remix_of`, original `audio_tracks` (Phase 6), `profile_notification_prefs` (Phase 2 bell), `suggested_accounts` (Phases 1/2)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** back chevron, title **"Notifications"** (older builds: "Activity"). iOS centers nothing (title left of center after the chevron); Android title left-aligned. No right-side actions on the current build (filters were tested and partially removed; some builds show a "Filter" chip row: All · Comments · Follows · Verified).
- **Follow requests row** (private accounts with pending requests only): stacked avatars (newest two), **"Follow requests"** bold, subtitle "username + N others", blue unread dot, chevron → page 72.
- Optional **"Collaboration invites"**-style rows sit inside the list as notifications (Accept / Decline inline).
- **Sections by time:** **New** (unseen since you last opened Activity) · **Today** · **Yesterday** · **Last 7 days** · **Last 30 days** · **Older**. Section headers are bold 16 pt.
- **Rows:** avatar (40 pt; **two overlapped avatars** when grouped), text = bold username(s) + action + light-grey relative time ("2h", "3d", "1w"), right side = **post / reel / story thumbnail** (44 pt square, 3:4 for reels) **or** a **Follow / Following / Follow back** button for follow events, **Confirm / Delete** for requests just handled, **Accept / Decline** for collab invites. Story-ring around avatars that have an active story (tapping the avatar opens the story).
- **Comment / mention rows** quote the comment ("commented: Nice shot 🔥") and show an inline **♡ like** for the comment and a **Reply** action under the text.
- **"Suggested for you"** section at the bottom: accounts with reason line ("Followed by x", "Suggested for you", "From your contacts"), Follow button and ✕ remove; **"See all"** → Discover people (page 73).
- iOS vs Android: same list; Android uses Material ripple and toolbar title left-aligned; iOS uses swipe-back.

### Entry & exit points
- Home header ♡ (with a **red dot** when there are unseen notifications; a small bubble popup "♥ 3 · 👤 1 · 💬 2" briefly appears under the ♡ on new activity).
- Push notification tap → the specific target (and marks Activity seen).
- Rows → post (`/p/[id]`, scrolled to the comment for comment rows → comments sheet), reel (`/reel/[id]`), story (story viewer / highlight), profile (follows), audio page (uses of your audio), remixes, follow requests (72), Discover people (73).
- Back → Home.

### Features & interactions
- [ ] **Event types (own content):** likes on posts / reels; likes on your comments; comments + replies on your posts; replies to your comments; @mentions in comments, captions, stories; tagged in a post; new follower; follow request (private) and "accepted your follow request"; collaboration invite (Accept / Decline) + "accepted your invite"; reposted your post / reel; liked your story (private likes — Instagram shows story likes only in the viewers list; recent builds also list them); remixed your reel; used your audio; countdown you set a reminder for has ended; "Add yours" participation on your sticker; story replies are DMs (Phase 9).
- [ ] **Bell notifications** (page 17 bell): "x shared a new post / reel / story" from accounts you turned on post/story/reel notifications for.
- [ ] **Grouping:** likes on the same post collapse into one row: "a, b and 23 others liked your post". Same for likes on a comment, new followers ("a, b and 5 others started following you"), and uses of your audio. Comments are **not** grouped.
- [ ] **Unseen state:** rows created since last visit sit under **New**; opening the screen marks everything seen (the ♡ dot clears). No per-row unread dot.
- [ ] **Follow back inline** from follower rows; button shows Following / Requested.
- [ ] **Like comment inline**, **Reply** opens the comments sheet with "Replying to @x".
- [ ] **Accept / Decline collab invite inline.**
- [ ] **Delete a notification:** long-press (Android) / swipe-left or long-press (iOS) → "Delete notification"; some builds also offer "Turn off notifications like this" (links to notification settings, page 100).
- [ ] **Pull to refresh**; infinite scroll back ~30–90 days (older notifications drop off).
- [ ] **Realtime:** new notifications appear while the screen is open; the ♡ dot appears live on Home.
- [ ] **Push notifications** (cross-cutting): same events delivered as OS push via Expo Notifications; the permission prompt at the end of sign-up (Phase 1 decision deferred it here); tapping opens the target. Prefs per category live in page 100 (Phase 11).
- [ ] **Undo on retraction:** unlike / delete comment / unfollow removes the corresponding notification (or removes the actor from a group).
- [ ] **Self-actions never notify.** Private/blocked/restricted actors are suppressed (blocks/restricts arrive in Phase 11).

### States
- Loading: skeleton rows (circle + two lines + square).
- Empty: heart-in-circle icon, **"Activity On Your Posts"**, "When someone likes or comments on one of your posts, you'll see it here." + "Share your first photo or video" link → Create. Suggested for you still shows below.
- Error / offline: "Couldn't refresh feed" toast; cached list stays.
- Edge cases: target deleted / archived / now invisible → row hidden; actor deleted → row hidden; actor became private and you don't follow → row still shows (it's your content); hidden like counts don't affect notifications; mentions from accounts you can't view are not shown.

### Sources
- [Gadget Hacks — Notification filters in Instagram](https://smartphones.gadgethacks.com/how-to/coming-soon-notification-filters-instagram-will-help-organize-your-activity-alerts-0203811/) (filter menu on the Activity "You" tab: All / Comments …)
- [PhoneArena — Instagram removes Following activity tab](https://www.phonearena.com/news/Instagram-removes-ability-see-peoples-comments-likes-follows_id119488) (Activity = only your own activity + suggestions)
- [itgeared — How to clear notifications on Instagram](https://www.itgeared.com/how-to-clear-notifications-on-instagram) (long-press → delete notification)
- [pvstory — Instagram Notification Settings Guide (2026)](https://pvstory.co.uk/instagram-notification-settings/) (categories: Posts, stories & comments; Following & followers; Off / People I follow / Everyone)
- [Inro — The new Instagram tabs layout (2026)](https://www.inro.social/blog/instagram-tabs-new-layout-2025) (Activity stays behind the Home ♡)
- Current Instagram app behavior (iOS / Android 2025–26 builds) for section names, grouping and row layout.

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** Everything in section 1. **No OS push notifications for now** (user choice): alerts are in-app only — Home ♡ red dot + bubble popup, an in-app top banner when a notification arrives while the app is open, and realtime updates. Push tokens / Edge Function fan-out / permission prompt deferred to page 100 (Phase 11). "Turn off notifications like this" waits for page 100.
- **Date:** 2026-10-13

## 3. Data & storage
- Tables: `notifications` (recipient, actor, type ∈ 21 kinds, post / comment / story / audio refs with cascade, `data` jsonb, unique per recipient+type+actor+targets), `activity_state` (seen_at).
- Writers: definer triggers on `likes`, `comment_likes`, `comments`, `follows`, `reposts`, `story_likes`, `post_mentions`, `post_tags`, `post_collaborators`, publish of `posts` (tags, collab invites, remix, audio use, bell) and `stories` (mentions, Add yours, bell); `approve_follow_request` adds `follow_accepted`; `sync_countdown_notifications()` materializes ended countdowns (called by `activity_badge`). Retractions delete rows (unlike, unfollow, untag, decline, caption edit, undo repost); deleted targets cascade.
- Reads: `visible_notifications(before)` (target still visible via posts / comments / stories RLS; story mentions + countdowns survive expiry), `activity_feed(seen, before, tz, offset, limit)` (sections + grouping of likes / comment likes / story likes / audio uses / follows), `activity_badge()`, `mark_activity_seen()`, `notification_preview(id)`.
- RLS: notifications select / delete own, no client insert / update; activity_state select own (writes via RPC).
- Realtime: `notifications` + `follow_requests` in `supabase_realtime` (in-app banner + badge). No Edge Function / push (decision).

## 4. Implementation notes
- Components (new): `NotificationRow` (single / stacked avatars, story ring, grouped names, action text, post / story thumbnail, Follow back, Reply + ♡ for comments, collab Accept / Decline), `ActivityHeart` (♡ dot + count bubble), `ActivityAlerts` (Realtime listener + top banner, mounted in the root layout when signed in), `SuggestionsSection`.
- Reused: `FollowButton`, `Avatar`, `BottomSheet` + `ActionRow` (long-press → Delete notification), `TopBar`, `useMediaUrl`, story rings.
- Files: `app/activity/index.tsx`, `src/features/activity/{api,format,ActivityAlerts}.ts(x)`, `components/*`. Comments route takes `?replyTo=&replyUser=` (Reply from Activity); `CommentComposer.initialText`.
- Removed stubs: `app/collab-invites.tsx` (+ ☰ entry, `useCollabInvites`); Home ♡ toast.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending: haptics, long-press, banner over native views)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web, phone viewport)
- [x] RLS tested with two users (`node scripts/test-activity-rls.mjs`, 77 checks)
- [x] Supabase advisors clean (`supabase db lint`)
