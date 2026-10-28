import { buildRequestBody } from './places-client.js';

const PAGE_SIZE = 20;

/** One query per (city, locality, category), in a stable order. */
export function listQueries(config, cityIds) {
  const queries = [];
  for (const id of cityIds) {
    const city = config.cities[id];
    for (const locality of city.localities) {
      for (const category of config.categories) queries.push({ city, locality, category });
    }
  }
  return queries;
}

const jobFor = (q, page) => ({ city: q.city.id, locality: q.locality.id, category: q.category.id, page });

// A next page only exists if this one was full and Google handed back a token.
const wantsNextPage = (response) => Boolean(response?.nextPageToken) && (response.places?.length ?? 0) >= PAGE_SIZE;

/**
 * Worst-case number of calls still needed. Finished pages cost nothing, and a finished page 1
 * with fewer than 20 results (or no token) rules out page 2. Unfinished queries count every page.
 */
export function planSweep(queries, pages, checkpoint, { fresh = false } = {}) {
  let calls = 0;
  let queriesDone = 0;
  for (const q of queries) {
    let complete = true;
    for (let page = 1; page <= pages; page++) {
      const job = jobFor(q, page);
      if (!fresh && checkpoint.isDone(job)) {
        if (!wantsNextPage(checkpoint.loadRaw(job))) break;
        continue;
      }
      calls += pages - page + 1;
      complete = false;
      break;
    }
    if (complete) queriesDone++;
  }
  return { calls, queriesDone, queriesTotal: queries.length };
}

/**
 * Runs the sweep. Finished jobs are read from disk, never re-requested. Each response is saved
 * before the next call, so a crash or Ctrl+C loses at most the one request that was in flight.
 * Errors (including QuotaExceededError) propagate and stop the sweep; rerun to resume.
 */
export async function runSweep({ queries, pages, client, checkpoint, log = () => {} }) {
  const stats = { calls: 0, reused: 0 };
  for (const [index, q] of queries.entries()) {
    let token;
    for (let page = 1; page <= pages; page++) {
      const job = jobFor(q, page);
      let response;
      let called = false;
      if (checkpoint.isDone(job)) {
        response = checkpoint.loadRaw(job);
        stats.reused++;
      } else {
        response = await client.searchText(buildRequestBody({ ...q, pageToken: token }));
        checkpoint.saveRaw(job, response);
        checkpoint.markDone(job, { places: response.places?.length ?? 0 });
        stats.calls++;
        called = true;
      }
      log({ index, total: queries.length, job, called, places: response.places?.length ?? 0 });
      if (!wantsNextPage(response)) break;
      token = response.nextPageToken;
    }
  }
  return stats;
}
