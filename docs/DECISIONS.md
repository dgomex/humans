# Decision Log

Decisions agreed with the user. Append new entries; don't rewrite old ones (add a new entry that supersedes instead).

| Date | Scope | Decision | Notes |
|---|---|---|---|
| 2026-10-05 | Project | Clone Instagram consumer features for Android + iOS | Scoped per page |
| 2026-10-05 | Stack | Expo (React Native, TypeScript, Expo Router) | Chosen over Flutter / bare RN |
| 2026-10-05 | Backend | Supabase for DB/Auth/Realtime; Supabase Storage acts as the S3 bucket | |
| 2026-10-05 | Scope | Exclude business/monetization surfaces | Ads, Shopping, Subscriptions, Pro dashboard, Meta Verified |
| 2026-10-05 | Process | Every page: deep research, then ask the user to fully clone or change, then build | |
| 2026-10-05 | Foundation | Expo SDK 57 (RN 0.86, React 19.2, React Compiler on); routes in root `app/`, code in `src/` | Matches ARCHITECTURE.md; template's `src/app` not used |
| 2026-10-05 | Foundation | Tab order Home · Explore · Create · Reels · Profile (from PLAN); Create opens a full-screen modal, not a tab screen | Instagram's live tab order changes; PLAN order kept |
| 2026-10-05 | Foundation | System fonts (SF Pro / Roboto), as Instagram uses; icons from @expo/vector-icons behind a semantic `Icon` registry | Glyphs can be swapped for custom SVGs later in one file |
| 2026-10-05 | Foundation | Own BottomSheet (Modal + Reanimated + Gesture Handler) and Toast instead of third-party libs | Avoids version lock with Reanimated 4 |
| 2026-10-05 | Foundation | Auth session in SecureStore (chunked) on native, localStorage on web | |
| 2026-10-05 | Foundation | Storage baseline = owner-only; cross-user read policies are added by the phase owning the related table | See schema registry |
| 2026-10-05 | Foundation | Hosted Supabase project deferred; develop against the local stack for now | User decision |
| 2026-10-05 | Phase 1 | Accounts use **email only** (no phone sign-up/login/recovery, no SMS provider) | Phone may be added later |
| 2026-10-05 | Phase 1 | **Drop all Meta/Facebook surfaces** (from-Meta splash, Facebook login/import, Accounts Center, cross-app profiles); no replacement social login | |
| 2026-10-05 | Phase 1 | **2FA deferred** to Phase 11 (page 14 not built now) | |
| 2026-10-07 | Product | **No teen accounts**: all accounts have the same features; only under-13s are blocked at sign-up | Applies to every later phase (privacy, DMs…) |
| 2026-10-07 | Auth (tech) | Saved logins keep the account's refresh token on the device and are **not revoked** on logout (enables one-tap login like Instagram); "Not now" logins are fully signed out | Removing a saved profile only forgets it locally |
| 2026-10-07 | Auth (tech) | Login/recovery by username go through the `account-auth` Edge Function; login reports unknown account vs wrong password, like Instagram | Consistent with the page 012 choice |
| 2026-10-07 | Phase 1 | Language selector shows English (US) only until translations exist; the notifications permission prompt at the end of sign-up waits for Phase 8 (push) | |
| 2026-10-08 | Navigation (tech) | Each tab is its own Stack; profile routes are shared (`(home,explore,reels,profile)/[username]`) so profiles open inside the current tab with the tab bar visible, like Instagram | Cold deep links open in the Explore tab |
| 2026-10-08 | Phase 2 (tech) | Until Settings (Phase 11) and Activity (Phase 8) exist: ☰ opens a small temporary menu (Saved, Close Friends, Favorites, Follow requests, QR, Log out), Edit profile has a temporary Private switch, and follow requests are answered on a stub screen | Tracked in Prerequisite stubs |
| 2026-10-08 | Phase 2 (tech) | Profile links / QR codes use `https://humans.app/<username>` as a placeholder origin (`PUBLIC_WEB_ORIGIN`) | Change when a real domain exists |

