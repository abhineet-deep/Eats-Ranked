// LIVE: makes exactly ONE Google call (HSR Layout x cafe x page 1) and spends 1 of the monthly quota.
// Run only via `npm run smoke`, and only when you mean it.
import path from 'node:path';
import dotenv from 'dotenv';
import { ROOT, loadConfig } from '../lib/config.js';
import { createCheckpoint } from '../lib/checkpoint.js';
import { buildRequestBody, createPlacesClient } from '../lib/places-client.js';
import { createQuotaGuard } from '../lib/quota-guard.js';

dotenv.config({ path: path.join(ROOT, '.env') });
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey || apiKey === 'your_key_here') {
  console.error('GOOGLE_PLACES_API_KEY is not set in .env (see .env.example). No call was made.');
  process.exit(1);
}

const config = loadConfig();
const city = config.cities.blr;
const locality = city.localities.find((l) => l.id === 'hsr-layout');
const category = config.categories.find((c) => c.id === 'cafe');
const job = { city: city.id, locality: locality.id, category: category.id, page: 1 };

const guard = createQuotaGuard({ limit: config.budget.monthlyHardStop });
const checkpoint = createCheckpoint();

if (checkpoint.isDone(job)) {
  console.error(`${checkpoint.rawPath(job)} already exists, so this exact query was already run. No call was made.`);
  process.exit(1);
}

// maxRetries 0: "exactly one call" means exactly one, even on a 429 or 5xx.
const client = createPlacesClient({ apiKey, guard, maxRetries: 0 });
const response = await client.searchText(buildRequestBody({ city, locality, category }));

// Keep the result so the full sweep doesn't repeat this query.
checkpoint.saveRaw(job, response);
checkpoint.markDone(job, { places: response.places?.length ?? 0, via: 'smoke' });

const places = response.places ?? [];
console.log(`HSR Layout x cafe x page 1: ${places.length} places${response.nextPageToken ? ' (more on page 2)' : ''}`);
for (const p of places) {
  console.log(`  ${(p.displayName?.text ?? '?').padEnd(40)} ${p.rating ?? '-'}★  ${p.userRatingCount ?? 0} reviews`);
}
console.log(`\nLedger: ${guard.used()}/${guard.limit} calls used this month.`);
console.log(`Saved to ${checkpoint.rawPath(job)} (the full sweep will reuse it).`);
