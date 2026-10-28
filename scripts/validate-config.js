import { loadConfig, validateConfig } from '../lib/config.js';

const config = loadConfig();
const { errors, warnings, budget } = validateConfig(config);

console.log('Call budget (localities x categories x pages):');
for (const [id, c] of Object.entries(budget.perCity)) {
  console.log(`  ${id.padEnd(4)} ${c.name.padEnd(10)} ${c.localities} x ${c.categories} x ${c.pages} = ${c.calls}`);
}
console.log(`  total ${budget.total} calls per full sweep (limit ${budget.max}, free tier ${config.budget.monthlyFree}/month)\n`);

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
  console.log();
}
if (errors.length) {
  console.error(`FAILED with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log('Config OK');
