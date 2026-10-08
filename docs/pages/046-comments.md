# Page 046 — Comments

- **Phase:** 4 — Home Feed & Post Interactions
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/p/[id]/comments.tsx` (sheet-style screen; opened from feed + post detail)
- **Depends on:** `posts`, `can_view_post`, `search_profiles` (mentions), CaptionText

## 1. Research (current Instagram behavior)
### Layout
- Opens as a **bottom sheet** (half height, drag up to full, drag down to dismiss) titled "Comments", with a grabber.
- Optional caption at the top (author avatar + caption + time), then comments: avatar, **username · time (2h / 3d / 5w)**, text with @/# links, "Reply" link, "See translation" (dropped by us — no translation), ♡ on the right with the like count below; "Liked by author" small avatar badge when the post author liked it; **Author** label on the post author's own comments; pin badge "Pinned" for pinned comments.
- Replies are **one level deep**: "— View N more replies" under the parent; replying to a reply targets the parent thread and prefills `@username `.
- Bottom: **emoji quick bar** (❤️ 🙌 🔥 👏 😢 😍 😮 😂) tap inserts the emoji; composer "Add a comment for <username>…" with own avatar, GIF button, and Post (↑) button. While replying: "Replying to <user> ✕" strip above.

### Features & interactions
- [ ] Post a comment / reply (max 2,200 chars, ≤30 hashtags, ≤5 mentions per comment); appears immediately (optimistic) with "Posting…".
- [ ] Like a comment (double-tap the comment or ♡); likes count tap → list of likers.
- [ ] Long-press / swipe left on a comment → actions: own comment: **Delete**; post author on others' comments: **Pin** (≤3), **Delete**, **Hide** (moves to "View hidden comments" at the bottom), Report; others' comments: Report. Delete shows an Undo toast.
- [ ] Ordering: pinned first, then ranked ("For you": comments from people you follow + most liked), newest replies within a thread oldest→newest.
- [ ] @mention autocomplete (reuse CaptionInput logic); # autocomplete.
- [ ] GIF comments (Giphy picker).
- [ ] Comments turned off: sheet shows "Comments on this post have been limited/turned off", composer hidden.
- [ ] Hidden like counts don't hide comment counts.

### States
- Loading skeletons; Empty: "No comments yet — Start the conversation."; Error: retry row; offline: failed comment shows "Couldn't post. Tap to retry."
- Deleted parent: replies are deleted with it. Blocked users' comments hidden (Phase 11).

### Sources
- [Threaded comments (9to5Mac, 2017)](https://9to5mac.com/2017/08/15/instagram-threaded-comments/)
- [Pin your own comments (Social Media Today)](https://www.socialmediatoday.com/news/instagram-adds-option-pin-your-own-post-comments/759457/)
- [Pinned comments in 2026 (Metricool)](https://metricool.com/pinned-comments-instagram/)
- [GIF comments (The Quint)](https://www.thequint.com/tech-and-auto/tech-news/instagram-rolls-out-new-features-like-gif-comments-on-posts-reels-details)
- [Hide comments 2026 guide (Reply200)](https://reply200.com/blog/hide-comments-on-instagram/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Full comments sheet minus **GIF comments** (no Giphy key) and minus "See translation": one-level replies, comment likes + likers list, Author / liked-by-author badges, pin ≤3, hide / delete (post author), delete own, report, emoji quick bar, @/# autocomplete.
- **Date:** 2026-10-08

## 3. Data & storage
- `comments` (post_id, author_id, parent_id one level: replying to a reply re-points to its thread; body checked by `is_valid_comment`: 1-2,200 chars, max 30 hashtags, max 5 mentions; trigger-kept like_count / reply_count; pinned_at, hidden_at). RLS: select = `can_view_post` and (not hidden, or writer, or post author); insert own on published posts with commenting on; delete by writer or post author (replies cascade); no client updates.
- `comment_likes` (visible and likeable when the comment is visible). RPCs: `post_comments(post, kind top|replies|hidden, parent, offset, limit)`, `set_comment_pinned` (post author, top-level, max 3), `set_comment_hidden` (post author; unpins), `comment_likers`.

## 4. Implementation notes
- `app/p/[id]/comments.tsx` (transparent full-window route + our own `ScreenSheet` panel: opens at ~72%, drag up = full height, drag down / tap outside = close, expands and sits on the keyboard while typing; native form sheets broke layout and keyboard on iOS): caption row, ranked top-level comments (pinned -> people you follow / your recent -> most liked -> newest), "View N more replies" threads (auto-open after you reply), Author / pinned / liked-by-author badges, double-tap a comment to like, long-press menu (Pin, Hide, Delete with a 4 s Undo, Report), optimistic "Posting..." rows with tap-to-retry, hidden-comments section for the post author, "Commenting has been turned off".
- `components/CommentComposer.tsx`: emoji quick bar, "Replying to ..." strip, @/# suggestions above the field, Post button.
- No GIFs, no translation (decision).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`node scripts/test-feed-rls.mjs`, 105 checks)
- [x] Supabase advisors clean (`npx supabase db lint`)
