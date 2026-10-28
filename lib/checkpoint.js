import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { atomicWriteJson } from './fs-utils.js';

/**
 * Resumable sweep state.
 *
 * Raw Google responses live in data/raw/<city>/<locality>/<category>-p<n>.json, written atomically
 * right after each call. A job counts as done when its raw file exists, so even a crash between
 * saving the response and updating checkpoint.json cannot cause a repeat call.
 * data/checkpoint.json is the human-readable record of completed jobs.
 */
export function createCheckpoint({
  file = path.join(ROOT, 'data', 'checkpoint.json'),
  rawDir = path.join(ROOT, 'data', 'raw'),
  now = () => new Date(),
} = {}) {
  const keyOf = (j) => `${j.city}/${j.locality}/${j.category}/p${j.page}`;
  const rawPath = (j) => path.join(rawDir, j.city, j.locality, `${j.category}-p${j.page}.json`);

  function readState() {
    if (!fs.existsSync(file)) return { completed: {} };
    try {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (s && typeof s.completed === 'object') return s;
    } catch {
      /* fall through */
    }
    throw new Error(`Checkpoint ${file} is unreadable. Fix or delete it (raw files in ${rawDir} still protect finished jobs).`);
  }

  return {
    keyOf,
    rawPath,
    isDone: (job) => fs.existsSync(rawPath(job)),
    loadRaw: (job) => JSON.parse(fs.readFileSync(rawPath(job), 'utf8')),
    saveRaw: (job, response) => atomicWriteJson(rawPath(job), response),
    markDone(job, info = {}) {
      const state = readState();
      state.completed[keyOf(job)] = { at: now().toISOString(), ...info };
      atomicWriteJson(file, state);
    },
    completedCount: () => Object.keys(readState().completed).length,

    /** --fresh: forget finished jobs and delete saved raw responses for the given cities only. */
    reset(cityIds) {
      const state = readState();
      for (const city of cityIds) {
        fs.rmSync(path.join(rawDir, city), { recursive: true, force: true });
        for (const k of Object.keys(state.completed)) {
          if (k.startsWith(`${city}/`)) delete state.completed[k];
        }
      }
      atomicWriteJson(file, state);
    },

    /** Every saved response for the given cities as { city, locality, category, page, response }. */
    listGroups(cityIds) {
      const groups = [];
      for (const city of cityIds) {
        const cityDir = path.join(rawDir, city);
        if (!fs.existsSync(cityDir)) continue;
        for (const locality of fs.readdirSync(cityDir)) {
          const locDir = path.join(cityDir, locality);
          for (const name of fs.readdirSync(locDir)) {
            const m = /^(.+)-p(\d+)\.json$/.exec(name);
            if (!m) continue;
            groups.push({
              city,
              locality,
              category: m[1],
              page: Number(m[2]),
              response: JSON.parse(fs.readFileSync(path.join(locDir, name), 'utf8')),
            });
          }
        }
      }
      return groups;
    },
  };
}
