I'm building a personal web app that ranks eat/drink places in Bangalore and Gurgaon using Google Places ratings. Below is the full brief and a 5-phase build plan.

HOW WE WORK
- First, save this ENTIRE message (brief + all 5 phases) as CLAUDE.md in the repo root so it persists across sessions.
- Then build ONLY Phase 1. At the end of each phase: run tests/lint, give me a short checklist of exactly what to run and look at to verify it, then STOP and wait.
- Move to the next phase only when I say "next phase" (or name a phase). If I ask for changes, make them within the current phase first.
- If Google API details here conflict with the current official docs (developers.google.com/maps/documentation/places/web-service), tell me before deviating.

======================================================================
PROJECT BRIEF
======================================================================

GOAL
- Rank places by a Bayesian average so that a high rating with MANY reviews beats a high rating with few reviews:
  score = (v/(v+m))*R + (m/(v+m))*C
  R = place rating, v = userRatingCount, C = mean rating of all places in that city (computed from data), m = trust threshold.
  m = 500 for the city-wide list, m = 150 for locality and category lists. Keep these in config.
- Views per city: city-wide Top 50; Top 15 per locality (e.g. HSR Layout, AECS Layout); Top 15 per category (Premium restaurant, Cafe, Pub/Bar, Club, Everyday eatery); and locality × category combinations (Top 15).
- Only places inside city limits.

ZERO-COST CONSTRAINT (critical)
- Uses Google Places API (New) Text Search. Requesting rating/userRatingCount puts calls in the Text Search Enterprise SKU: 1,000 free calls/month, then paid. Never exceed this.
- A full sweep is about 550 calls: Bangalore ~35 localities × 5 categories × 2 pages, Gurgaon ~20 × 5 × 2.
- A local monthly call ledger must hard-stop at 950 calls per calendar month.
- The sweep must be resumable via a checkpoint file, so no call is ever repeated after a crash.
- Request ONLY these fields: places.id, places.displayName, places.rating, places.userRatingCount, places.priceLevel, places.types, places.primaryType, places.location, places.formattedAddress, places.googleMapsUri, nextPageToken. Never request reviews, photos, or editorial summaries (pricier SKUs).

ARCHITECTURE
config/localities.json → scripts/refresh.js (sweep) → quota guard → Google Text Search → clean (dedupe by place id, point-in-polygon city boundary filter) → Bayesian ranker → web/public/data/rankings.json → React viewer.
The viewer only reads the JSON file. Opening the site must never call Google.

STACK
- Node.js 20+, ES modules. Sweep scripts in plain Node (native fetch). @turf/turf for geo checks. dotenv for the key.
- Frontend: Vite + React + Tailwind CSS. Static build, no backend.
- Tests: Vitest.

SECURITY RULES FOR YOU (Claude Code)
- The API key lives in .env as GOOGLE_PLACES_API_KEY. Never read, print, or log .env or the key. Never ask me to paste it.
- Never run any script that calls the real Google API unless I explicitly say "run the smoke test" or "run the sweep" in that message.
- .env, data/raw/, data/usage.json and data/checkpoint.json must be in .gitignore.

======================================================================
PHASE 1: SCAFFOLD AND CITY CONFIG
======================================================================
1. Scaffold the repo: Vite + React + Tailwind in /web, scripts in /scripts, shared logic in /lib, config in /config, tests in /tests. Root package.json with npm scripts: dev, build, preview, test, lint, refresh, smoke, map-preview, validate-config, build-mock.
2. Create .env.example (GOOGLE_PLACES_API_KEY=your_key_here) and .gitignore per the brief. Create .claude/settings.json with permissions.deny for Read(./.env) and Read(./.env.*).
3. Create config/categories.json with 5 categories, each with: id, label, textQuery, includedType, optional priceLevels, minRating 3.5. Starting mapping:
   - premium: textQuery "fine dining restaurant", includedType "restaurant", priceLevels [PRICE_LEVEL_EXPENSIVE, PRICE_LEVEL_VERY_EXPENSIVE]
   - cafe: textQuery "cafe", includedType "cafe"
   - pub: textQuery "pub and bar", includedType "bar"
   - club: textQuery "night club", includedType "night_club"
   - eatery: textQuery "restaurant", includedType "restaurant", priceLevels [PRICE_LEVEL_INEXPENSIVE, PRICE_LEVEL_MODERATE]
   Also store m values (cityTop: 500, lists: 150) and list sizes (cityTop: 50, lists: 15).
