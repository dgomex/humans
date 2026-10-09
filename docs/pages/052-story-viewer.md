# Page 052 — Story viewer

- **Phase:** 5 — Stories
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/stories/[userId].tsx` (full-screen modal; swipes across the tray's users)
- **Depends on:** `stories`, `story_views` (this phase); Home stories tray (page 43); `can_view_profile`, `close_friends` (Phase 2); DMs (Phase 9) for replies

## 1. Research (current Instagram behavior)
### Layout
- Full-screen black canvas, media fit to 9:16 (letterboxed / blurred background for other ratios).
- **Top:** one thin **progress bar per story** of the current user (filled = seen, animating = current). Under it: avatar · username · relative time ("3h") · optional "Close Friends" green badge · music/audio chip or "Add yours" chip when present · ⋯ menu · ✕.
- **Bottom (others' stories):** "Send message" pill field · ♡ **like** (private story like, since 2023) · ✈ share (public accounts only).
- **Bottom (own story):** "Activity" with viewer avatars + count (swipe up → viewers list, page 56) · Highlight · Mention/Send · ⋯ More (Delete, Archive/Save, Share as post, Story settings).
- iOS and Android are the same layout; Android shows the system back gesture as close.

### Entry & exit points
- Home stories tray (ring = unseen, grey = seen, green = Close Friends), profile avatar with a ring, highlights (page 57), a story shared in DMs (Phase 9), notifications (Phase 8).
- ✕, swipe down, or back → close to where you came from (avatar-zoom animation).
- Username/avatar → that profile. Mention sticker → "View profile" pill. Post sticker → post (page 44).

### Features & interactions
- [ ] Auto-advance: photos 5 s, videos their length (≤60 s per segment); next user's stories after the last one; close after the last user.
- [ ] Tap right = next, tap left = previous (or previous user), **press and hold = pause** (UI hides), release = resume.
- [ ] **Horizontal swipe** = previous/next user with a 3D cube transition.
- [ ] **Swipe down** = close; **swipe up** = reply field (others) or viewers list (own).
- [ ] Start at the **first unseen** story of each user; tray order = unseen first, then by recency / closeness.
- [ ] Mark each story as **viewed** (creates a viewer entry); rings turn grey when all seen.
- [ ] **Reply**: text in "Send message…" goes to a DM thread with the story attached; **quick reactions** row (😂 😮 😍 😢 👏 🔥 🎉 💯) when the field is focused.
- [ ] **Like** a story (♡ fills red; private: only the author sees it in the viewers list).
- [ ] Interactive stickers respond in place (poll vote, quiz answer, slider, question box, countdown reminder, link opens browser, Add yours).
- [ ] Video: sound on by default; mute toggle; pause while the keyboard is open.
- [ ] ⋯ menu for others: Report, Mute (stories), About this account, Copy link (public).
- [ ] Preloads the next story's media; haptics on like.
- [ ] 2025 test: public story comments (Story comments, visible to all viewers) — limited rollout.

### States
- Loading: spinner over the progress bar; buffered segment shows blurred preview.
- Empty: a user with no active stories is not in the tray; opening a stale link → "This story is unavailable".
- Error/offline: "Couldn't load" with tap to retry; skips after timeout.
- Edge cases: author deleted the story while viewing (skip), private account you stopped following (unavailable), Close Friends story you were removed from (hidden), blocked users (never shown), expired after 24 h (only owner sees it in archive).

### Sources
- [How to react on Instagram story (InstantDM, 2026)](https://instantdm.com/blog/how-to-react-on-instagram-story)
- [Instagram Stories tips & new features 2026 (Hootsuite)](https://blog.hootsuite.com/instagram-stories/)
- [New Instagram Stories updates 2026 (Qode Social)](https://qodesocial.com/new-instagram-stories-updates-2026/)
- [Link sticker replaces swipe-up (Tribune India)](https://www.tribuneindia.com/news/science-technology/instagram-ditching-swipe-up-gesture-to-access-links-report-301877/amp)
- Instagram app (iOS/Android), story viewer.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Full viewer as specced (progress bars, auto-advance 5 s / video length, tap / hold / cube swipe / swipe down, first unseen story, view tracking + ring states incl. green Close Friends, private ♡ like, interactive stickers answered in place, ⋯ Report / Copy link). **Replies + quick reactions are stored now** in `story_replies` (owner sees them in the viewers list); Phase 9 turns them into DM messages. ⋯ Mute shows "coming soon" (mutes owned by Phase 11). No public story comments.
- **Date:** 2026-10-09

## 3. Data & storage
- `stories` (kind photo / video / text / boomerang / layout, files in `stories/{author}/{story}/…`, `content` overlay JSON, audience, music, view/like/reply counters), `story_views`, `story_likes` (private: liker + author), `story_replies` (stored now; DMs in Phase 9), `story_sticker_responses`.
- Visibility `can_view_story()`: author, or published + `can_view_profile` + not in the author's `story_hidden_from` + Close Friends membership for CF stories + (< 24 h or in a highlight). The `stories` bucket select policy uses the same rule.
- RPCs: `stories_tray()`, `story_rings(uuid[])`, `story_reel(user)`, `story_cards(uuid[])` (+ sticker results, my answers, seen / liked, replies_allowed), `mark_stories_viewed(uuid[])`.
- Reports accept `target_type = 'story'`.

## 4. Implementation notes
- Routes: `app/stories/[userId].tsx` (tray order via `viewerQueue`), `app/stories/view.tsx` (specific stories: archive, Add yours).
- `StoryPager` (cube transition, swipe down to close, neighbours preloaded), `StoryPlayer` (timer on a Reanimated shared value, pause on hold / keyboard / sheets / background, video via expo-video, music via expo-audio), `StoryCanvas` (`StoryBase` + `StoryElements`, 1080 × 1920 canvas units), `StickerView` (all sticker kinds, answered in place), `StoryFooter` (reply + quick reactions, ♡, ✈ stub; own: Activity / Highlight / More), `StorySheets` (⋯ options, ask, Add yours chain, add to highlight).
- Home tray: `StoriesTray` (ring states, upload progress ring, retry / discard). Profile avatar ring opens the viewer.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web; the viewer is always dark like Instagram)
- [x] RLS tested with two users (`node scripts/test-stories-rls.mjs`, 112 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
