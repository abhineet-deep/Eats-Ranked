import { describe, expect, it } from 'vitest';
import { cleanCity } from '../lib/clean.js';
import { loadConfig } from '../lib/config.js';

const boundary = loadConfig().cities.blr.boundary;

const raw = (id, extra = {}) => ({
  id,
  displayName: { text: `Place ${id}` },
  rating: 4.5,
  userRatingCount: 100,
  location: { latitude: 12.92, longitude: 77.63 }, // inside Bangalore
  ...extra,
});
const group = (locality, category, places) => ({ locality, category, response: { places } });

describe('cleanCity', () => {
  it('dedupes by id and keeps every locality, category and pair', () => {
    const { places, stats } = cleanCity(
      [
        group('hsr', 'cafe', [raw('a'), raw('b')]),
        group('koramangala', 'cafe', [raw('a')]),
        group('hsr', 'eatery', [raw('a')]),
      ],
      boundary,
    );
    expect(places).toHaveLength(2);
    const a = places.find((p) => p.id === 'a');
    expect(a.localities).toEqual(['hsr', 'koramangala']);
    expect(a.categories).toEqual(['cafe', 'eatery']);
    expect(a.found).toEqual([
      { locality: 'hsr', category: 'cafe' },
      { locality: 'koramangala', category: 'cafe' },
      { locality: 'hsr', category: 'eatery' },
    ]);
    expect(stats).toMatchObject({ rawResults: 4, unique: 2, dupesMerged: 2, kept: 2 });
  });

  it('does not double-count the same locality and category', () => {
    const { places } = cleanCity([group('hsr', 'cafe', [raw('a')]), group('hsr', 'cafe', [raw('a')])], boundary);
    expect(places[0].localities).toEqual(['hsr']);
    expect(places[0].found).toHaveLength(1);
  });

  it('drops places with no rating, no review count, or zero reviews', () => {
    const noRating = raw('n');
    delete noRating.rating;
    const noCount = raw('c');
    delete noCount.userRatingCount;
    const { places, stats } = cleanCity(
      [group('hsr', 'cafe', [raw('ok'), noRating, noCount, raw('z', { userRatingCount: 0 })])],
      boundary,
    );
    expect(places.map((p) => p.id)).toEqual(['ok']);
    expect(stats.droppedNoRating).toBe(3);
  });

  it('drops places outside the city boundary', () => {
    const { places, stats } = cleanCity(
      [
        group('hsr', 'cafe', [
          raw('in'),
          raw('west', { location: { latitude: 12.975, longitude: 77.452 } }),
          raw('delhi', { location: { latitude: 28.6, longitude: 77.2 } }),
          raw('nowhere', { location: undefined }),
        ]),
      ],
      boundary,
    );
    expect(places.map((p) => p.id)).toEqual(['in']);
    expect(stats.droppedOutside).toBe(3);
  });

  it('keeps places with a missing priceLevel and fills it from another sighting', () => {
    const { places } = cleanCity(
      [group('hsr', 'cafe', [raw('a')]), group('btm', 'cafe', [raw('a', { priceLevel: 'PRICE_LEVEL_MODERATE' })])],
      boundary,
    );
    expect(places[0].priceLevel).toBe('PRICE_LEVEL_MODERATE');
    expect(cleanCity([group('hsr', 'cafe', [raw('b')])], boundary).places[0].priceLevel).toBeNull();
  });
});
