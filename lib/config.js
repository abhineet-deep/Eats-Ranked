import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

export function loadConfig() {
  const categories = readJson('config/categories.json');
  const localities = readJson('config/localities.json');
  const cities = {};
  for (const [id, city] of Object.entries(localities.cities)) {
    const geo = readJson(city.boundary);
    cities[id] = { id, ...city, boundary: geo.features[0] };
  }
  return { ...categories, cities };
}

/** Turf polygon for a Places API rectangle {low, high}. */
export function rectToPolygon({ low, high }) {
  return turf.bboxPolygon([low.longitude, low.latitude, high.longitude, high.latitude]);
}

const KM_PER_DEG = 111.32;

export function rectSizeKm({ low, high }) {
  const midLat = (low.latitude + high.latitude) / 2;
  return {
    height: (high.latitude - low.latitude) * KM_PER_DEG,
    width: (high.longitude - low.longitude) * KM_PER_DEG * Math.cos((midLat * Math.PI) / 180),
  };
}

// Overlap area as a fraction of the smaller rectangle's area.
function overlapFraction(a, b) {
  const w = Math.min(a.high.longitude, b.high.longitude) - Math.max(a.low.longitude, b.low.longitude);
  const h = Math.min(a.high.latitude, b.high.latitude) - Math.max(a.low.latitude, b.low.latitude);
  if (w <= 0 || h <= 0) return 0;
  const area = (r) => (r.high.longitude - r.low.longitude) * (r.high.latitude - r.low.latitude);
  return (w * h) / Math.min(area(a), area(b));
}

const inRange = (n, lo, hi) => typeof n === 'number' && n >= lo && n <= hi;

/** Returns { errors, warnings, budget } for the loaded config. */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const pages = config.pagesPerQuery;
  const catCount = config.categories.length;

  const catIds = new Set();
  for (const c of config.categories) {
    if (catIds.has(c.id)) errors.push(`Duplicate category id: ${c.id}`);
    catIds.add(c.id);
    for (const key of ['label', 'textQuery', 'includedType']) {
      if (!c[key]) errors.push(`Category ${c.id}: missing ${key}`);
    }
    if (c.minRating !== 3.5) warnings.push(`Category ${c.id}: minRating is ${c.minRating}, brief says 3.5`);
  }

  const perCity = {};
  let total = 0;
  for (const city of Object.values(config.cities)) {
    const ids = new Set();
    const localities = city.localities;
    for (const loc of localities) {
      const tag = `${city.id}/${loc.id}`;
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(loc.id)) errors.push(`${tag}: id is not a slug`);
      if (ids.has(loc.id)) errors.push(`${tag}: duplicate locality id`);
      ids.add(loc.id);

      const { low, high } = loc.rectangle ?? {};
      const coordsOk =
        low && high &&
        inRange(low.latitude, -90, 90) && inRange(high.latitude, -90, 90) &&
        inRange(low.longitude, -180, 180) && inRange(high.longitude, -180, 180);
      if (!coordsOk) {
        errors.push(`${tag}: rectangle missing or has out-of-range coordinates`);
        continue;
      }
      if (low.latitude >= high.latitude || low.longitude >= high.longitude) {
        errors.push(`${tag}: rectangle low must be south-west of high`);
        continue;
      }
      if (!turf.booleanWithin(rectToPolygon(loc.rectangle), city.boundary)) {
        errors.push(`${tag}: rectangle is not fully inside the ${city.name} boundary`);
      }
      const { width, height } = rectSizeKm(loc.rectangle);
      if (Math.min(width, height) < 1.4 || Math.max(width, height) > 3.2) {
        warnings.push(`${tag}: size ${width.toFixed(1)} x ${height.toFixed(1)} km (target roughly 1.5-3 km per side)`);
      }
    }
    for (let i = 0; i < localities.length; i++) {
      for (let j = i + 1; j < localities.length; j++) {
        const a = localities[i];
        const b = localities[j];
        if (!a.rectangle?.low || !b.rectangle?.low) continue;
        const o = overlapFraction(a.rectangle, b.rectangle);
        if (o > 0.4) {
          warnings.push(`${city.id}: ${a.id} and ${b.id} overlap by ${Math.round(o * 100)}% of the smaller one`);
        }
      }
    }
    const calls = localities.length * catCount * pages;
    perCity[city.id] = { name: city.name, localities: localities.length, categories: catCount, pages, calls };
    total += calls;
  }

  const { maxPlannedSweep } = config.budget;
  if (total > maxPlannedSweep) {
    errors.push(`Planned sweep is ${total} calls, over the ${maxPlannedSweep} limit`);
  }
  return { errors, warnings, budget: { perCity, total, max: maxPlannedSweep } };
}
