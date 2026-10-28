# Eats Ranked: Bangalore and Gurgaon

A personal site that ranks places to eat and drink in Bangalore and Gurgaon from Google Places ratings. A 4.4★ from 8,000 reviews beats a 4.9★ from 40, because places are ranked by a Bayesian average rather than raw rating.

Views per city: city-wide Top 50, plus Top 15 for each locality, each category (Premium, Cafe, Pub/Bar, Club, Everyday) and each locality × category pair.

The site is static. It only reads `web/public/data/rankings.json`, and opening it **never calls Google**. Google is only called by `npm run refresh` and `npm run smoke`, from your machine.

The full brief and build plan are in [CLAUDE.md](CLAUDE.md).

## How it fits together

```
config/localities.json ─▶ scripts/refresh.js ─▶ quota guard ─▶ Google Text Search
                                                                     │ raw JSON saved to data/raw/
                          web/public/data/rankings.json ◀─ rank ◀─ clean (dedupe, city boundary)
                                      │
                                      ▼
                              React viewer (web/)
```

| Folder | What's in it |
| --- | --- |
| `config/` | Categories and ranking settings, localities (search rectangles), city boundaries |
| `lib/` | Config loading, Google client, quota guard, checkpoint, sweep, cleaning, ranking, output |
| `scripts/` | Command-line entry points |
| `web/` | Vite + React + Tailwind viewer |
| `tests/` | Vitest tests, including the mock fixture |
| `data/` | Local sweep state, git-ignored: `usage.json`, `checkpoint.json`, `raw/` |

## Setup

Requires Node.js 20+.

```
npm install                 # installs the root and web/ dependencies
npm run validate-config     # sanity-check the locality rectangles and see the call budget
npm run build-mock          # write sample data so the UI has something to show
npm run dev                 # http://localhost:5173
```

## Getting a Google API key (step by step)

The app needs a Google Maps Platform key with **Places API (New)** enabled. The free monthly allowance covers a full sweep, but Google requires a billing account on the project, so follow the cost-safety steps too.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example "eats-ranked").
2. Attach a billing account to the project (Billing). Without one, the API refuses requests.
3. Under APIs & Services → Library, search for **Places API (New)** and enable it. It is a different product from the older "Places API".
4. Under APIs & Services → Credentials, choose Create credentials → API key.
5. Open the new key and restrict it:
   - **API restrictions:** Restrict key → select **Places API (New)** only.
   - **Application restrictions:** optional. An IP address restriction to your own IP is a good extra if your IP is stable. Don't use a website restriction, because the script isn't a browser.
6. Cap usage. Under APIs & Services → Places API (New) → Quotas, find the Text Search requests quota and set the **per-day** limit to about 600. Console labels change, so look for the Text Search entry. A full sweep needs at most 550 calls, so this stops runaway usage even if something goes wrong locally.
7. Under Billing → Budgets & alerts, create a budget of about $1 with email alerts. It does not stop spending, but it tells you quickly.
8. Copy `.env.example` to `.env` and put the key in it:
   ```
   GOOGLE_PLACES_API_KEY=your_real_key
   ```
   `.env` is git-ignored. Never paste the key into chat, code or an issue.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Installs root and `web/` dependencies |
| `npm run dev` | Dev server for the viewer |
| `npm run build` | Production build into `web/dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` / `npm run lint` | Vitest and ESLint |
| `npm run validate-config` | Checks every locality rectangle against its city boundary and prints the call budget. Fails over 600 calls |
| `npm run map-preview` | Writes `map-preview.html` (Leaflet + OpenStreetMap) so you can eyeball coverage |
| `npm run build-mock` | Builds `rankings.json` from fake data in `tests/fixtures/` (no API calls) |
| `npm run smoke` | **Live, 1 call.** HSR Layout × cafe × page 1. Prints results and the ledger count |
| `npm run refresh -- --dry-run` | Prints the plan, calls used and remaining. No network, no key needed |
| `npm run refresh -- --city blr` | **Live.** Sweeps Bangalore (`blr`), Gurgaon (`ggn`), or `all` |
| `npm run refresh -- --city blr --fresh` | **Live.** Starts that city's sweep over, deleting its saved raw data |

### Running the full sweep

```
npm run refresh -- --dry-run --city all     # check the plan first
npm run smoke                               # optional: one call to confirm the key works
npm run refresh -- --city blr               # about 350 calls at most (usually fewer)
npm run refresh -- --city ggn               # about 200 calls at most
npm run preview                             # look at the result
```

The sweep prints one line per call. If it stops (Ctrl+C, crash, network error, quota), rerun the same command and it resumes. Finished jobs are read from `data/raw/` and never requested again. At the end it prints a summary: calls made, calls used this month, time taken, and per city the places found, duplicates merged and places dropped by the boundary filter or for having no rating.

