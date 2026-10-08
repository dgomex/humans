# Page 024 — QR code / Nametag page

- **Phase:** 2 — Profile
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/profile/qr.tsx` (full-screen modal)
- **Depends on:** profile deep links (`/<username>`), camera permission for scanning

## 1. Research (current Instagram behavior)
### Layout
- Full-screen colored/gradient background; a white card with the **QR code** (Instagram-style rounded dots with the glyph in the middle) and **@username** below in the background color.
- Top: ✕ close and a mode pill: **COLOR** / **EMOJI** / **SELFIE** (tap the background to cycle colors; emoji picker; selfie with front camera).
- Bottom actions: **Share profile** · **Copy link** · **Download** (saves an image).
- "Scan QR code" (opens the camera scanner).

### Features & interactions
- [ ] Tap background to cycle gradient colors.
- [ ] Emoji mode: pick an emoji to tile as background.
- [ ] Selfie mode: front camera capture with stickers.
- [ ] Share (OS share sheet with image + link), Copy link, Download to gallery.
- [ ] Scanner: camera; recognized profile URL → open profile.

### States
- Camera/photos permission denied.

### Sources
- [Instagram QR code (How-To Geek)](https://www.howtogeek.com/780831/how-to-get-your-instagram-qr-code/)
- [Customizing the QR code (Minter)](https://minter.io/blog/how-to-create-and-customise-your-own-unique-instagram-qr-code/)
- [Account-type limits (Replug)](https://blog.replug.io/instagram-qr-code)

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Clone minus Selfie background mode (Color + Emoji only); share, copy link, download, scanner.
- **Date:** 2026-10-08

## 3. Data & storage
- None server-side (style kept on device). Needs `react-native-qrcode-svg` (or similar), `expo-camera` (scanner), `expo-media-library` (download), `react-native-view-shot` (image capture).

## 4. Implementation notes
- `app/qr/index.tsx` (COLOR gradients / EMOJI wallpaper, share, copy, download via `saveQrImage` — native only, web shows a hint), `app/qr/scan.tsx` (expo-camera scanner → profile). Links use `PUBLIC_WEB_ORIGIN` (`https://humans.app`, placeholder until a domain exists).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [x] Light + dark mode (web)
- [ ] RLS tested with two users (n/a)
- [ ] Supabase advisors clean (n/a)
