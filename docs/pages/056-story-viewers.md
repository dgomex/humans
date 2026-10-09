# Page 056 — Story viewers list & insights (own story)

- **Phase:** 5 — Stories
- **Status:** Verifying (built; on-device check pending)
- **Route:** sheet over the story viewer (swipe up / "Activity" on own story)
- **Depends on:** `story_views`, `story_likes`, sticker responses (this phase)

## 1. Research (current Instagram behavior)
### Layout
- Swipe up on your own story (or tap "Activity" with avatars at bottom-left) → the story shrinks into a **horizontal strip of your active stories** at the top; tapping another switches the list.
- Each story's panel: 👁 **view count** · 🗑 delete · (business: 📊 insights tab).
- **Viewers list**: avatar, username, full name, ♥ red heart if they liked it, sticker response (poll choice, slider emoji, quiz answer), and ⋯ per row (Hide story from, Remove follower) + "Send message" button.
- Interactive stickers add sections above the list: **poll results** (percent + who voted what), **quiz** (who was right), **question responses** (cards you can tap → share answer to your story), **slider average**, countdown reminders.
- Order: ranked by interaction (people you interact with most first), not chronological. Non-followers appear too.

### Entry & exit points
- Own story viewer (52) bottom "Activity" / swipe up. Viewer row → profile. Question response → story editor with the answer card.
- Swipe down → back to the story (resumes).

### Features & interactions
- [ ] View count + viewer list per story, with like hearts.
- [ ] Sticker results (poll / quiz / slider / question answers).
- [ ] Hide story from this person (adds to hide list) from the row ⋯.
- [ ] Search viewers (paid Instagram Plus test).
- [ ] Viewer names kept **48 h** after posting; after that only the count (archive / highlights).
- [ ] Insights (reach, navigation, interactions) — professional accounts only (**out of scope**).

### States
- No viewers yet: "No one has seen this story yet" (eye icon).
- Loading: skeleton rows.

### Sources
- [How to see who viewed your story (Unilink, 2026)](https://www.unilink.us/blog/how-to-see-who-viewed-your-instagram-story)
- [Can you see who viewed your story (Sociavault)](https://sociavault.com/blog/can-you-see-who-viewed-instagram-story)
- [Instagram Plus story perks (Hootsuite 2026)](https://blog.hootsuite.com/instagram-stories/)

## 2. User decision
- **Choice:** Full clone
- **Changes requested:** As specced: strip of active stories, count, delete, viewers ranked by interaction with ♥ likes / sticker answers / replies, poll / quiz / slider / question results (reshare an answer as a story), row ⋯ (Hide story from, Remove follower), Send message (stub until Phase 9), viewer search, names kept 48 h then count only. No professional insights.
- **Date:** 2026-10-09

## 3. Data & storage
- `story_views` select: the viewer's own rows, or the author while the story is < 48 h old (names); `stories.view_count` stays afterwards. `story_viewers(story, search, offset, limit)` ranks by likes, replies, sticker answers, Close Friends / Favorites, mutual follow, then recency. `story_responses(story)` lists every answer (author only). `story_sticker_results()` gives viewers aggregates only after they answer.

## 4. Implementation notes
- `ViewersSheet` (opened from Activity or swipe up on your story): strip of your active stories, count + likes, delete, results panels (poll / quiz voters, slider average, countdown reminders, question answers → "Share" opens the camera with an answer sticker), search, rows with ♥ and reply / answer summary, row ⋯ (Hide story from / Show story, Remove follower), ✈ stub (Phase 9).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (names 48 h, likes / replies / answers private to the author)
- [x] Supabase advisors clean