Refreshing one city keeps the other city's data in `rankings.json`. A refresh replaces sample data from `build-mock`, and the two are never mixed.

## How ranking works

```
score = v/(v+m) × R + m/(v+m) × C
```

- **R** is the place's Google rating and **v** its review count.
- **C** is the average rating of all ranked places in that city, computed from the data.
- **m** is the trust threshold: how many reviews it takes before a place is mostly judged on its own rating. It is **500** for the city-wide list and **150** for locality, category and locality × category lists. Both are in `config/categories.json`.

With few reviews the score stays near C. With many it approaches R. Ties go to the place with more reviews. The "confidence" bar on each card is v/(v+m).

Cleaning happens before ranking: places are merged by Google place id (remembering every locality and category they were found in), places with no rating or zero reviews are dropped, and so are places outside the city boundary polygon.

## Adding a locality

1. Add an entry to the city in `config/localities.json`:
   ```json
   { "id": "my-area", "name": "My Area",
     "rectangle": { "low": { "latitude": 12.90, "longitude": 77.60 },
                    "high": { "latitude": 12.92, "longitude": 77.62 } } }
   ```
   `low` is the south-west corner and `high` the north-east. Keep it about 1.5 to 3 km per side and avoid heavy overlap with neighbours.
2. `npm run validate-config`. It fails if the rectangle is inverted or falls outside the city boundary, and warns about odd sizes or heavy overlaps.
3. `npm run map-preview` and check it visually.
4. `npm run refresh -- --dry-run --city blr`, then run the sweep. Finished localities are reused, so only the new one costs calls (up to 10: 5 categories × 2 pages).

Each locality costs up to 10 calls per full sweep, so the 600-call limit allows 60 localities across all cities. `validate-config` fails if a full sweep would exceed `budget.maxPlannedSweep` (600) in `config/categories.json`.

## Adding a city

1. Add a boundary polygon at `config/boundaries/<city>.geojson`, a FeatureCollection with one Polygon.
2. Add the city to `config/localities.json` under a short id (the existing ones are `blr` and `ggn`):
   ```json
   "hyd": { "name": "Hyderabad", "boundary": "config/boundaries/hyderabad.geojson", "localities": [ ... ] }
   ```
3. Run `npm run validate-config` and `npm run map-preview`, then `npm run refresh -- --city hyd`.

The viewer builds its city switcher from whatever cities are in `rankings.json`. Check the budget first: a third city on top of the current 550 calls will probably exceed the 600 limit, and the free tier is 1,000 calls a month shared by all sweeps.

## Cost safety

- **Free tier:** Text Search Enterprise (anything requesting `rating` or `userRatingCount`) includes 1,000 calls a month, then costs money.
- **Hard stop at 950:** every call, retries included, is counted in `data/usage.json` before it is sent. At 950 the script throws and sends nothing. If the ledger file is corrupt, all calls stop rather than resetting to zero.
- **Never repeated:** each response is saved to `data/raw/` right after the call, and finished jobs are skipped on rerun. The only call that can repeat is one in flight when the process crashed, and it is already counted.
- **Only cheap fields:** the field mask is exactly the fields listed in `lib/places-client.js` (ten `places.*` fields plus `nextPageToken`). No reviews, photos or editorial summaries, which cost more.
- **Retries:** at most 2 per call, on 429 and 5xx only, and each one counts toward the ledger.
- **Ledger months** are UTC calendar months, while Google bills on Pacific time. The 50-call gap below 1,000 covers the difference.
- **Deleting `data/usage.json`** resets your local count to zero, not Google's. Don't, unless you have checked real usage in Cloud Console. Check it there anyway now and then.
- **The key:** it lives only in `.env`, is never logged, and is scrubbed from error messages. Restrict it to Places API (New) and cap the daily quota as described above.
- **The viewer** makes no Google calls. A static host can serve `web/dist/` with no key anywhere.

## Things to know

- **City boundaries are approximate.** `config/boundaries/bangalore.geojson` and `gurgaon.geojson` are hand-simplified polygons, not survey data. Bangalore's is deliberately generous around Electronic City, which sits outside strict BBMP limits. Use `npm run map-preview` to check them and edit if a locality is wrongly included or cut off.
- **Locality rectangles are approximate too.** They were placed from rough locality centres, so check them in `map-preview` and adjust before spending quota.
- **Google caps Text Search at 60 results per query.** The sweep fetches up to 2 pages (40 places) per locality × category, so very dense areas are only partly covered.
- **Search is by category query and type**, so a place can be found under one category and miss another. A place's price level and categories come from how it was found.
- **Ratings data © Google.** This project is not affiliated with or endorsed by Google.
