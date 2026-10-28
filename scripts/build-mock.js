import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig } from '../lib/config.js';
import { buildRankings } from '../lib/build-output.js';

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/mock-places.json'), 'utf8'));
const config = loadConfig();

const { rankings, stats } = buildRankings(fixture, config, { source: 'mock' });

const out = path.join(ROOT, 'web/public/data/rankings.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(rankings, null, 2) + '\n');

for (const [id, s] of Object.entries(stats)) {
  const city = rankings.cities[id];
  console.log(
    `${city.meta.name}: ${s.rawResults} raw results -> ${s.unique} unique (${s.dupesMerged} dupes merged), ` +
      `${s.droppedNoRating} unrated dropped, ${s.droppedOutside} outside boundary dropped, ${s.kept} ranked, C=${city.meta.averageRating}`,
  );
}
console.log(`Wrote ${out} (mock data)`);
