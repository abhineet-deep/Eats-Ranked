import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../lib/config.js';
import { createCheckpoint } from '../lib/checkpoint.js';
import { createPlacesClient } from '../lib/places-client.js';
import { createQuotaGuard } from '../lib/quota-guard.js';
import { listQueries, planSweep, runSweep } from '../lib/sweep.js';

let dir;
const make = () =>
  createCheckpoint({ file: path.join(dir, 'checkpoint.json'), rawDir: path.join(dir, 'raw'), now: () => new Date('2026-10-28T00:00:00Z') });
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const job = (over = {}) => ({ city: 'blr', locality: 'hsr-layout', category: 'cafe', page: 1, ...over });

describe('checkpoint', () => {
  it('saves raw responses at data/raw/<city>/<locality>/<category>-p<n>.json and records completion', () => {
    const cp = make();
    expect(cp.isDone(job())).toBe(false);
    cp.saveRaw(job(), { places: [{ id: 'a' }] });
    cp.markDone(job(), { places: 1 });
    expect(fs.existsSync(path.join(dir, 'raw', 'blr', 'hsr-layout', 'cafe-p1.json'))).toBe(true);
    expect(cp.isDone(job())).toBe(true);
    expect(cp.isDone(job({ page: 2 }))).toBe(false);
    expect(cp.loadRaw(job())).toEqual({ places: [{ id: 'a' }] });
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8')).completed['blr/hsr-layout/cafe/p1']).toMatchObject({
      at: '2026-10-28T00:00:00.000Z',
      places: 1,
    });
  });

  it('counts a job as done from the raw file alone (crash before checkpoint.json was updated)', () => {
    const cp = make();
    cp.saveRaw(job(), { places: [] });
    expect(make().isDone(job())).toBe(true);
  });

  it('lists saved groups for given cities', () => {
    const cp = make();
    cp.saveRaw(job(), { places: [{ id: 'a' }] });
    cp.saveRaw(job({ category: 'pub', page: 2 }), { places: [] });
    cp.saveRaw(job({ city: 'ggn', locality: 'sector-29' }), { places: [] });
    const groups = cp.listGroups(['blr']);
    expect(groups.map((g) => `${g.city}/${g.locality}/${g.category}/${g.page}`).sort()).toEqual(['blr/hsr-layout/cafe/1', 'blr/hsr-layout/pub/2']);
    expect(cp.listGroups(['nowhere'])).toEqual([]);
  });

  it('reset (--fresh) clears only the named cities', () => {
    const cp = make();
    for (const city of ['blr', 'ggn']) {
      cp.saveRaw(job({ city }), { places: [] });
      cp.markDone(job({ city }));
    }
    cp.reset(['blr']);
    expect(cp.isDone(job({ city: 'blr' }))).toBe(false);
    expect(cp.isDone(job({ city: 'ggn' }))).toBe(true);
    expect(cp.completedCount()).toBe(1);
  });

  it('refuses a corrupt checkpoint file', () => {
    fs.writeFileSync(path.join(dir, 'checkpoint.json'), '{oops');
    expect(() => make().markDone(job())).toThrow(/unreadable/);
  });
});

// A tiny two-locality, two-category config so sweeps are easy to reason about.
const config = loadConfig();
const small = {
  ...config,
  categories: config.categories.slice(0, 2), // premium, cafe
  cities: { blr: { ...config.cities.blr, localities: config.cities.blr.localities.slice(0, 2) } },
};
const fullPage = (n, token) => ({ places: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })), ...(token ? { nextPageToken: token } : {}) });

function setup(responder) {
  const guard = createQuotaGuard({ file: path.join(dir, 'usage.json') });
  const fetchImpl = vi.fn(async (_url, init) => ({ ok: true, status: 200, json: async () => responder(JSON.parse(init.body)) }));
  const client = createPlacesClient({ apiKey: 'k', guard, fetchImpl });
  return { guard, fetchImpl, client };
}

