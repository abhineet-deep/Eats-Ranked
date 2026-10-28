import { describe, expect, it } from 'vitest';
import { bayesianScore, meanRating, rankCity, rankList } from '../lib/rank.js';

const place = (id, rating, reviews, extra = {}) => ({
  id, name: id, rating, reviews, priceLevel: null,
  localities: ['loc-a'], categories: ['cafe'], found: [{ locality: 'loc-a', category: 'cafe' }],
  ...extra,
});

describe('bayesianScore', () => {
  it('matches the formula by hand', () => {
    // v=40, m=500, R=4.9, C=4.1 -> (40/540)*4.9 + (500/540)*4.1
    expect(bayesianScore(4.9, 40, 4.1, 500)).toBeCloseTo(4.1593, 4);
    // v=8000: (8000/8500)*4.4 + (500/8500)*4.1
    expect(bayesianScore(4.4, 8000, 4.1, 500)).toBeCloseTo(4.3824, 4);
  });

  it('ranks 4.4 from 8000 reviews above 4.9 from 40 reviews', () => {
    const list = rankList([place('few', 4.9, 40), place('many', 4.4, 8000)], 4.1, 500, 10);
    expect(list.map((e) => e.place.id)).toEqual(['many', 'few']);
  });

  it('returns C when there are no reviews and R when reviews dominate', () => {
    expect(bayesianScore(5, 0, 4.1, 500)).toBeCloseTo(4.1);
    expect(bayesianScore(4.8, 1e9, 4.1, 500)).toBeCloseTo(4.8, 4);
  });

  it('uses a smaller m for lists, which rewards fewer reviews more', () => {
    const lowM = bayesianScore(4.8, 200, 4.1, 150);
    const highM = bayesianScore(4.8, 200, 4.1, 500);
    expect(lowM).toBeGreaterThan(highM);
  });
});

describe('meanRating', () => {
  it('averages ratings and handles empty input', () => {
    expect(meanRating([place('a', 4), place('b', 5)])).toBe(4.5);
    expect(meanRating([])).toBe(0);
  });
});

describe('tie-breaking', () => {
  it('breaks equal scores by review count, then id', () => {
    // every rating equals C, so every score equals C
    const list = rankList([place('b', 4, 100), place('a', 4, 100), place('c', 4, 900)], 4, 150, 10);
    expect(list.map((e) => e.place.id)).toEqual(['c', 'a', 'b']);
    expect(list.map((e) => e.rank)).toEqual([1, 2, 3]);
  });
});

describe('rankCity list sizes and scoping', () => {
  const config = { m: { cityTop: 500, lists: 150 }, listSizes: { cityTop: 50, lists: 15 } };
  const many = Array.from({ length: 80 }, (_, i) => place(`p${i}`, 3.6 + (i % 13) * 0.1, 100 + i * 37));

  it('caps cityTop at 50 and other lists at 15', () => {
    const r = rankCity(many, config);
    expect(r.cityTop).toHaveLength(50);
    expect(r.byLocality['loc-a']).toHaveLength(15);
    expect(r.byCategory.cafe).toHaveLength(15);
    expect(r.byLocalityCategory['loc-a'].cafe).toHaveLength(15);
  });

  it('returns fewer entries when fewer places exist', () => {
    const r = rankCity(many.slice(0, 4), config);
    expect(r.cityTop).toHaveLength(4);
  });

  it('only pairs a locality with categories the place was found under together', () => {
    const p = place('x', 4.5, 1000, {
      localities: ['loc-a', 'loc-b'],
      categories: ['cafe', 'pub'],
      found: [{ locality: 'loc-a', category: 'cafe' }, { locality: 'loc-b', category: 'pub' }],
    });
    const r = rankCity([p], config);
    expect(r.byLocalityCategory['loc-a']).toHaveProperty('cafe');
    expect(r.byLocalityCategory['loc-a']).not.toHaveProperty('pub');
    expect(r.byLocalityCategory['loc-b']).toHaveProperty('pub');
    expect(r.byLocality['loc-a']).toHaveLength(1);
    expect(r.byCategory.pub).toHaveLength(1);
  });

  it('uses m=500 for cityTop and m=150 for lists', () => {
    // C is about 4.1: with m=150 'low' beats 'mid', with m=500 it does not
    const low = place('low', 4.9, 100);
    const mid = place('mid', 4.4, 600);
    const high = place('high', 4.5, 3000);
    const filler = Array.from({ length: 10 }, (_, i) => place('f' + i, 4.0, 500 + i));
    const r = rankCity([low, mid, high, ...filler], config);
    const rankIn = (list, id) => list.find((e) => e.place.id === id).rank;
    expect(rankIn(r.byLocality['loc-a'], 'low')).toBeLessThan(rankIn(r.byLocality['loc-a'], 'mid'));
    expect(rankIn(r.cityTop, 'low')).toBeGreaterThan(rankIn(r.cityTop, 'mid'));
  });
});
