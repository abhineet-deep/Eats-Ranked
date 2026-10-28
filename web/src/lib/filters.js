/**
 * Filters live in the URL: ?city=blr&area=hsr-layout&cat=cafe
 * Unknown or missing values fall back to the first city / all areas / all categories.
 */
export function parseFilters(search, rankings) {
  const params = new URLSearchParams(search);
  const cityIds = Object.keys(rankings.cities);
  const cityParam = params.get('city');
  const city = cityIds.includes(cityParam) ? cityParam : cityIds[0];
  const { meta } = rankings.cities[city];
  const area = params.get('area');
  const cat = params.get('cat');
  return {
    city,
    area: meta.localities.some((l) => l.id === area) ? area : '',
    cat: meta.categories.some((c) => c.id === cat) ? cat : '',
  };
}

export function buildSearch({ city, area, cat }) {
  const params = new URLSearchParams({ city });
  if (area) params.set('area', area);
  if (cat) params.set('cat', cat);
  return params.toString();
}

/** Picks the list for the current filters, with the m and nominal size that list was ranked with. */
export function selectList(cityData, { area, cat }) {
  const { m, listSizes } = cityData.meta;
  if (area && cat) {
    return { entries: cityData.byLocalityCategory[area]?.[cat] ?? [], m: m.lists, size: listSizes.lists };
  }
  if (area) return { entries: cityData.byLocality[area] ?? [], m: m.lists, size: listSizes.lists };
  if (cat) return { entries: cityData.byCategory[cat] ?? [], m: m.lists, size: listSizes.lists };
  return { entries: cityData.cityTop, m: m.cityTop, size: listSizes.cityTop };
}
