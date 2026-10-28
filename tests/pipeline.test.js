import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.js';
import { buildRankings } from '../lib/build-output.js';
import { bayesianScore } from '../lib/rank.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/mock-places.json', import.meta.url), 'utf8'));
const config = loadConfig();
const { rankings, stats } = buildRankings(fixture, config, { generatedAt: '2026-01-01T00:00:00.000Z', source: 'mock' });
const blr = rankings.cities.blr;
const ggn = rankings.cities.ggn;

const allPlaces = fixture.flatMap((g) => g.response.places);
const byName = (name) => allPlaces.find((p) => p.displayName.text === name);

describe('mock fixture', () => {
  it('has ~300 unique places in the Places API (New) shape', () => {
    const ids = new Set(allPlaces.map((p) => p.id));
    expect(ids.size).toBeGreaterThanOrEqual(300);
    expect(ids.size).toBeLessThan(400);
    const sample = fixture[0].response.places[0];
    expect(sample).toMatchObject({
      id: expect.any(String),
      displayName: { text: expect.any(String) },
      location: { latitude: expect.any(Number), longitude: expect.any(Number) },
      formattedAddress: expect.any(String),
      googleMapsUri: expect.any(String),
    });
  });

  it('covers the edge cases', () => {
    expect(byName('Tiny Perfect Cafe')).toMatchObject({ rating: 4.9, userRatingCount: 12 });
    expect(byName('Old Faithful Taproom')).toMatchObject({ rating: 4.3, userRatingCount: 15000 });
    expect(byName('Brand New Cafe')).not.toHaveProperty('rating');
    expect(byName('No Price Level Cafe')).not.toHaveProperty('priceLevel');
    const dupes = Object.values(Object.groupBy(fixture.flatMap((g) => g.response.places.map((p) => [p.id, g])), ([id]) => id))
      .filter((v) => new Set(v.map(([, g]) => g.locality)).size > 1);
    expect(dupes.length).toBeGreaterThanOrEqual(5);
  });
});

describe('pipeline on fixture', () => {
  it('drops unrated and out-of-boundary places and merges duplicates', () => {
    expect(stats.blr.droppedOutside).toBe(3);
    expect(stats.ggn.droppedOutside).toBe(3);
    expect(stats.blr.droppedNoRating).toBe(3);
    expect(stats.ggn.droppedNoRating).toBe(1);
    expect(stats.blr.dupesMerged + stats.ggn.dupesMerged).toBeGreaterThanOrEqual(5);
    const rankedIds = new Set(Object.values(rankings.cities).flatMap((c) => c.cityTop.map((e) => e.id)));
    for (const name of ['Nelamangala Highway Dhaba', 'Delhi Border Club', 'Brand New Cafe', 'Zero Review Mess']) {
      expect(rankedIds.has(byName(name).id)).toBe(false);
    }
  });

  it('builds the expected list sizes', () => {
    expect(blr.cityTop).toHaveLength(50);
    expect(ggn.cityTop).toHaveLength(50);
    for (const city of [blr, ggn]) {
      for (const list of Object.values(city.byLocality)) expect(list.length).toBeLessThanOrEqual(15);
      for (const list of Object.values(city.byCategory)) expect(list.length).toBeLessThanOrEqual(15);
      expect(Object.keys(city.byCategory).sort()).toEqual(['club', 'cafe', 'eatery', 'premium', 'pub'].sort());
    }
    expect(blr.byLocalityCategory['hsr-layout'].cafe.length).toBeGreaterThan(0);
  });

  it('emits entries in the documented shape, sorted by score with sequential ranks', () => {
    for (const e of blr.cityTop) {
      expect({ ...e, priceLevel: undefined }).toEqual({
        rank: expect.any(Number),
        id: expect.any(String),
        name: expect.any(String),
        rating: expect.any(Number),
        reviews: expect.any(Number),
        score: expect.any(Number),
        priceLevel: undefined,
        categories: expect.any(Array),
        localities: expect.any(Array),
        address: expect.any(String),
        mapsUrl: expect.any(String),
      });
      expect(e.priceLevel === null || (Number.isInteger(e.priceLevel) && e.priceLevel >= 0 && e.priceLevel <= 4)).toBe(true);
      expect(e.score).toBe(Number(e.score.toFixed(2)));
    }
    blr.cityTop.forEach((e, i) => {
      expect(e.rank).toBe(i + 1);
      if (i > 0) expect(blr.cityTop[i - 1].score).toBeGreaterThanOrEqual(e.score);
    });
  });

  it('scores a well-reviewed 4.3 above a 4.9 with 12 reviews (m=500)', () => {
    const C = blr.meta.averageRating;
    const perfect = bayesianScore(4.9, 12, C, 500);
    const faithful = bayesianScore(4.3, 15000, C, 500);
    expect(faithful).toBeGreaterThan(perfect);
  });

  it('puts the same duplicated place in both localities', () => {
    const dup = blr.byLocality['btm-layout'].find((e) => e.localities.length > 1);
    expect(dup).toBeDefined();
    for (const loc of dup.localities) {
      expect(blr.byLocality[loc].some((e) => e.id === dup.id)).toBe(true);
    }
  });

  it('writes meta for the UI', () => {
    expect(rankings).toMatchObject({ generatedAt: '2026-01-01T00:00:00.000Z', source: 'mock' });
    expect(blr.meta).toMatchObject({ id: 'blr', name: 'Bangalore', m: { cityTop: 500, lists: 150 } });
    expect(blr.meta.localities).toHaveLength(35);
    expect(blr.meta.categories.map((c) => c.id)).toEqual(['premium', 'cafe', 'pub', 'club', 'eatery']);
    expect(blr.meta.averageRating).toBeGreaterThan(3.5);
    expect(blr.meta.averageRating).toBeLessThan(5);
    expect(blr.meta.placeCount).toBe(stats.blr.kept);
  });
});
