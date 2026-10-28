import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuotaExceededError, createQuotaGuard, monthKey } from '../lib/quota-guard.js';

let dir;
let file;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-'));
  file = path.join(dir, 'usage.json');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const at = (iso) => () => new Date(iso);

describe('quota guard', () => {
  it('counts calls and persists them to the ledger', () => {
    const guard = createQuotaGuard({ file, now: at('2026-10-28T10:00:00Z') });
    expect(guard.used()).toBe(0);
    expect(guard.reserve()).toBe(1);
    expect(guard.reserve()).toBe(2);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ '2026-10': 2 });
    // a fresh guard (new process) sees the same count
    expect(createQuotaGuard({ file, now: at('2026-10-28T10:00:00Z') }).used()).toBe(2);
  });

  it('allows exactly 950 calls and throws on the 951st without counting it', () => {
    fs.writeFileSync(file, JSON.stringify({ '2026-10': 949 }));
    const guard = createQuotaGuard({ file, now: at('2026-10-28T00:00:00Z') });
    expect(guard.reserve()).toBe(950);
    expect(() => guard.reserve()).toThrow(QuotaExceededError);
    expect(guard.used()).toBe(950);
    expect(guard.remaining()).toBe(0);
  });

  it('keys the ledger by calendar month', () => {
    fs.writeFileSync(file, JSON.stringify({ '2026-10': 950 }));
    const nov = createQuotaGuard({ file, now: at('2026-11-01T00:00:01Z') });
    expect(nov.used()).toBe(0);
    expect(nov.reserve()).toBe(1);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ '2026-10': 950, '2026-11': 1 });
    expect(monthKey(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });

  it('fails closed on a corrupt or invalid ledger', () => {
    fs.writeFileSync(file, '{not json');
    expect(() => createQuotaGuard({ file }).reserve()).toThrow(/unreadable/);
    fs.writeFileSync(file, JSON.stringify({ [monthKey()]: 'lots' }));
    expect(() => createQuotaGuard({ file }).used()).toThrow(/unreadable or invalid/);
    fs.writeFileSync(file, JSON.stringify({ [monthKey()]: -3 }));
    expect(() => createQuotaGuard({ file }).reserve()).toThrow(/unreadable or invalid/);
  });

  it('honours a custom limit', () => {
    const guard = createQuotaGuard({ file, limit: 2 });
    guard.reserve();
    guard.reserve();
    expect(() => guard.reserve()).toThrow(/2\/2/);
  });
});
