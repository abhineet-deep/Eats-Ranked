/** Human-readable end-of-sweep report for scripts/refresh.js. */
export function formatSummary({ config, cityIds, sweep, cleanStats, used, limit, free, elapsedMs }) {
  const seconds = Math.round(elapsedMs / 1000);
  const time = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
  const lines = [
    '',
    '=== Refresh summary ===',
    `Time taken:            ${time}`,
    `Calls made this run:   ${sweep.calls} (${sweep.reused} jobs reused from saved results)`,
    `Calls used this month: ${used}/${free} free (hard stop at ${limit})`,
  ];
  for (const id of cityIds) {
    const s = cleanStats[id];
    lines.push(
      '',
      `${config.cities[id].name}:`,
      `  places found (unique):         ${s.unique}`,
      `  duplicates merged:             ${s.dupesMerged} (of ${s.rawResults} raw results)`,
      `  dropped, outside boundary:     ${s.droppedOutside}`,
      `  dropped, no rating/reviews:    ${s.droppedNoRating}`,
      `  ranked:                        ${s.kept}`,
    );
  }
  return lines.join('\n');
}
