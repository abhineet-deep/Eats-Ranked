import { describe, expect, it } from 'vitest';
import { bayes, bookUrl, confidence, explainScore, formatReviews, timeAgo } from '../web/src/lib/format.js';
import { buildSearch, parseFilters, selectList } from '../web/src/lib/filters.js';
import { bayesianScore } from '../lib/rank.js';

describe('format', () => {
  it('formats review counts', () => {
    expect(formatReviews(12)).toBe('12');
    expect(formatReviews(950)).toBe('950');
    expect(formatReviews(1234)).toBe('1.2k');
    expect(formatReviews(8000)).toBe('8k');
    expect(formatReviews(12400)).toBe('12.4k');
    expect(formatReviews(125000)).toBe('125k');
    expect(formatReviews(2_400_000)).toBe('2.4M');
  });

  it('describes age', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    expect(timeAgo('2026-10-28T01:00:00Z', now)).toBe('today');
    expect(timeAgo('2026-10-27T01:00:00Z', now)).toBe('1 day ago');
    expect(timeAgo('2026-10-18T01:00:00Z', now)).toBe('10 days ago');
    expect(timeAgo('2026-06-01T00:00:00Z', now)).toBe('4 months ago');
    expect(timeAgo('nonsense', now)).toBe('');
  });

  it('explains a score in one line', () => {
    expect(explainScore({ rating: 4.4, reviews: 8000, score: 4.38 })).toBe('4.4★ from 8,000 reviews → score 4.38');
  });

  it('computes confidence as v / (v + m)', () => {
    expect(confidence(500, 500)).toBe(0.5);
    expect(confidence(0, 150)).toBe(0);
  });

  it('uses the same formula as the ranking engine', () => {
    expect(bayes(4.4, 8000, 4.1, 500)).toBe(bayesianScore(4.4, 8000, 4.1, 500));
  });
});

const rankings = {
  cities: {
    blr: {
      meta: {
        m: { cityTop: 500, lists: 150 },
        listSizes: { cityTop: 50, lists: 15 },
        localities: [{ id: 'hsr-layout' }, { id: 'koramangala' }],
        categories: [{ id: 'cafe' }, { id: 'pub' }],
      },
      cityTop: ['top'],
      byLocality: { 'hsr-layout': ['loc'] },
      byCategory: { cafe: ['cat'] },
      byLocalityCategory: { 'hsr-layout': { cafe: ['both'] } },
    },
    ggn: { meta: { localities: [], categories: [] } },
  },
};

describe('url filters', () => {
  it('parses valid params', () => {
    expect(parseFilters('?city=blr&area=hsr-layout&cat=cafe', rankings)).toEqual({ city: 'blr', area: 'hsr-layout', cat: 'cafe' });
  });

  it('falls back on unknown values', () => {
    expect(parseFilters('?city=xyz&area=nope&cat=nope', rankings)).toEqual({ city: 'blr', area: '', cat: '' });
    expect(parseFilters('', rankings)).toEqual({ city: 'blr', area: '', cat: '' });
    expect(parseFilters('?city=ggn&area=hsr-layout', rankings)).toEqual({ city: 'ggn', area: '', cat: '' });
  });

  it('round-trips through buildSearch', () => {
    const f = { city: 'blr', area: 'hsr-layout', cat: 'cafe' };
    expect(buildSearch(f)).toBe('city=blr&area=hsr-layout&cat=cafe');
    expect(parseFilters(`?${buildSearch(f)}`, rankings)).toEqual(f);
    expect(buildSearch({ city: 'ggn', area: '', cat: '' })).toBe('city=ggn');
  });

  it('selects the right list and m', () => {
    const city = rankings.cities.blr;
    expect(selectList(city, { area: '', cat: '' })).toEqual({ entries: ['top'], m: 500, size: 50 });
    expect(selectList(city, { area: 'hsr-layout', cat: '' })).toEqual({ entries: ['loc'], m: 150, size: 15 });
    expect(selectList(city, { area: '', cat: 'cafe' })).toEqual({ entries: ['cat'], m: 150, size: 15 });
    expect(selectList(city, { area: 'hsr-layout', cat: 'cafe' })).toEqual({ entries: ['both'], m: 150, size: 15 });
    expect(selectList(city, { area: 'koramangala', cat: 'cafe' }).entries).toEqual([]);
  });
});

describe('bookUrl', () => {
  it('searches district.in for the place and city', () => {
    const u = new URL(bookUrl('Smoke House Deli', 'Bangalore'));
    expect(u.searchParams.get('q')).toBe('site:district.in/dining Smoke House Deli Bangalore');
  });
});
