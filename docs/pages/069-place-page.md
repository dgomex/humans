# Page 069 — Location / Place page

- **Phase:** 7 — Search & Explore
- **Status:** Dropped (2026-10-12)
- **Route:** `app/(tabs)/(home,explore,reels,profile)/places/[id].tsx` (if built)
- **Depends on:** **no place data exists**. Page 38 (location on posts) was dropped on 2026-10-08: "no place data source. Revisit with the Place page (69)".

## 1. Research (current Instagram behavior)
### Layout
- **Header:** ‹ back · place name · ⋯ / share.
- **Top:** a small **map** with a pin, the place name, category (Restaurant, Park…), address, "N posts", and Directions / Call / Website for businesses. Sometimes "Related places".
- **Tabs:** Top · Recent (· Reels in some builds). Stories tagged at the place show as a ring on the map thumbnail.
- **Grid:** 3 columns of public posts tagged at the place.
- Search → Places tab → **Map view**: pan or zoom, "Search this area", and category filters (Restaurants, Cafés, Parks…).

### Entry & exit points
- Location line under a post's username, story location sticker, search Places (66), recent searches (67).
- Tile → post scroller (70) of the place.

### Features & interactions
- [ ] Place catalog (Instagram uses Facebook Places).
- [ ] Tag a location on posts / reels (page 38) and stories (location sticker, dropped in 54).
- [ ] Place page with Top / Recent grids and a map.
- [ ] Map explore with nearby places (device location + maps SDK).

### States
- Loading / empty "No posts yet" / error. Unknown place → "This location isn't available".

### Data source options (for the decision)
1. **Drop the page** for now (consistent with page 38). The Places tab in search is hidden.
2. **OpenStreetMap geocoding (Photon / Nominatim)** via an Edge Function proxy (cache + rate limit, no API key). Real places with coordinates and a static OSM map. Re-adds page 38 location tagging on posts and reels.
3. **User-created places:** a `places` table of names people type (no coordinates or map). Re-adds page 38.
4. **Google / Apple Places:** needs a paid API key and accounts.

### Sources
- [Instagram rolls out a searchable map (AOL / TechCrunch)](https://www.aol.com/news/instagram-rolls-searchable-map-easier-170258726.html)
- [How to search Instagram locations (Bustle)](https://www.bustle.com/life/how-to-search-instagram-locations)
- [Instagram location-sharing map, 2025 (Fast Company SA)](https://fastcompany.co.za/fast-company/tech/2025-08-07-instagram-launches-new-location-sharing-map-tool-for-friends-and-family/)
- Instagram app (iOS / Android).

## 2. User decision
- **Choice:** Changes (dropped for now)
- **Changes requested:** Not built: no place data source (same as page 38). No Places tab in search. Revisit when a source is chosen.
- **Date:** 2026-10-12

## 3. Data & storage
- Not built. No `places` table; posts have no location (page 38 dropped).

## 4. Implementation notes
- None. Search has no Places tab. Revisit with a place data source (see options above).

## 5. Acceptance checklist
- [ ] Not built (dropped)
