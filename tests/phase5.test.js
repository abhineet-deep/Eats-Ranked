import { describe, expect, it } from 'vitest';
import { buildRankings, mergeRankings } from '../lib/build-output.js';
import { loadConfig } from '../lib/config.js';
import { formatSummary } from '../lib/summary.js';
import { budgetLabel } from '../web/src/lib/format.js';

const config = loadConfig();
const usage = { month: '2026-10', callsUsed: 560, monthlyFree: 1000, lastSweepAt: '2026-10-28T00:00:00.000Z' };

describe('budgetLabel', () => {
  it('shows used/free for the current month', () => {
    expect(budgetLabel(usage, new Date('2026-10-30T00:00:00Z'))).toBe('API budget: 560/1000 used this month');
  });
  it('labels a snapshot from an earlier month', () => {
    expect(budgetLabel(usage, new Date('2026-11-02T00:00:00Z'))).toBe('API budget: 560/1000 used in 2026-10 (last sweep)');
  });
  it('is empty without usage data (mock file)', () => {
    expect(budgetLabel(undefined)).toBe('');
    expect(budgetLabel({})).toBe('');
  });
});

describe('usage in rankings.json', () => {
  it('buildRankings writes usage only when given', () => {
    expect(buildRankings([], config, { usage }).rankings.usage).toEqual(usage);
    expect(buildRankings([], config).rankings).not.toHaveProperty('usage');
  });

  it('merge takes the fresh usage, and keeps the old one if a fresh build has none', () => {
    const old = { generatedAt: 'a', source: 'google', usage, cities: { blr: {} } };
    const newer = { callsUsed: 700, month: '2026-10', monthlyFree: 1000 };
    expect(mergeRankings(old, { generatedAt: 'b', source: 'google', usage: newer, cities: { ggn: {} } }, ['blr', 'ggn']).usage).toEqual(newer);
    expect(mergeRankings(old, { generatedAt: 'b', source: 'google', cities: { ggn: {} } }, ['blr', 'ggn']).usage).toEqual(usage);
  });

  it('merge drops usage that belonged to a mock file', () => {
    const mock = { generatedAt: 'a', source: 'mock', cities: { blr: {} } };
    expect(mergeRankings(mock, { generatedAt: 'b', source: 'google', cities: { blr: {} } }).usage).toBeUndefined();
  });
});

describe('formatSummary', () => {
  const cleanStats = {
    blr: { rawResults: 900, unique: 780, dupesMerged: 120, droppedOutside: 14, droppedNoRating: 9, kept: 757 },
  };
  const text = formatSummary({
    config,
    cityIds: ['blr'],
    sweep: { calls: 312, reused: 3 },
    cleanStats,
    used: 312,
    limit: 950,
    free: 1000,
    elapsedMs: 185_000,
  });

  it('reports calls, time and the per-city numbers', () => {
    expect(text).toContain('Time taken:            3m 5s');
    expect(text).toContain('Calls made this run:   312 (3 jobs reused');
    expect(text).toContain('Calls used this month: 312/1000 free (hard stop at 950)');
    expect(text).toContain('Bangalore:');
    expect(text).toMatch(/places found \(unique\):\s+780/);
    expect(text).toMatch(/duplicates merged:\s+120 \(of 900 raw results\)/);
    expect(text).toMatch(/outside boundary:\s+14/);
    expect(text).toMatch(/ranked:\s+757/);
  });
});
