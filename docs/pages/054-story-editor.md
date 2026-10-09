# Page 054 — Story editor

- **Phase:** 5 — Stories
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/story/editor.tsx` (full-screen, inside the story camera modal)
- **Depends on:** story camera (53), music catalog (page 39), `search_profiles`, `hashtags` (Phase 3), `post_cards` (post sticker, Phase 4)

## 1. Research (current Instagram behavior)
### Layout
- Media full-screen (photo/video fitted; pinch to resize/rotate the media itself; background color picked from the media).
- **Top bar:** ‹ back (discard? dialog) · Aa text · ☺ stickers · ♫ music · ✨ effects/filters · ✎ draw · ⋯ (Save, Mention, Label AI, Restyle).
- **Bottom:** "Your story" (avatar) · "Close Friends" (green star) · → "Send to" (audience + DM recipients, page 55).
- Swipe left/right on the media = color filters.

### Features & interactions
- [ ] **Text:** fonts (Classic, Modern, Neon, Typewriter, Strong…), color palette + eyedropper, alignment, background highlight, animations, size slider; @mention and #hashtag autocomplete inside text.
- [ ] **Stickers tray** (searchable): Location, **Mention**, **Hashtag**, **Music**, **Link**, **Poll** (2–4 options), **Question** (Ask me a question), **Quiz** (2–4 options, one correct), **Countdown** (title + end date/time, viewers can set reminders), **Emoji slider**, **Add yours** (prompt chain), GIF (Giphy), Time/Date, Selfie, Frame, Cutout, Avatar, Voice (test), **post sticker** (from share sheet), Reveal, Photo (sticker from library).
- [ ] Every sticker/text item: drag, pinch to scale, rotate with two fingers, drag to a 🗑 bin at the bottom to delete, tap to cycle styles; snap guides at center.
- [ ] **Draw:** pen, marker, neon, eraser, highlighter; brush size; color.
- [ ] **Music:** pick a track + 15 s clip; shown as lyrics, a sticker card, or hidden.
- [ ] Filters (swipe), effects.
- [ ] Save to device (⋯ Save), **Discard** confirm on back.
- [ ] Mentions notify mentioned users (Phase 8) and let them reshare.
- [ ] Videos: mute toggle; trim to 60 s.

### States
- Uploading: story posted optimistically, circle shows a progress ring in the tray ("Your story" spinning); failure → Retry / Delete.
- Limits: ≤10 mentions per story, 1 link, poll text limits, 1 interactive sticker (poll/quiz/question/slider/countdown) per story.

### Sources
- [Instagram stickers guide (Shopify)](https://www.shopify.com/blog/instagram-stickers)
- [Poll, quiz, question stickers (view-ig-story)](https://www.view-ig-story.com/blog/instagram-story-poll-quiz-question-stickers)
- [Instagram story stickers (IZEA)](https://izea.com/resources/instagram-story-stickers/amp/)
- [Instagram Stories updates 2026 (Qode Social)](https://qodesocial.com/new-instagram-stories-updates-2026/)
- Instagram app (iOS/Android), story editor.

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Core set + **photo sticker**: Text (fonts, colours, background, alignment, @/# autocomplete), Draw (pen / marker / neon / eraser), Music (catalog + 15 s clip), stickers Mention, Hashtag, Link, Poll, Question, Quiz, Countdown, Emoji slider, Add yours, Time, Photo (from library), post sticker (share sheet "Add to story"). Drag / pinch / rotate / bin. **Dropped:** GIF, Location, Selfie / Cutout / Avatar / AI, colour filters.
- **Date:** 2026-10-09

## 3. Data & storage
- `stories.content` (v1 overlay document: background gradient, media transform, layout cells, boomerang frames, elements = text / drawing / stickers). Viewers can read it, so quiz answers live only in `story_stickers.correct_option` (not selectable by clients).
- `story_stickers` (poll, quiz, question, slider, countdown, add_yours; one of each per story; Add yours `chain_id` → root sticker), `story_mentions` (≤ 10; mention stickers + @ in text), `reshared_post_id` (post sticker; author's `allow_resharing`).
- Upload: `StoryUploads` queue (persisted, resumable): photos resized to 1080 px, frames and photo stickers to 720 px JPEG, video as recorded + poster → insert story (uploading) + stickers + mentions → upload → `publish_story()` checks every file.

## 4. Implementation notes
- Route `app/story/editor.tsx`; tools in `src/features/stories/components/editor/`: `EditableElement` (drag / pinch / rotate / drop on the bin), `TextTool` (5 system fonts, colors, background none / solid / soft, alignment, size slider, @ / # suggestions), `DrawTool` (pen / marker / neon / eraser, sizes, undo), `StickerTray` + `StickerForm` (setup for each sticker kind). Music reuses `MusicPicker` (extracted from page 39). ⋯ Save captures the canvas (native) via view-shot.
- Footer (page 55): Your story · Close Friends · → share screen. Several picked items are edited one by one (strip) and shared as separate stories.

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending: pinch / rotate, drawing feel, Save)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`test-stories-rls.mjs`: sticker limits, quiz answer hidden, mentions only while uploading, post sticker rules)
- [x] Supabase advisors clean
