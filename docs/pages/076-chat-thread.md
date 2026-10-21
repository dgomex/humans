# Page 076 — Chat thread

- **Phase:** 9 — Direct Messages
- **Status:** Verifying (built 2026-10-14; real-device checks pending)
- **Route:** `app/direct/t/[id].tsx` (+ `app/direct/u/[userId]` resolves/creates a 1:1 thread)
- **Depends on:** pages 74/75; `post_cards` (Phase 4), `story_cards` + `story_replies` (Phase 5), reels (Phase 6), `messages` bucket (Phase 0)

## 1. Research (current Instagram behavior)
### Layout
- **Header:** back, avatar (story ring) + name + subtitle ("Active now", "Active 3h ago" or username), 📞 audio and 🎥 video call (page 82). Tapping the name → chat details (79).
- **Top of conversation:** profile card (large avatar, name, username, "x followers · y posts", "You follow each other on Instagram", **View profile**).
- **Messages:** own messages right (blue → purple gradient, or the chat theme), others left (grey) with the sender's avatar on the last bubble of a run; group chats show sender names. Centered time separators after gaps ("Today 14:05"). Emoji-only messages render large without a bubble.
- **Below the last own message:** "Sent" / "Seen" / "Seen just now"; in groups "Seen by a, b" or small avatars.
- **Typing indicator:** animated dots bubble with the typer's avatar.
- **Composer:** 📷 camera (blue circle), "Message…" field, then 🎤 mic, 🖼 gallery, ☺ stickers / GIFs, ⊕ more; with text: **Send**. Reply preview bar above the field when replying.

### Entry & exit points
- Inbox row, profile Message button, notification, share sheet "Send" (opens the chat on long-press), story reply.
- Shared post / reel / story / profile cards → their screens; images / videos → media viewer (80); name → details (79).

### Features & interactions
- [ ] **Text**, links with previews, @mentions in groups.
- [ ] **Photos / videos** from library (multi) or camera; upload progress; **view once / allow replay / keep in chat** (page 80).
- [ ] **Voice messages**: hold mic (slide left to cancel, slide up to lock), up to 5 min, waveform playback, speed 1× / 1.5× / 2×, (transcription — Meta speech service).
- [ ] **Reactions**: double-tap = ❤️; long-press → emoji bar (6 quick + custom) and "Tap to see reactions".
- [ ] **Reply**: swipe right on a bubble or long-press → Reply; quoted message above the reply, tap scrolls to it.
- [ ] Long-press menu: Reply, Forward, Copy, **Edit** (own, within 15 min, shows "Edited"), **Unsend** (own, any time), **Pin** (≤3 per chat), Translate, Report, Save (media).
- [ ] **Shared content cards**: posts, reels, stories (expire with the story), profiles, audio; respect the viewer's access (private → "Post unavailable").
- [ ] **Story replies / reactions** render with the story thumbnail ("Replied to your story").
- [ ] Stickers / **GIFs** (Giphy), music shares (30 s preview).
- [ ] **Typing** + **Seen** state in real time; read receipts can be turned off (per chat / globally) — off means you don't see others' either.
- [ ] **Scheduled messages** (long-press Send, ≤29 days), **message effects**, **themes** (79), **vanish mode** (swipe up, page 79).
- [ ] System lines: "x named the group…", "x added y", "You missed a video call · Call back".
- [ ] Infinite scroll back in history; jump-to-bottom button.

### States
- Loading: spinner then newest messages.
- Empty: profile card only + "Say hi" wave sticker suggestion.
- Error / offline: failed bubble with ⚠ "Not delivered. Tap to retry"; queued sends.
- Edge cases: request not accepted (page 75 limits), blocked ("You can't message this account"), deleted account ("Instagram User"), left group, shared content deleted ("Post unavailable"), expired story.

### Sources
- [TechCrunch — DM upgrades Feb 2025](https://techcrunch.com/2025/02/19/instagram-upgrades-dms-with-music-sharing-message-scheduling-translation-and-more/) (scheduling, translation, pinning, music)
- [Tubefilter — 20 new DM features](https://www.tubefilter.com/2025/03/10/instagram-dm-direct-message-new-features-adam-mosseri/)
- [Marketing4Ecommerce — 5-minute voice messages + transcription](https://marketing4ecommerce.net/en/novelties-instagram-dms/)
- [Social Media Today — read receipts opt-out](https://www.socialmediatoday.com/news/instagram-now-lets-opt-out-read-receipts-dms/705653/)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Clone minus Meta services: text, links, photos / videos, voice messages (≤5 min, speed), reactions, swipe-to-reply, edit (15 min), unsend, pin ≤3, forward, copy, shared post / reel / story / profile / audio cards, story replies moved from `story_replies`, typing + Seen with read-receipts toggle, scheduled messages, system lines. **Dropped:** GIFs / Giphy stickers (no key, like page 46), translation, voice transcription, message effects. Call buttons "coming soon" (page 82 deferred).
- **Date:** 2026-10-13

## 3. Data & storage
- `messages` (kinds text / media / voice / post / story / profile / audio / system), `message_reactions`, `message_views`; files in `messages/{thread}/{id}.ext` (+ `-thumb.jpg`).
- Clients insert messages directly (column grant + validating trigger); unsend = delete own; `edit_message` (15 min), `pin_message` (≤3); scheduled messages via `scheduled_for`, delivered by pg_cron (`deliver_scheduled_messages`, every minute).
- `thread_messages` (reply / story / profile / audio snippets, reactions, views), `thread_info` (members, seen times, request state), `mark_thread_read`.
- Story replies: trigger `story_replies_to_dm` writes a text message with `story_id` (reactions flagged); older replies were backfilled.
- Realtime `thread:{id}`: message / message_updated / message_deleted / reaction / read / accepted broadcast by triggers; clients send `typing`.

## 4. Implementation notes
- Files: `app/direct/t/[id]/index.tsx`; components `MessageBubble` (swipe-to-reply, double-tap ❤️, long-press menu, reply quote, reactions pill, Edited / Pinned), `MessageContent` (post / story / profile / audio cards, voice player with speed, view-once pill), `Composer` (camera, gallery, voice, Send, long-press Send → schedule), `ThreadSheets` (menu, reactions list, send-media sheet with View once / Allow replay / Keep in chat), `realtime.useThreadChannel`.
- Voice: **tap the mic to record** (then bin or send) instead of Instagram's hold-to-record; ≤5 min with a live waveform.
- Call buttons show "coming soon" (page 82 deferred). Vanish mode is toggled from chat details (no swipe-up gesture yet).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android (real device pending)
- [ ] Matches agreed feature list on iOS (real device pending)
- [x] Light + dark mode (web)
- [x] RLS tested with two users (`scripts/test-direct-rls.mjs`)
- [x] Supabase advisors clean (`db lint`; hosted advisors n/a — local stack only)
