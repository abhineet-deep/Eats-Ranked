import * as turf from '@turf/turf';

/**
 * Cleans raw Places API (New) results for one city.
 *
 * `groups` is a list of { locality, category, response: { places } } objects, one per
 * (locality, category, page) call. A place found in several groups is merged into one
 * entry that remembers every locality, category and (locality, category) pair it was found in.
 *
 * Returns { places, stats }. Order of filtering: dedupe, then drop unrated, then drop outside the boundary.
 */
export function cleanCity(groups, boundary) {
  const byId = new Map();
  const stats = { rawResults: 0, droppedNoId: 0, unique: 0, dupesMerged: 0, droppedNoRating: 0, droppedOutside: 0, kept: 0 };

  for (const g of groups) {
    for (const p of g.response?.places ?? []) {
      stats.rawResults++;
      if (!p.id) {
        stats.droppedNoId++;
        continue;
      }
      let entry = byId.get(p.id);
      if (!entry) {
        entry = {
          id: p.id,
          name: p.displayName?.text ?? '',
          rating: p.rating ?? null,
          reviews: p.userRatingCount ?? 0,
          priceLevel: p.priceLevel ?? null,
          types: p.types ?? [],
          primaryType: p.primaryType ?? null,
          location: p.location ?? null,
          address: p.formattedAddress ?? '',
          mapsUrl: p.googleMapsUri ?? '',
          localities: [],
          categories: [],
          found: [],
        };
        byId.set(p.id, entry);
      } else {
        entry.priceLevel ??= p.priceLevel ?? null;
      }
      if (!entry.localities.includes(g.locality)) entry.localities.push(g.locality);
      if (!entry.categories.includes(g.category)) entry.categories.push(g.category);
      if (!entry.found.some((f) => f.locality === g.locality && f.category === g.category)) {
        entry.found.push({ locality: g.locality, category: g.category });
      }
    }
  }

  stats.unique = byId.size;
  stats.dupesMerged = stats.rawResults - stats.droppedNoId - stats.unique;

  const places = [];
  for (const p of byId.values()) {
    if (typeof p.rating !== 'number' || !(p.reviews > 0)) {
      stats.droppedNoRating++;
      continue;
    }
    const { latitude, longitude } = p.location ?? {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        !turf.booleanPointInPolygon(turf.point([longitude, latitude]), boundary)) {
      stats.droppedOutside++;
      continue;
    }
    places.push(p);
  }
  stats.kept = places.length;
  return { places, stats };
}