4. Create config/localities.json:
   - Bangalore (~35): HSR Layout, AECS Layout, Koramangala, Indiranagar, Whitefield, Marathahalli, Bellandur, Sarjapur Road, BTM Layout, Jayanagar, JP Nagar, Banashankari, Basavanagudi, MG Road/Brigade Road, Church Street, Lavelle Road/UB City, Malleshwaram, Rajajinagar, Yeshwanthpur, Hebbal, RT Nagar, Frazer Town, Ulsoor, Domlur, HAL/Old Airport Road, CV Raman Nagar, KR Puram, Electronic City, Bannerghatta Road, Kalyan Nagar, Kammanahalli, Yelahanka, Sadashivanagar, Vijayanagar, Sahakar Nagar.
   - Gurgaon (~20): Cyber Hub/DLF Cyber City, Golf Course Road, Sector 29, MG Road, Udyog Vihar, DLF Phase 1, DLF Phase 2, DLF Phase 3, DLF Phase 4, DLF Phase 5, Sohna Road, Golf Course Extension Road, Sushant Lok, South City, Sector 14, Sector 56–57, Nirvana Country, Palam Vihar, Sector 43, Sector 82–84.
   Each locality: id (slug), name, rectangle {low:{latitude,longitude}, high:{latitude,longitude}}. Keep rectangles tight (roughly 1.5–3 km per side) and avoid big overlaps.
5. Create config/boundaries/bangalore.geojson and gurgaon.geojson: simplified polygons approximating BBMP limits and Gurugram municipal limits. Note in the README that they are approximate.
6. scripts/validate-config.js: checks every rectangle is valid and inside its city boundary, and prints the call budget (localities × categories × 2 pages per city and total). Must report ~550 total and fail if total > 600.
7. scripts/map-preview.js: generates map-preview.html, a Leaflet map (OpenStreetMap tiles) showing each city boundary and every locality rectangle labeled, so I can visually check coverage.

======================================================================
PHASE 2: RANKING ENGINE WITH MOCK DATA (no API calls)
======================================================================
1. tests/fixtures/mock-places.json: ~300 realistic fake places across both cities and all categories, in the exact Places API (New) response shape (id, displayName.text, rating, userRatingCount, priceLevel, types, primaryType, location, formattedAddress, googleMapsUri), grouped as if returned per (city, locality, category). Include edge cases: 4.9 with 12 reviews, 4.3 with 15,000 reviews, duplicates appearing in two localities, places just outside the city boundary, missing rating, missing priceLevel.
2. lib/clean.js: dedupe by place id (keep all localities and categories a place was found in), drop places with no rating or 0 reviews, drop places outside the city boundary polygon (turf booleanPointInPolygon).
3. lib/rank.js: compute C per city; Bayesian score per place; build:
   - cityTop: top 50 (m = 500)
   - byLocality[localityId]: top 15 (m = 150)
   - byCategory[categoryId]: top 15 (m = 150)
   - byLocalityCategory[localityId][categoryId]: top 15 (m = 150)
   Ties broken by userRatingCount.
4. lib/build-output.js: assembles rankings.json with generatedAt, per-city meta (name, C, place count, m values, localities and categories lists for the UI), and all lists. Each list entry: rank, id, name, rating, reviews, score (2 decimals), priceLevel, categories, localities, address, mapsUrl.
5. scripts/build-mock.js: runs the pipeline on fixtures and writes web/public/data/rankings.json so the UI can be built against it.
6. Vitest tests: formula math (4.9/40 vs 4.4/8000 with C=4.1, m=500: the second must win), dedupe, boundary filter, list sizes, tie-breaking.

======================================================================
PHASE 3: UI (against mock rankings.json)
======================================================================
It must look polished and modern, like a real product.

DESIGN
- Clean, editorial food-guide feel. Warm neutral background, one accent colour (deep saffron/terracotta), generous whitespace, a good Google Fonts pair (serif display font for headings + Inter for body).
- Full dark mode (follows system, with a toggle). Fully responsive, mobile-first; I'll mostly use it on my phone.
- Subtle motion only (fade/slide on list change); respect prefers-reduced-motion.

