import { describe, expect, it } from 'vitest';
import { mergeRankings } from '../lib/build-output.js';

const city = (id, tag) => ({ meta: { id }, cityTop: [{ name: tag }] });
const file = (source, cities, generatedAt = 'x') => ({ generatedAt, source, cities });

describe('mergeRankings', () => {
  it('keeps the other city when only one is refreshed', () => {
    const existing = file('google', { blr: city('blr', 'old-blr'), ggn: city('ggn', 'old-ggn') }, 'old');
    const fresh = file('google', { ggn: city('ggn', 'new-ggn') }, 'new');
    const merged = mergeRankings(existing, fresh, ['blr', 'ggn']);
    expect(Object.keys(merged.cities)).toEqual(['blr', 'ggn']);
    expect(merged.cities.blr.cityTop[0].name).toBe('old-blr');
    expect(merged.cities.ggn.cityTop[0].name).toBe('new-ggn');
    expect(merged).toMatchObject({ generatedAt: 'new', source: 'google' });
  });

  it('never mixes mock data into a real file', () => {
    const existing = file('mock', { blr: city('blr', 'mock-blr'), ggn: city('ggn', 'mock-ggn') });
    const merged = mergeRankings(existing, file('google', { blr: city('blr', 'real-blr') }), ['blr', 'ggn']);
    expect(Object.keys(merged.cities)).toEqual(['blr']);
    expect(merged.source).toBe('google');
  });

  it('works with no existing file', () => {
    expect(Object.keys(mergeRankings(null, file('google', { ggn: city('ggn', 'g') }), ['blr', 'ggn']).cities)).toEqual(['ggn']);
  });
});
