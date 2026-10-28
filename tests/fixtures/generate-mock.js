// Deterministic generator for tests/fixtures/mock-places.json.
// Run: node tests/fixtures/generate-mock.js
// Output mimics saved Places API (New) Text Search responses, grouped per (city, locality, category, page).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../lib/config.js';

const config = loadConfig();

// mulberry32, so the fixture is stable between runs
let seed = 20261028;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);

const SELECTED = {
  blr: [
    'hsr-layout', 'aecs-layout', 'koramangala', 'indiranagar', 'whitefield', 'marathahalli',
    'bellandur', 'btm-layout', 'jayanagar', 'mg-road-brigade-road', 'church-street', 'malleshwaram',
  ],
  ggn: [
    'cyber-hub-dlf-cyber-city', 'golf-course-road', 'sector-29', 'mg-road', 'udyog-vihar',
    'dlf-phase-4', 'sohna-road', 'sector-43',
  ],
};
const PER_GROUP = 3;

const ADJ = ['Golden', 'Saffron', 'Copper', 'Velvet', 'Indigo', 'Ember', 'Jade', 'Maple', 'Silver', 'Rustic', 'Royal', 'Urban', 'Coastal', 'Midnight', 'Sunny', 'Wild', 'Cedar', 'Lotus', 'Monsoon', 'Paper'];
const NOUNS = {
  premium: ['Table', 'Dining Room', 'Kitchen & Bar', 'Atelier', 'Brasserie', 'Courtyard'],
  cafe: ['Cafe', 'Roasters', 'Coffee Co.', 'Bakehouse', 'Brew Lab', 'Espresso Bar'],
  pub: ['Taproom', 'Brewpub', 'Pub', 'Alehouse', 'Bar Exchange', 'Social Hall'],
  club: ['Lounge', 'Club', 'Nighthouse', 'Terrace', 'Underground', 'Rooftop'],
  eatery: ['Darshini', 'Biryani House', 'Mess', 'Meals', 'Tiffins', 'Kitchen', 'Dhaba', 'Thali'],
};
const TYPES = {
  premium: ['restaurant', 'fine_dining_restaurant', 'food', 'point_of_interest', 'establishment'],
  cafe: ['cafe', 'coffee_shop', 'food', 'point_of_interest', 'establishment'],
  pub: ['bar', 'pub', 'food', 'point_of_interest', 'establishment'],
  club: ['night_club', 'bar', 'point_of_interest', 'establishment'],
  eatery: ['restaurant', 'indian_restaurant', 'food', 'point_of_interest', 'establishment'],
};
const PRICE = {
  premium: ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'],
  eatery: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE'],
  cafe: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE'],
  pub: ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE'],
  club: ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'],
};
// chance Google omits priceLevel for this kind of place
const PRICE_MISSING = { premium: 0, eatery: 0, cafe: 0.4, pub: 0.3, club: 0.3 };
const MAX_REVIEW_EXP = { premium: 3.7, cafe: 3.8, pub: 3.8, club: 3.4, eatery: 4.1 };
const CITY_LABEL = {
  blr: { place: 'Bengaluru, Karnataka', pins: ['560034', '560102', '560095', '560038', '560037', '560103', '560068', '560001'] },
  ggn: { place: 'Gurugram, Haryana', pins: ['122002', '122009', '122001', '122018', '122022'] },
};

const base62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const used = new Set();
const newId = () => {
  let id;
  do {
    id = 'ChIJ' + Array.from({ length: 23 }, () => base62[Math.floor(rand() * base62.length)]).join('');
  } while (used.has(id));
  used.add(id);
  return id;
};