LAYOUT
- Header: app name, city switcher (Bangalore / Gurgaon) as a segmented control, theme toggle.
- Hero strip: "Top 50 in Bangalore" with city stats (places ranked, city average rating, last updated "x days ago").
- Filters bar: Locality dropdown (searchable, "All areas" default) + Category chips (All, Premium, Cafe, Pub/Bar, Club, Everyday). Selecting both shows the locality × category list. Title reads "Top 50" when unfiltered, otherwise "Top 15".
- Search box to filter the current list by name.
- Ranked list as cards: big rank number (top 3 highlighted), name, category badge, locality, ★ rating, formatted review count (12.4k reviews), a small "confidence" bar driven by review count, price level as ₹ symbols, and an "Open in Google Maps" link.
- Tap a card to expand: address and a one-line score explanation ("4.4★ from 8,000 reviews → score 4.38").
- "How ranking works" modal explaining the formula in plain English.
- Footer: Google attribution ("Ratings data © Google") and data freshness date.
- Empty and error states (no results; rankings.json missing → friendly message telling me to run npm run refresh).
- Sync filters to the URL query string so I can bookmark e.g. ?city=blr&area=hsr-layout&cat=cafe.
Keep components small (web/src/components/). No backend, no API calls; read /data/rankings.json only.

======================================================================
PHASE 4: GOOGLE CLIENT + QUOTA GUARD
======================================================================
Build it, but DO NOT run any live call until I say "run the smoke test".
1. lib/places-client.js: POST https://places.googleapis.com/v1/places:searchText with headers X-Goog-Api-Key (from process.env via dotenv) and X-Goog-FieldMask (exact fields from the brief). Body: textQuery "<category textQuery> in <locality name>, <city>", includedType, strictTypeFiltering true, locationRestriction.rectangle, minRating, priceLevels when set, pageSize 20, pageToken for page 2. Retry with backoff on 429/5xx (max 2 retries; each retry counts toward the ledger). Never log the key or full headers.
2. lib/quota-guard.js: ledger in data/usage.json keyed by YYYY-MM. Before every call: if this month's count + 1 > 950, throw QuotaExceededError. Increment and persist after every call (including failed ones that reached Google).
3. lib/checkpoint.js: data/checkpoint.json records completed (city, locality, category, page) jobs; raw results saved to data/raw/<city>/<locality>/<category>-p<n>.json. Skip completed jobs on rerun. --fresh starts a new sweep.
4. scripts/refresh.js:
   - Flags: --city blr|ggn|all, --dry-run (prints planned jobs and call count, no network), --fresh.
   - Before starting: print planned calls, calls used this month, calls remaining; abort if the plan exceeds remaining.
   - Skip page 2 if page 1 returned fewer than 20 results or no nextPageToken.
   - Progress output per job. On finish: clean → rank → write web/public/data/rankings.json (merge with the existing file so refreshing one city keeps the other).
5. scripts/smoke.js: exactly ONE call: HSR Layout × cafe × page 1. Prints place names, ratings, review counts, and the ledger count after.
6. Unit tests for quota guard and checkpoint using a mocked fetch.
At the end, give me the exact steps to add my key to .env (I'll do it myself), the Google Cloud setup steps (enable Places API (New), restrict key to that API, set Text Search daily quota to ~600), and the dry-run command to run first.

======================================================================
PHASE 5: POLISH AND FULL SWEEP READINESS
======================================================================
I will run the full sweep myself.
1. Refresh summary at the end of refresh.js: calls used, places found per city, places dropped by boundary filter, dupes merged, time taken.
2. Add usage info to rankings.json meta (calls used this month, last sweep date) and show a small "API budget: 560/1000 used this month" indicator in the UI footer.
3. Handle partial data in the UI: if a list has fewer than 15 places, show what exists with a small note.
4. README.md: setup, getting a Google key with restrictions and quotas (step by step), all commands, how to add a locality or a new city, how ranking works, cost safety notes.
5. Final pass: lint, tests, production build (npm run build), confirm npm run preview works.
Then tell me the exact commands to run the full sweep per city and what output to expect.
