/** 12400 -> "12.4k", 8000 -> "8k", 950 -> "950". */
export function formatReviews(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n < 1000) return String(n);
  const k = n / 1000;
  const s = k < 100 ? k.toFixed(1) : String(Math.round(k));
  return `${s.replace(/\.0$/, '')}k`;
}

/** "today", "3 days ago", "2 months ago". Empty string if the date is unusable. */
export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((now - t) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 60) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Footer budget text from rankings.usage, e.g. "API budget: 560/1000 used this month".
 * The count is a snapshot from the last sweep, so a different month is labelled as such.
 */
export function budgetLabel(usage, now = new Date()) {
  if (!usage || !Number.isFinite(usage.callsUsed)) return '';
  const total = usage.monthlyFree ?? 1000;
  const current = now.toISOString().slice(0, 7);
  const when = usage.month === current ? 'this month' : `in ${usage.month} (last sweep)`;
  return `API budget: ${usage.callsUsed}/${total} used ${when}`;
}

/** Share of the score that comes from the place's own rating (v / (v + m)), 0..1. */
export function confidence(reviews, m) {
  return reviews / (reviews + m);
}

/** One-line score explanation shown when a card is expanded. */
export function explainScore(entry) {
  return `${entry.rating.toFixed(1)}★ from ${entry.reviews.toLocaleString('en-IN')} reviews → score ${entry.score.toFixed(2)}`;
}

// Same formula as lib/rank.js; duplicated because the web app can't import from outside web/.
export function bayes(rating, reviews, cityMean, m) {
  return (reviews / (reviews + m)) * rating + (m / (reviews + m)) * cityMean;
}
