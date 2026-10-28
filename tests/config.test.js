import { describe, expect, it } from 'vitest';
import { loadConfig, validateConfig, rectToPolygon } from '../lib/config.js';

const config = loadConfig();

describe('config', () => {
  it('has the 5 categories with required fields', () => {
    expect(config.categories.map((c) => c.id)).toEqual(['premium', 'cafe', 'pub', 'club', 'eatery']);
    for (const c of config.categories) {
      expect(c).toMatchObject({ id: expect.any(String), textQuery: expect.any(String), minRating: 3.5 });
    }
    expect(config.m).toEqual({ cityTop: 500, lists: 150 });
    expect(config.listSizes).toEqual({ cityTop: 50, lists: 15 });
  });

  it('has 35 Bangalore and 20 Gurgaon localities', () => {
    expect(config.cities.blr.localities).toHaveLength(35);
    expect(config.cities.ggn.localities).toHaveLength(20);
  });

  it('validates with no errors and a 550 call budget', () => {
    const { errors, budget } = validateConfig(config);
    expect(errors).toEqual([]);
    expect(budget.total).toBe(550);
    expect(budget.perCity.blr.calls).toBe(350);
    expect(budget.perCity.ggn.calls).toBe(200);
  });

  it('fails when the budget exceeds 600 calls', () => {
    const over = structuredClone(config);
    over.pagesPerQuery = 3;
    expect(validateConfig(over).errors.some((e) => e.includes('over the 600 limit'))).toBe(true);
  });

  it('flags a rectangle outside its city boundary', () => {
    const bad = structuredClone(config);
    bad.cities.blr.localities[0].rectangle = {
      low: { latitude: 28.4, longitude: 77.0 },
      high: { latitude: 28.41, longitude: 77.01 },
    };
    expect(validateConfig(bad).errors.some((e) => e.includes('not fully inside'))).toBe(true);
  });

  it('flags an inverted rectangle', () => {
    const bad = structuredClone(config);
    const loc = bad.cities.ggn.localities[0];
    [loc.rectangle.low, loc.rectangle.high] = [loc.rectangle.high, loc.rectangle.low];
    expect(validateConfig(bad).errors.some((e) => e.includes('south-west'))).toBe(true);
  });

  it('builds a closed polygon from a rectangle', () => {
    const poly = rectToPolygon(config.cities.blr.localities[0].rectangle);
    expect(poly.geometry.coordinates[0]).toHaveLength(5);
  });
});