| 2026-10-08 | Phase 3 | Post creation uses the OS photo picker (works in Expo Go everywhere); no image filters/adjustments; no locations; music = placeholder royalty-free catalog | See pages 32, 35, 38, 39 |
| 2026-10-08 | Phase 3 (tech) | Uploads go straight from the device to Storage with a persisted client queue; posts stay `uploading` (invisible to others) until `publish_post` checks every file | Page 40 |
| 2026-10-08 | Phase 3 (tech) | Videos (≤60 s) are uploaded as recorded with an on-device poster frame; no server transcoding or video filters. Photos are cropped + resized to 1080 px JPEG on the device | Media pipeline (cross-cutting) |
| 2026-10-08 | Phase 3 (tech) | Until Phase 4/7/8 exist: a minimal own-post viewer stubs page 44, collaboration invites get a stub screen (☰ menu), and `hashtags` is a caption-parsed stub | Tracked in Prerequisite stubs |
| 2026-10-08 | Phase 3 (tech) | Post visibility = `can_view_post` (author, collaborators, or published + not archived + `can_view_profile` + Close Friends membership); the posts bucket uses the same rule | Reuse for likes/comments/saves |
| 2026-10-08 | Phase 4 (tech) | Feeds are ranked in SQL (`home_feed` / `suggested_posts`) with a snapshot timestamp for stable paging; impressions (`post_seen`) and hides feed the ranking. No ML / no server-side ranking job | Feed ranking (cross-cutting) |
| 2026-10-08 | Phase 4 (tech) | Every list renders posts from one cached card per post (`post_cards` → `['feed','card',id]`), so likes / saves / reposts update everywhere at once | |
| 2026-10-08 | Phase 4 (tech) | Comments open as a transparent full-window route that draws its own bottom sheet (`ScreenSheet`; native form sheets mis-placed the header and keyboard on iOS); share / options / collection sheets are one provider in the root layout; pinch-to-zoom renders in a root-level overlay | |
| 2026-10-08 | Phase 4 (tech) | Reports are stored only (`reports`, one per person per target, reported posts hidden for the reporter); no moderation UI or auto-actions yet | Moderation (cross-cutting) |
| 2026-10-08 | Phase 4 (tech) | Until Phases 5/8/9/11: stories tray shows only "Your story"; Home ♡ / Direct, share "Send to friends" / "Add to story", and Mute / Restrict / Block follow-ups show "coming soon" | Tracked in Prerequisite stubs |

## Per-page decisions
_Format: `| date | Page NNN – name | Full clone / Changes: … | spec link |`_

