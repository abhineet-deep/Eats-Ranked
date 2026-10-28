/** Bayesian average: pulls a rating toward the city mean C until it has about m reviews behind it. */
export function bayesianScore(rating, reviews, cityMean, m) {
  return (reviews / (reviews + m)) * rating + (m / (reviews + m)) * cityMean;
}

/** C: mean rating of all cleaned places in the city. */
export function meanRating(places) {
  if (!places.length) return 0;
  return places.reduce((sum, p) => sum + p.rating, 0) / places.length;
}

// Score descending; ties go to more reviews, then id so output is deterministic.
function compare(a, b) {
  const diff = b.score - a.score;
  if (Math.abs(diff) > 1e-9) return diff;
  if (b.place.reviews !== a.place.reviews) return b.place.reviews - a.place.reviews;
  return a.place.id < b.place.id ? -1 : 1;
}

/** Top `size` of `places` as [{ rank, place, score }]. */
export function rankList(places, cityMean, m, size) {
  return places
    .map((place) => ({ place, score: bayesianScore(place.rating, place.reviews, cityMean, m) }))
    .sort(compare)
    .slice(0, size)
    .map((entry, i) => ({ rank: i + 1, ...entry }));
}

const push = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

/**
 * Builds every list for one city from cleaned places.
 * `m` is { cityTop, lists }, `listSizes` is { cityTop, lists }.
 * byLocalityCategory only uses (locality, category) pairs a place was actually found under.
 */
export function rankCity(places, { m, listSizes }) {
  const C = meanRating(places);
  const byLoc = new Map();
  const byCat = new Map();
  const byPair = new Map();
  for (const p of places) {
    for (const l of p.localities) push(byLoc, l, p);
    for (const c of p.categories) push(byCat, c, p);
    for (const f of p.found) push(byPair, `${f.locality}\u0000${f.category}`, p);
  }

  const list = (ps) => rankList(ps, C, m.lists, listSizes.lists);
  const byLocality = {};
  for (const [l, ps] of byLoc) byLocality[l] = list(ps);
  const byCategory = {};
  for (const [c, ps] of byCat) byCategory[c] = list(ps);
  const byLocalityCategory = {};
  for (const [key, ps] of byPair) {
    const [l, c] = key.split('\u0000');
    (byLocalityCategory[l] ??= {})[c] = list(ps);
  }

  return {
    C,
    cityTop: rankList(places, C, m.cityTop, listSizes.cityTop),
    byLocality,
    byCategory,
    byLocalityCategory,
  };
}
