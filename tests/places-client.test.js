import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../lib/config.js';
import { ENDPOINT, FIELD_MASK, PlacesApiError, buildRequestBody, createPlacesClient } from '../lib/places-client.js';
import { QuotaExceededError, createQuotaGuard } from '../lib/quota-guard.js';

const KEY = 'test-key-abc123-not-real';
const config = loadConfig();
const city = config.cities.blr;
const hsr = city.localities.find((l) => l.id === 'hsr-layout');
const cat = (id) => config.categories.find((c) => c.id === id);

let dir;
let guard;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-'));
  guard = createQuotaGuard({ file: path.join(dir, 'usage.json') });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const err = (status, message = 'boom') => ({ ok: false, status, json: async () => ({ error: { message } }) });
const client = (fetchImpl, extra = {}) =>
  createPlacesClient({ apiKey: KEY, guard, fetchImpl, sleep: async () => {}, ...extra });

describe('buildRequestBody', () => {
  it('builds the documented body for a plain category', () => {
    expect(buildRequestBody({ city, locality: hsr, category: cat('cafe') })).toEqual({
      textQuery: 'cafe in HSR Layout, Bangalore',
      includedType: 'cafe',
      strictTypeFiltering: true,
      locationRestriction: { rectangle: hsr.rectangle },
      minRating: 3.5,
      pageSize: 20,
    });
  });

  it('adds priceLevels only when the category has them, and pageToken for page 2', () => {
    const premium = buildRequestBody({ city, locality: hsr, category: cat('premium'), pageToken: 'tok' });
    expect(premium.priceLevels).toEqual(['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']);
    expect(premium.pageToken).toBe('tok');
    expect(buildRequestBody({ city, locality: hsr, category: cat('pub') })).not.toHaveProperty('priceLevels');
  });

  it('page 2 body differs from page 1 only by pageToken', () => {
    const p1 = buildRequestBody({ city, locality: hsr, category: cat('eatery') });
    const p2 = buildRequestBody({ city, locality: hsr, category: cat('eatery'), pageToken: 't' });
    expect({ ...p2, pageToken: undefined }).toEqual({ ...p1, pageToken: undefined });
  });
});

describe('field mask', () => {
  it('is exactly the allowed fields and nothing pricier', () => {
    expect(FIELD_MASK.split(',').sort()).toEqual(
      [
        'nextPageToken',
        'places.displayName',
        'places.formattedAddress',
        'places.googleMapsUri',
        'places.id',
        'places.location',
        'places.primaryType',
        'places.priceLevel',
        'places.rating',
        'places.types',
        'places.userRatingCount',
      ].sort(),
    );
    expect(FIELD_MASK).not.toMatch(/review|photo|editorial|summary/i);
    expect(FIELD_MASK).not.toContain(' ');
  });
});

describe('createPlacesClient', () => {
  it('POSTs to searchText with key and field mask headers, and returns the parsed body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ places: [{ id: 'a' }] }));
    const body = buildRequestBody({ city, locality: hsr, category: cat('cafe') });
    const result = await client(fetchImpl).searchText(body);

    expect(result).toEqual({ places: [{ id: 'a' }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe(KEY);
    expect(init.headers['X-Goog-FieldMask']).toBe(FIELD_MASK);
    expect(JSON.parse(init.body)).toEqual(body);
    expect(guard.used()).toBe(1);
  });

  it('refuses to start without a key', () => {
    expect(() => createPlacesClient({ apiKey: '', guard, fetchImpl: vi.fn() })).toThrow(/GOOGLE_PLACES_API_KEY/);
  });

  it('retries 429/5xx up to 2 times and counts every attempt in the ledger', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(err(429)).mockResolvedValueOnce(err(503)).mockResolvedValueOnce(ok({ places: [] }));
    await expect(client(fetchImpl).searchText({})).resolves.toEqual({ places: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(guard.used()).toBe(3);
  });

  it('gives up after 2 retries (3 attempts, 3 ledger entries)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(err(500, 'internal'));
    await expect(client(fetchImpl).searchText({})).rejects.toMatchObject({ name: 'PlacesApiError', status: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(guard.used()).toBe(3);
  });

  it('backs off exponentially between retries', async () => {
    const sleep = vi.fn().mockResolvedValue();
    const fetchImpl = vi.fn().mockResolvedValue(err(503));
    await client(fetchImpl, { sleep, baseDelayMs: 100 }).searchText({}).catch(() => {});
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it('does not retry other 4xx errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(err(400, 'INVALID_ARGUMENT'));
    await expect(client(fetchImpl).searchText({})).rejects.toThrow(/HTTP 400: INVALID_ARGUMENT/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(guard.used()).toBe(1);
  });

  it('maxRetries 0 means exactly one call even on a 503', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(err(503));
    await expect(client(fetchImpl, { maxRetries: 0 }).searchText({})).rejects.toBeInstanceOf(PlacesApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('still counts a call that failed on the network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(client(fetchImpl).searchText({})).rejects.toThrow(/Network error/);
    expect(guard.used()).toBe(1);
  });

  it('never leaks the key in error messages', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(err(403, `API key ${KEY} is not authorised`));
    const e = await client(fetchImpl).searchText({}).catch((x) => x);
    expect(e.message).not.toContain(KEY);
    expect(e.message).toContain('***');
    const net = await client(vi.fn().mockRejectedValue(new Error(`bad ${KEY}`))).searchText({}).catch((x) => x);
    expect(net.message).not.toContain(KEY);
  });

  it('sends nothing once the monthly limit is hit', async () => {
    const tiny = createQuotaGuard({ file: path.join(dir, 'tiny.json'), limit: 1 });
    const fetchImpl = vi.fn().mockResolvedValue(ok({}));
    const c = createPlacesClient({ apiKey: KEY, guard: tiny, fetchImpl });
    await c.searchText({});
    await expect(c.searchText({})).rejects.toBeInstanceOf(QuotaExceededError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry past the limit mid-retry', async () => {
    const tiny = createQuotaGuard({ file: path.join(dir, 'tiny.json'), limit: 2 });
    const fetchImpl = vi.fn().mockResolvedValue(err(503));
    const c = createPlacesClient({ apiKey: KEY, guard: tiny, fetchImpl, sleep: async () => {} });
    await expect(c.searchText({})).rejects.toBeInstanceOf(QuotaExceededError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
