# Page 038 — Location search / add location

- **Phase:** 3 — Content Creation
- **Status:** Dropped
- **Route:** `app/create/location.tsx`
- **Depends on:** page 36. Place pages (69) are Phase 7.

## 1. Research (current Instagram behavior)
### Layout
- Header: ‹ / ✕ · search field "Find a location".
- With location permission: **nearby places** list (name + address/city + distance) before typing; typing searches places worldwide (Meta's Places DB, Facebook pages).
- Each row: pin icon, place name, secondary line (address or city). Tap → back to details with the location set (removable with ✕).
- On the details screen: quick chips of 3–5 nearby suggestions under "Add location".

### Features & interactions
- [ ] Nearby (GPS) and text search.
- [ ] Remove location.
- [ ] Location shows above the post in the feed and links to the Place page (Phase 7).

### States
- Permission denied: search still works, no nearby list.
- No results: "No results found".
- Offline: error row with retry.

### Sources
- [Edit post: location (Tailwind)](https://www.tailwindapp.com/blog?p=5273)
- [Expo Location docs](https://docs.expo.dev/versions/latest/sdk/location/)

## 2. User decision
- **Choice:** Dropped
- **Changes requested:** No locations on posts for now (no place data source). Revisit with the Place page (69, Phase 7).
- **Date:** 2026-10-08

## 3. Data & storage
- `locations (id, name, address, city, country, lat, lng, provider, provider_id)`; RLS: select authenticated; inserts only via an RPC/Edge Function (dedupe by provider id).
- Place data source to be decided (see section 2).

## 4. Implementation notes
- `expo-location` for coordinates (needs install; it is in Expo Go).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users
- [ ] Supabase advisors clean
