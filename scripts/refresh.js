// Sweep Google Places and rebuild rankings.json.
//   node scripts/refresh.js --dry-run [--city blr|ggn|all] [--fresh]   (no network, no key needed)
//   node scripts/refresh.js --city blr [--fresh]                       (LIVE: spends API quota)
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ROOT, loadConfig, validateConfig } from '../lib/config.js';
import { buildRankings, mergeRankings } from '../lib/build-output.js';
import { atomicWriteJson } from '../lib/fs-utils.js';
import { createCheckpoint } from '../lib/checkpoint.js';
import { createPlacesClient, PlacesApiError } from '../lib/places-client.js';
import { createQuotaGuard, QuotaExceededError, monthKey } from '../lib/quota-guard.js';
import { listQueries, planSweep, runSweep } from '../lib/sweep.js';
import { formatSummary } from '../lib/summary.js';

const OUT = path.join(ROOT, 'web', 'public', 'data', 'rankings.json');

function parseArgs(argv) {
  const opts = { city: 'all', dryRun: false, fresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--fresh') opts.fresh = true;
    else if (a === '--city') opts.city = argv[++i];
    else if (a.startsWith('--city=')) opts.city = a.slice(7);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (err) {
  fail(`${err.message}\nUsage: node scripts/refresh.js [--city blr|ggn|all] [--dry-run] [--fresh]`);
}

const config = loadConfig();
const { errors } = validateConfig(config);
if (errors.length) fail(`Config invalid, refusing to run:\n  ${errors.join('\n  ')}\nRun npm run validate-config.`);

const allIds = Object.keys(config.cities);
const cityIds = opts.city === 'all' ? allIds : [opts.city];
if (cityIds.some((id) => !allIds.includes(id))) fail(`Unknown city "${opts.city}". Use ${allIds.join(', ')} or all.`);

const guard = createQuotaGuard({ limit: config.budget.monthlyHardStop });
const checkpoint = createCheckpoint();
const pages = config.pagesPerQuery;
const queries = listQueries(config, cityIds);

let plan;
let used;
try {
  plan = planSweep(queries, pages, checkpoint, { fresh: opts.fresh });
  used = guard.used();
} catch (err) {
  fail(err.message);
}
const remaining = guard.remaining();

console.log(`${opts.dryRun ? 'DRY RUN (no network)' : 'LIVE SWEEP'}: ${cityIds.map((id) => config.cities[id].name).join(' + ')}${opts.fresh ? ' [fresh]' : ''}`);
console.log(`  queries: ${plan.queriesTotal} (${plan.queriesDone} already complete)`);
console.log(`  planned calls (worst case, assumes every unfinished query needs page 2): ${plan.calls}`);
console.log(`  calls used in ${monthKey()}: ${used}   remaining before the ${guard.limit} hard stop: ${remaining}`);

if (plan.calls > remaining) {
  fail(`ABORTED: the plan needs up to ${plan.calls} calls but only ${remaining} remain this month. Nothing was sent.`);
}

if (opts.dryRun) {
  console.log('\nPlanned jobs:');
  for (const q of queries) {
    const done = !opts.fresh && checkpoint.isDone({ city: q.city.id, locality: q.locality.id, category: q.category.id, page: 1 });
    console.log(`  ${done ? 'done' : 'todo'}  ${q.city.id}/${q.locality.id}/${q.category.id}`);
  }
  console.log('\nDry run only: no network calls were made and nothing was written.');
  process.exit(0);
}

dotenv.config({ path: path.join(ROOT, '.env') });
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey || apiKey === 'your_key_here') fail('GOOGLE_PLACES_API_KEY is not set in .env (see .env.example).');

if (opts.fresh) {
  console.log(`--fresh: deleting saved raw responses for ${cityIds.join(', ')} and starting over.`);
  checkpoint.reset(cityIds);
}

const client = createPlacesClient({ apiKey, guard });
const started = Date.now();
let stats;
try {
  stats = await runSweep({
    queries,
    pages,
    client,
    checkpoint,
    log: ({ index, total, job, called, places }) =>
      console.log(
        `[${String(index + 1).padStart(3)}/${total}] ${job.city}/${job.locality}/${job.category} p${job.page}: ` +
          `${places} places ${called ? `(call ${guard.used()}/${guard.limit} this month)` : '(reused saved result)'}`,
      ),
  });
} catch (err) {
  if (err instanceof QuotaExceededError) {
    fail(`\nSTOPPED: ${err.message}\nProgress is saved. Rerun after the month rolls over to resume.`, 2);
  }
  if (err instanceof PlacesApiError) {
    fail(`\nSTOPPED: ${err.message}\nProgress is saved. Fix the problem and rerun the same command to resume.`);
  }
  throw err;
}

const groups = checkpoint.listGroups(cityIds);
const finishedAt = new Date().toISOString();
const usage = { month: monthKey(), callsUsed: guard.used(), monthlyFree: config.budget.monthlyFree, lastSweepAt: finishedAt };
const { rankings: fresh, stats: cleanStats } = buildRankings(groups, config, { cityIds, generatedAt: finishedAt, usage });
let existing = null;
try {
  existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
} catch {
  /* first run or unreadable file: start clean */
}
atomicWriteJson(OUT, mergeRankings(existing, fresh, allIds));

console.log(
  formatSummary({
    config,
    cityIds,
    sweep: stats,
    cleanStats,
    used: usage.callsUsed,
    limit: guard.limit,
    free: config.budget.monthlyFree,
    elapsedMs: Date.now() - started,
  }),
);
console.log(`\nWrote ${OUT}`);