const usedNames = new Set();
function newName(cat, localityName) {
  for (let i = 0; i < 20; i++) {
    const n = `${pick(ADJ)} ${pick(NOUNS[cat])}`;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  const n = `${pick(ADJ)} ${pick(NOUNS[cat])} ${localityName.split(/[ /]/)[0]}`;
  usedNames.add(n);
  return n;
}

function makePlace({ cityId, locality, cat, at }) {
  const rect = locality.rectangle;
  const padLat = (rect.high.latitude - rect.low.latitude) * 0.1;
  const padLng = (rect.high.longitude - rect.low.longitude) * 0.1;
  const location = at ?? {
    latitude: +between(rect.low.latitude + padLat, rect.high.latitude - padLat).toFixed(6),
    longitude: +between(rect.low.longitude + padLng, rect.high.longitude - padLng).toFixed(6),
  };
  const rating = Math.min(4.9, +(3.5 + 1.4 * rand()).toFixed(1));
  const userRatingCount = Math.round(10 ** between(1.3, MAX_REVIEW_EXP[cat]));
  const id = newId();
  const place = {
    id,
    displayName: { text: newName(cat, locality.name), languageCode: 'en' },
    rating,
    userRatingCount,
    types: TYPES[cat],
    primaryType: TYPES[cat][0],
    location,
    formattedAddress: `${Math.floor(between(1, 900))}, ${locality.name}, ${CITY_LABEL[cityId].place} ${pick(CITY_LABEL[cityId].pins)}, India`,
    googleMapsUri: `https://maps.google.com/?cid=${Math.floor(between(1e18, 9e18))}`,
  };
  if (rand() >= PRICE_MISSING[cat]) place.priceLevel = pick(PRICE[cat]);
  return { ...place, priceLevel: place.priceLevel }; // keep key order stable; undefined is dropped by JSON.stringify
}

// groups[city][locality][cat] -> places
const groups = {};
const group = (cityId, locId, cat) => ((groups[cityId] ??= {})[locId] ??= {})[cat] ??= [];

for (const cityId of Object.keys(SELECTED)) {
  const city = config.cities[cityId];
  for (const locId of SELECTED[cityId]) {
    const locality = city.localities.find((l) => l.id === locId);
    if (!locality) throw new Error(`Unknown locality ${cityId}/${locId}`);
    for (const { id: cat } of config.categories) {
      for (let i = 0; i < PER_GROUP; i++) group(cityId, locId, cat).push(makePlace({ cityId, locality, cat }));
    }
  }
}

const loc = (cityId, locId) => config.cities[cityId].localities.find((l) => l.id === locId);
const mid = (a, b) => ({
  latitude: +((a.latitude + b.latitude) / 2).toFixed(6),
  longitude: +((a.longitude + b.longitude) / 2).toFixed(6),
});
const centre = (l) => mid(l.rectangle.low, l.rectangle.high);
const add = (cityId, locId, cat, place) => group(cityId, locId, cat).push(place);

// --- edge cases ---------------------------------------------------------
const named = (cityId, locId, cat, name, rating, userRatingCount, extra = {}) => {
  const p = makePlace({ cityId, locality: loc(cityId, locId), cat });
  usedNames.add(name);
  Object.assign(p, { displayName: { text: name, languageCode: 'en' }, rating, userRatingCount }, extra);
  add(cityId, locId, cat, p);
  return p;
};

// high rating, tiny sample vs lower rating, huge sample (the whole point of the ranking)
named('blr', 'hsr-layout', 'cafe', 'Tiny Perfect Cafe', 4.9, 12);
named('blr', 'hsr-layout', 'cafe', 'Hype Brew', 4.9, 40);
named('blr', 'indiranagar', 'pub', 'Old Faithful Taproom', 4.3, 15000);
named('blr', 'koramangala', 'eatery', 'Legend Meals', 4.4, 8000);
named('ggn', 'cyber-hub-dlf-cyber-city', 'pub', 'Cyber Hub Social Hall', 4.2, 12400);
named('ggn', 'golf-course-road', 'premium', 'Debut Table', 4.9, 18);

// duplicates: same place returned for two localities (placed between the two centres)
const dupPairs = [
  ['blr', 'koramangala', 'btm-layout', 'cafe'],
  ['blr', 'marathahalli', 'aecs-layout', 'eatery'],
  ['blr', 'church-street', 'mg-road-brigade-road', 'pub'],
  ['blr', 'indiranagar', 'koramangala', 'club'],
  ['ggn', 'cyber-hub-dlf-cyber-city', 'udyog-vihar', 'pub'],
  ['ggn', 'golf-course-road', 'sector-43', 'eatery'],
  ['ggn', 'mg-road', 'sector-29', 'cafe'],
];
for (const [cityId, a, b, cat] of dupPairs) {
  const p = makePlace({ cityId, locality: loc(cityId, a), cat, at: mid(centre(loc(cityId, a)), centre(loc(cityId, b))) });
  p.rating = Math.max(p.rating, 4.4);
  p.userRatingCount = Math.max(p.userRatingCount, 2500);
  add(cityId, a, cat, p);
  add(cityId, b, cat, p);
}
// and one place that shows up under two categories in the same locality
{
  const p = makePlace({ cityId: 'blr', locality: loc('blr', 'hsr-layout'), cat: 'eatery' });
  p.rating = 4.5;
  p.userRatingCount = 3100;
  add('blr', 'hsr-layout', 'eatery', p);
  add('blr', 'hsr-layout', 'cafe', p);
}

// just outside the city boundary
const outside = [
  ['blr', 'jayanagar', 'eatery', 'Nelamangala Highway Dhaba', { latitude: 12.975, longitude: 77.452 }],
  ['blr', 'malleshwaram', 'pub', 'Devanahalli Brewpub', { latitude: 13.15, longitude: 77.6 }],
  ['blr', 'bellandur', 'cafe', 'Attibele Roasters', { latitude: 12.79, longitude: 77.64 }],
  ['ggn', 'sector-29', 'club', 'Delhi Border Club', { latitude: 28.545, longitude: 77.05 }],
  ['ggn', 'sohna-road', 'eatery', 'Sohna Town Dhaba', { latitude: 28.33, longitude: 77.02 }],
  ['ggn', 'golf-course-road', 'premium', 'Faridabad Road Grill', { latitude: 28.46, longitude: 77.15 }],
];
for (const [cityId, locId, cat, name, at] of outside) {
  named(cityId, locId, cat, name, 4.8, 5200, { location: at });
}

// missing rating / zero reviews / missing priceLevel
{
  const p1 = named('blr', 'whitefield', 'cafe', 'Brand New Cafe', 4, 1);
  delete p1.rating;
  delete p1.userRatingCount;
  const p2 = named('blr', 'jayanagar', 'pub', 'Rating Without Count', 4.5, 1);
  delete p2.userRatingCount;
  named('blr', 'btm-layout', 'eatery', 'Zero Review Mess', 4.6, 0);
  const p3 = named('ggn', 'udyog-vihar', 'cafe', 'Unrated Bean', 4, 1);
  delete p3.rating;
  delete p3.userRatingCount;
  const p4 = named('blr', 'indiranagar', 'cafe', 'No Price Level Cafe', 4.7, 2100);
  delete p4.priceLevel;
}

// --- output -------------------------------------------------------------
const out = [];
for (const [cityId, locs] of Object.entries(groups)) {
  for (const [locId, cats] of Object.entries(locs)) {
    for (const [cat, places] of Object.entries(cats)) {
      out.push({ city: cityId, locality: locId, category: cat, page: 1, response: { places } });
    }
  }
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock-places.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
const ids = new Set(out.flatMap((g) => g.response.places.map((p) => p.id)));
console.log(`Wrote ${out.length} groups, ${ids.size} unique places to ${file}`);