describe('sweep', () => {
  const queries = listQueries(small, ['blr']);

  it('lists queries as city x locality x category', () => {
    expect(queries).toHaveLength(4);
    expect(listQueries(config, ['blr', 'ggn'])).toHaveLength(55 * 5);
  });

  it('plans the worst case, and skips page 2 when page 1 was short', async () => {
    const cp = make();
    expect(planSweep(queries, 2, cp)).toEqual({ calls: 8, queriesDone: 0, queriesTotal: 4 });
    const { client } = setup(() => fullPage(7)); // short pages: never a page 2
    await runSweep({ queries, pages: 2, client, checkpoint: cp });
    expect(planSweep(queries, 2, cp)).toEqual({ calls: 0, queriesDone: 4, queriesTotal: 4 });
  });

  it('requests page 2 only when page 1 was full and had a token, with the same params plus pageToken', async () => {
    const cp = make();
    const { client, fetchImpl, guard } = setup((body) => (body.pageToken ? fullPage(3) : fullPage(20, 'next')));
    const stats = await runSweep({ queries: queries.slice(0, 1), pages: 2, client, checkpoint: cp });
    expect(stats.calls).toBe(2);
    expect(guard.used()).toBe(2);
    const [b1, b2] = fetchImpl.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(b1.pageToken).toBeUndefined();
    expect(b2.pageToken).toBe('next');
    expect({ ...b2, pageToken: undefined }).toEqual({ ...b1, pageToken: undefined });
  });

  it('a full page with no token also stops at page 1', async () => {
    const { client, fetchImpl } = setup(() => fullPage(20));
    await runSweep({ queries: queries.slice(0, 1), pages: 2, client, checkpoint: make() });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never repeats a call on rerun, and resumes after a crash mid-sweep', async () => {
    const cp = make();
    let n = 0;
    const crashing = setup(() => {
      if (++n === 3) throw new Error('simulated crash');
      return fullPage(5);
    });
    await expect(runSweep({ queries, pages: 2, client: crashing.client, checkpoint: cp })).rejects.toThrow(/simulated crash/);
    expect(crashing.fetchImpl).toHaveBeenCalledTimes(3);

    const resumed = setup(() => fullPage(5));
    const stats = await runSweep({ queries, pages: 2, client: resumed.client, checkpoint: make() });
    expect(stats.reused).toBe(2); // the two finished before the crash
    expect(stats.calls).toBe(2); // only the unfinished two (the crashed query is retried once)
    // a third run does nothing at all
    const again = setup(() => fullPage(5));
    expect((await runSweep({ queries, pages: 2, client: again.client, checkpoint: make() })).calls).toBe(0);
    expect(again.fetchImpl).not.toHaveBeenCalled();
  });

  it('resumes page 2 from the token saved in page 1 raw data', async () => {
    const cp = make();
    cp.saveRaw({ city: 'blr', locality: queries[0].locality.id, category: queries[0].category.id, page: 1 }, fullPage(20, 'saved-token'));
    const { client, fetchImpl } = setup(() => fullPage(2));
    await runSweep({ queries: queries.slice(0, 1), pages: 2, client, checkpoint: cp });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).pageToken).toBe('saved-token');
  });

  it('stops the whole sweep when the quota runs out, with progress saved', async () => {
    const cp = make();
    const guard = createQuotaGuard({ file: path.join(dir, 'usage.json'), limit: 2 });
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => fullPage(1) }));
    const client = createPlacesClient({ apiKey: 'k', guard, fetchImpl });
    await expect(runSweep({ queries, pages: 2, client, checkpoint: cp })).rejects.toThrow(/limit reached/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(cp.listGroups(['blr'])).toHaveLength(2);
  });

  it('fresh planning ignores saved results', () => {
    const cp = make();
    cp.saveRaw({ city: 'blr', locality: queries[0].locality.id, category: queries[0].category.id, page: 1 }, fullPage(3));
    expect(planSweep(queries, 2, cp).calls).toBe(6);
    expect(planSweep(queries, 2, cp, { fresh: true }).calls).toBe(8);
  });
});
