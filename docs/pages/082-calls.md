# Page 082 — Voice & video call screens

- **Phase:** 9 — Direct Messages
- **Status:** Deferred
- **Route:** `app/call/[id].tsx` (full-screen modal) + incoming-call overlay
- **Depends on:** page 76 (call buttons), **a WebRTC media stack** (decision needed)

## 1. Research (current Instagram behavior)
### Layout
- **Outgoing:** blurred profile photo background, avatar, name, "Calling…" → "Ringing…"; bottom bar: 🎥 camera on/off, 🎤 mute, 🔄 flip, 🔊 speaker, 🔴 end.
- **In call (video):** remote full-screen, own preview draggable PiP; tap to hide controls; timer; add-people icon; effects.
- **Incoming:** full-screen (iOS CallKit / Android full-screen intent when backgrounded) with Accept / Decline; in-app banner when using the app.
- **Minimize:** call shrinks to a floating window while you browse Instagram; OS picture-in-picture when leaving the app.

### Entry & exit points
- Thread header 📞 / 🎥 (76), chat details Audio / Video (79), "Call back" on a missed-call line.
- End → back to the thread with a system line ("Video chat ended · 4:12" / "Missed audio call").

### Features & interactions
- [ ] 1:1 and group calls (Instagram: up to 8 participants in video chats).
- [ ] Only between people who have accepted the chat (no calls from requests).
- [ ] Mute calls per chat (79); "Ringing" respects Do Not Disturb.
- [ ] Missed / declined call messages in the thread.
- [ ] Co-watching posts during a call, AR effects (secondary).

### Technical notes (research)
- Needs WebRTC (`react-native-webrtc` or LiveKit / Daily / Agora SDKs), a signalling channel (Supabase Realtime works), and TURN servers for NAT traversal (a hosted provider or self-hosted coturn).
- These are **native modules: not available in Expo Go**; testing needs an EAS development build. Ringing while the app is closed needs push (VoIP push / CallKit on iOS, FCM high-priority on Android), which Phase 8 deferred.

### Sources
- [Instagram — DMs feature page](https://about.instagram.com/features/direct)
- [Sked Social — Instagram video calls](https://skedsocial.com/blog/instagram-video-call.md)
- [Mobigyaan — group video call limit](https://www.mobigyaan.com/instagram-group-video-call-limit-six-people)

## 2. User decision
- **Choice:** Deferred
- **Changes requested:** Calls need WebRTC native modules (EAS dev build, not Expo Go) + TURN + push. Call buttons show "coming soon"; revisit with a dev-client build and push (page 100).
- **Date:** 2026-10-13

## 3. Data & storage
_Not built (deferred). Likely: a `calls` table (thread, started_by, kind, started / ended), call lines in the thread, and a token-minting Edge Function for the chosen WebRTC provider._

## 4. Implementation notes
_Deferred. 📞 / 🎥 in the thread header and chat details show "Calls are coming soon". Needs an EAS development build (WebRTC native modules), TURN servers, and push for ringing (page 100)._

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
