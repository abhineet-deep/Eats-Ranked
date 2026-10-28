import { cleanCity } from './clean.js';
import { rankCity } from './rank.js';

// Google's priceLevel enum -> number of ₹ symbols to show. Missing/unknown -> null.
const PRICE_LEVELS = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export const priceLevelToNumber = (level) => PRICE_LEVELS[level] ?? null;

const round = (n, dp) => Number(n.toFixed(dp));

function toEntry({ rank, place, score }) {
  return {
    rank,
    id: place.id,
    name: place.name,
    rating: place.rating,
    reviews: place.reviews,
    score: round(score, 2),
    priceLevel: priceLevelToNumber(place.priceLevel),
    categories: place.categories,
    localities: place.localities,
    address: place.address,
    mapsUrl: place.mapsUrl,
  };
}

const mapLists = (lists) => lists.map(toEntry);
const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

/** Output block for one city: meta (for the UI filters) plus every ranked list. */
export function buildCityOutput(city, config, places) {
  const ranked = rankCity(places, config);
  const countBy = (field, id) => places.filter((p) => p[field].includes(id)).length;
  return {
    meta: {
      id: city.id,
      name: city.name,
      averageRating: round(ranked.C, 4),
      placeCount: places.length,
      m: config.m,
      listSizes: config.listSizes,
      localities: city.localities.map((l) => ({ id: l.id, name: l.name, placeCount: countBy('localities', l.id) })),
      categories: config.categories.map((c) => ({ id: c.id, label: c.label, shortLabel: c.shortLabel ?? c.label, placeCount: countBy('categories', c.id) })),
    },
    cityTop: mapLists(ranked.cityTop),
    byLocality: mapValues(ranked.byLocality, mapLists),
    byCategory: mapValues(ranked.byCategory, mapLists),
    byLocalityCategory: mapValues(ranked.byLocalityCategory, (cats) => mapValues(cats, mapLists)),
  };
}

/**
 * Full pipeline: raw result groups (each tagged with city, locality, category) -> rankings.json object.
 * 'cityIds' limits the build to some cities (default: all). Returns { rankings, stats } with stats per city.
 */
export function buildRankings(
  groups,
  config,
  { generatedAt = new Date().toISOString(), source = 'google', cityIds = Object.keys(config.cities), usage } = {},
) {
  const cities = {};
  const stats = {};
  for (const id of cityIds) {
    const city = config.cities[id];
    const cityGroups = groups.filter((g) => g.city === city.id);
    const { places, stats: cityStats } = cleanCity(cityGroups, city.boundary);
    cities[id] = buildCityOutput(city, config, places);
    cities[id].meta.generatedAt = generatedAt;
    stats[id] = cityStats;
  }
  const rankings = { generatedAt, source, cities };
  if (usage) rankings.usage = usage;
  return { rankings, stats };
}

/**
 * Merges a fresh build into the existing rankings.json so refreshing one city keeps the other.
 * Mock data is never merged with real data. City order follows 'cityOrder'.
 */
export function mergeRankings(existing, fresh, cityOrder = Object.keys(fresh.cities)) {
  const keep = existing?.cities && existing.source !== 'mock' && fresh.source !== 'mock' ? existing.cities : {};
  const merged = { ...keep, ...fresh.cities };
  const cities = {};
  for (const id of cityOrder) if (merged[id]) cities[id] = merged[id];
  const result = { generatedAt: fresh.generatedAt, source: fresh.source, cities };
  const usage = fresh.usage ?? (keep === existing?.cities ? existing?.usage : undefined);
  if (usage) result.usage = usage;
  return result;
}