| Date | Page | Decision | Spec |
|---|---|---|---|
| 2026-10-05 | Page 004 | Changes: Email only: drop the mobile-number path and the "Sign up with mobile number" toggle (no SMS provider). Phone may be added later. | [spec](pages/004-signup-contact.md) |
| 2026-10-05 | Page 005 | Changes: Email code only (no SMS autofill path). | [spec](pages/005-signup-code.md) |
| 2026-10-05 | Page 010 | Changes: Full clone, minus "Import from Facebook". "Share as a post" toggle ships disabled until Phase 3 provides `posts`. | [spec](pages/010-signup-profile-photo.md) |
| 2026-10-05 | Page 011 | Full clone: Contact sync + follow suggestions + Follow buttons. With email-only accounts, contacts are matched on hashed **emails** only. Adds a minimal `follows` stub (owned by Phase 2). | [spec](pages/011-signup-find-people.md) |
| 2026-10-05 | Page 012 | Changes: Recovery by username or email only (no SMS method). | [spec](pages/012-forgot-password.md) |
| 2026-10-05 | Page 014 | Deferred: Skip 2FA for now; revisit together with Settings → Password and security in Phase 11. Login does not branch to a 2FA screen yet. | [spec](pages/014-two-factor-code.md) |
| 2026-10-07 | Page 001 | Full clone: Drop the "from ∞ Meta" wordmark; splash shows only the app glyph. | [spec](pages/001-splash.md) |
| 2026-10-07 | Page 002 | Full clone: Drop profiles from other Meta apps / Google accounts; only accounts saved on this device appear. | [spec](pages/002-welcome.md) |
| 2026-10-07 | Page 003 | Full clone: Drop "Log in with Facebook" and the Meta wordmark; login identifier = username or email (no phone). | [spec](pages/003-login.md) |
| 2026-10-07 | Page 006 | Full clone: As specced (separate password and name steps). | [spec](pages/006-signup-name-password.md) |
| 2026-10-07 | Page 007 | Changes: Block under-13s only. **No teen accounts**: every account gets the same features (no is_teen flag, no teen defaults). | [spec](pages/007-signup-birthday.md) |
| 2026-10-07 | Page 008 | Full clone: As specced. | [spec](pages/008-signup-username.md) |
| 2026-10-07 | Page 009 | Full clone: As specced. | [spec](pages/009-signup-terms.md) |
| 2026-10-07 | Page 013 | Full clone: As specced. | [spec](pages/013-reset-password.md) |
| 2026-10-07 | Page 015 | Full clone: Drop "Go to Accounts Center". | [spec](pages/015-account-switcher.md) |
| 2026-10-07 | Page 012 | Changes (add): unknown account shows "We couldn't find your account", like Instagram | [spec](pages/012-forgot-password.md) |
| 2026-10-08 | Page 016 | Full clone: Current 2026 behavior: 3:4 grid, Grid · Reels · Reposts · Tagged tabs, highlights row above the tabs. A temporary "Private account" toggle lives in Edit profile until page 91 (Phase 11). | [spec](pages/016-own-profile.md) |
| 2026-10-08 | Page 017 | Full clone: As specced. Message, Mute and Restrict are entries that get wired up in Phases 9 and 11. | [spec](pages/017-user-profile.md) |
| 2026-10-08 | Page 018 | Full clone: As specced; privacy enforced by RLS. | [spec](pages/018-private-profile.md) |
| 2026-10-08 | Page 019 | Changes: Minimal fields: Name, Username, Bio (150), Links (≤5), photo, plus the temporary Private toggle. Dropped: pronouns, gender, music, banners, Threads badge, professional account. No 14-day name/username change limits. | [spec](pages/019-edit-profile.md) |
| 2026-10-08 | Page 020 | Changes: Library, Take photo, Remove. No Meta avatar / Facebook import. | [spec](pages/020-change-profile-photo.md) |
| 2026-10-08 | Page 021 | Changes: Simple lists: tabs, search, inline Follow / Follow back / Following, Remove follower. No categories and no sort. | [spec](pages/021-follow-lists.md) |
| 2026-10-08 | Page 022 | Changes: Simple: "Followed by…" line + Mutual tab with search (same simple rows as page 21). | [spec](pages/022-mutual-followers.md) |
| 2026-10-08 | Page 023 | Changes: Clone minus "Account based in" country. Report / Block / Restrict / Hide story are entries wired in Phases 4, 5 and 11. | [spec](pages/023-profile-options.md) |
| 2026-10-08 | Page 024 | Changes: Clone minus Selfie background mode (Color + Emoji only); share, copy link, download, scanner. | [spec](pages/024-qr-code.md) |
| 2026-10-08 | Page 025 | Changes: Highlights tables + profile highlights row (and "New" circle) now; the editor (archive picker, title, cover crop) is built in Phase 5 when stories exist. No stories stub. | [spec](pages/025-highlights-editor.md) |
| 2026-10-08 | Page 026 | Changes: Build now with empty states. No Audio tile (Phase 6) and no collaborative collections (Phase 9). Post FKs added when posts exist (Phase 3); saves come from Phase 4. | [spec](pages/026-saved.md) |
| 2026-10-08 | Page 027 | Changes: Same as page 26: build now; empty until posts/saves exist. | [spec](pages/027-saved-collection.md) |
| 2026-10-08 | Page 028 | Deferred: Not built in Phase 2. Posts archive with Phase 3, stories archive with Phase 5, live archive with Phase 10. | [spec](pages/028-archive.md) |
| 2026-10-08 | Page 029 | Deferred: Not built in Phase 2. Sections land with their phases: interactions (4), posts/recently deleted (3), searches (7), time spent (11, page 103). | [spec](pages/029-your-activity.md) |
| 2026-10-08 | Page 030 | Full clone: As specced. | [spec](pages/030-close-friends.md) |
| 2026-10-08 | Page 031 | Full clone: As specced (max 50, only accounts you follow). | [spec](pages/031-favorites.md) |
| 2026-10-08 | Page 032 | Changes: System photo picker only (OS picker, multi-select up to 20, ordered); no custom in-app gallery / album menu. The Create screen offers Library · Camera · Drafts. The POST/STORY/REEL/LIVE mode switcher waits for Phases 5/6/10. | [spec](pages/032-create-entry.md) |
| 2026-10-08 | Page 033 | Full clone: As specced: tap = photo, hold = video (≤60 s), flip (button + double-tap), flash off/on/auto, pinch zoom, tap to focus. | [spec](pages/033-camera.md) |
| 2026-10-08 | Page 034 | Full clone: Up to 20 photos **and videos** (≤60 s, uploaded as recorded + thumbnail, no server transcoding). Ratio from the first item (1:1 or original clamped 3:4…1.91:1), pinch/pan crop for photos; videos are center-cropped on display. | [spec](pages/034-multi-select-crop.md) |
| 2026-10-08 | Page 035 | Changes: **No filters and no adjust tools.** The edit step keeps crop, the ratio toggle and the carousel strip (switch / reorder / remove). | [spec](pages/035-filters-edit.md) |
| 2026-10-08 | Page 036 | Changes: Keep caption (2,200, ≤30 hashtags, ≤20 mentions) with @/# autocomplete, Tag people, **Collaborators** (≤5, accept/decline), **Audience** (Everyone / Close Friends), Music (page 39), Advanced: hide like/view counts, turn off commenting, alt text per slide. **Dropped:** Facebook/Threads sharing, location (page 38 dropped). | [spec](pages/036-new-post-details.md) |
| 2026-10-08 | Page 037 | Full clone: As specced: positioned tags per slide, ≤20, list for video slides, self-untag. | [spec](pages/037-tag-people.md) |
| 2026-10-08 | Page 038 | Dropped: No locations on posts for now (no place data source). Revisit with the Place page (69, Phase 7). | [spec](pages/038-location-search.md) |
| 2026-10-08 | Page 039 | Changes: Royalty-free seed catalog in a public `audio` bucket with the full picker (search, For you / Saved, preview, clip start). Tracks are **generated placeholder loops** (synthesized by a script, no downloads); real CC0 tracks can replace them later. | [spec](pages/039-music-picker.md) |
| 2026-10-08 | Page 040 | Full clone: As specced, including the persisted queue that resumes after an app restart, auto-retry when back online, Retry / Discard / Save draft on failure. | [spec](pages/040-upload-progress.md) |
| 2026-10-08 | Page 041 | Changes: Edit caption, tags, alt text; delete and reorder carousel slides; Hide like count; Turn off commenting; **Archive + posts archive** (posts part of page 28); **Pin to profile** (≤3). **No Recently deleted**: Delete is immediate. A minimal own-post viewer stub (page 44) opens from grid tiles. | [spec](pages/041-edit-post.md) |
| 2026-10-08 | Page 042 | Full clone: Device-only drafts like Instagram (per account, media copied into app storage): Save draft? on exit, Drafts row in Create, Manage → discard. | [spec](pages/042-drafts.md) |
| 2026-10-08 | Page 043 – Home Feed | Full clone: Ranked Home (recency + Favorites boost + seen posts lower), "You're all caught up", then Suggested posts with inline Follow / ✕. Wordmark ▾ → Following / Favorites (page 51). Stories tray shows only your own "Your story" circle until Phase 5. ♡ (Activity) and Direct icons are stubs until Phases 8 / 9. | [spec](pages/043-home-feed.md) |
| 2026-10-08 | Page 044 – Post detail | Full clone: As specced: grid opens a scroller of that profile's posts starting at the tapped one; single post + "More posts from…" for links. | [spec](pages/044-post-detail.md) |
| 2026-10-08 | Page 045 – Carousel / zoom | Full clone: As specced: pinch-to-zoom overlay, double-tap like, tags, video sound toggle. | [spec](pages/045-carousel-zoom.md) |
| 2026-10-08 | Page 046 – Comments | Changes: Full comments sheet minus **GIF comments** (no Giphy key) and minus "See translation": one-level replies, comment likes + likers list, Author / liked-by-author badges, pin ≤3, hide / delete (post author), delete own, report, emoji quick bar, @/# autocomplete. | [spec](pages/046-comments.md) |
| 2026-10-08 | Page 047 – Likes list | Full clone: As specced (search, inline follow, people you follow first, hidden like counts respected). | [spec](pages/047-likes-list.md) |
| 2026-10-08 | Page 048 – Share sheet | Changes: Build now: **Repost / Undo repost** (optional note; profile Reposts tab; "<user> reposted" in feeds; public posts only), Copy link, Share to… (OS sheet). Send to DMs grid and Add to story appear as "coming soon" entries, wired in Phases 9 / 5. No external-app shortcuts. | [spec](pages/048-share-sheet.md) |
| 2026-10-08 | Page 049 – Post options | Full clone: As specced. Mute / Snooze follow-ups show as "coming soon" (mutes owned by Phase 11). | [spec](pages/049-post-options.md) |
| 2026-10-08 | Page 050 – Report flow | Full clone: 9 reasons → sub-reasons → submit → thanks screen with Unfollow; Block / Restrict / Mute entries "coming in Phase 11". Reports stored in `reports`; no moderator dashboard. | [spec](pages/050-report-flow.md) |
| 2026-10-08 | Page 051 – Following / Favorites feeds | Full clone: As specced: chronological Following and Favorites feeds, no suggestions. | [spec](pages/051-following-favorites-feeds.md) |
