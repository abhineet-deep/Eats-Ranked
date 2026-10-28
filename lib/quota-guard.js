import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { atomicWriteJson } from './fs-utils.js';

export const DEFAULT_LIMIT = 950;
export const DEFAULT_LEDGER = path.join(ROOT, 'data', 'usage.json');

export class QuotaExceededError extends Error {
  constructor(used, limit, month) {
    super(`Monthly call limit reached: ${used}/${limit} used for ${month}. No call was made.`);
    this.name = 'QuotaExceededError';
    this.used = used;
    this.limit = limit;
    this.month = month;
  }
}

/** Calendar month (UTC) as YYYY-MM. */
export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);

/**
 * Local ledger of Google calls, in data/usage.json as { "YYYY-MM": count }.
 *
 * reserve() must be called before every network attempt. It checks the limit, then
 * increments and saves BEFORE the request goes out, so a crash mid-request can only
 * over-count (safe) and never under-count. A corrupt ledger fails closed.
 */
export function createQuotaGuard({ file = DEFAULT_LEDGER, limit = DEFAULT_LIMIT, now = () => new Date() } = {}) {
  function read() {
    if (!fs.existsSync(file)) return {};
    let ledger;
    try {
      ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      ledger = null;
    }
    const valid =
      ledger &&
      typeof ledger === 'object' &&
      !Array.isArray(ledger) &&
      Object.entries(ledger).every(([k, v]) => !/^\d{4}-\d{2}$/.test(k) || (Number.isInteger(v) && v >= 0));
    if (!valid) {
      throw new Error(
        `Usage ledger ${file} is unreadable or invalid, so no calls will be made. ` +
          "Restore it, or recreate it with this month's real count from Google Cloud Console.",
      );
    }
    return ledger;
  }

  const used = () => read()[monthKey(now())] ?? 0;

  return {
    limit,
    used,
    remaining: () => Math.max(0, limit - used()),
    reserve() {
      const ledger = read();
      const month = monthKey(now());
      const count = ledger[month] ?? 0;
      if (count + 1 > limit) throw new QuotaExceededError(count, limit, month);
      ledger[month] = count + 1;
      atomicWriteJson(file, ledger);
      return count + 1;
    },
  };
}
