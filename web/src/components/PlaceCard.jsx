import { useState } from 'react';
import { confidence, explainScore, formatReviews } from '../lib/format.js';
import { ChevronIcon, ExternalIcon, PinIcon, StarIcon } from './Icons.jsx';

function Price({ level }) {
  if (!level) return null;
  return (
    <span aria-label={`Price level ${level} of 4`} className="font-medium">
      <span>{'₹'.repeat(level)}</span>
      <span className="text-line">{'₹'.repeat(4 - level)}</span>
    </span>
  );
}

export default function PlaceCard({ entry, m, categoryNames, localityNames, activeCat, activeArea, index }) {
  const [open, setOpen] = useState(false);
  const top = entry.rank <= 3;
  const conf = confidence(entry.reviews, m);
  const category = categoryNames[activeCat] ?? categoryNames[entry.categories[0]];
  const areaId = activeArea || entry.localities[0];
  const extraAreas = activeArea ? 0 : entry.localities.length - 1;

  return (
    <article
      className={`animate-rise rounded-2xl border bg-surface ${top ? 'border-accent/50' : 'border-line'}`}
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left sm:gap-4"
      >
        <span
          className={`w-10 shrink-0 text-center font-display text-3xl font-semibold leading-none sm:w-12 sm:text-4xl ${
            top ? 'text-accent' : 'text-muted/60'
          }`}
        >
          {entry.rank}
        </span>

        <span className="block min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold leading-snug">{entry.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {category && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{category}</span>
            )}
            {areaId && (
              <span className="inline-flex items-center gap-1">
                <PinIcon width={13} height={13} />
                {localityNames[areaId] ?? areaId}
                {extraAreas > 0 && <span className="text-xs">+{extraAreas}</span>}
              </span>
            )}
          </span>

          <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold">
              <StarIcon width={14} height={14} className="text-accent" />
              {entry.rating.toFixed(1)}
            </span>
            <span className="text-muted">{formatReviews(entry.reviews)} reviews</span>
            <Price level={entry.priceLevel} />
          </span>

          <span className="mt-3 flex items-center gap-2" title="How much of the score comes from this place's own rating rather than the city average">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line sm:w-32">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(conf * 100)}%` }} />
            </span>
            <span className="text-xs text-muted">{Math.round(conf * 100)}% confidence</span>
          </span>
        </span>

        <ChevronIcon className={`mt-1 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className="expander" data-open={open}>
        <div className="overflow-hidden">
          <div className="space-y-2 px-4 pb-1 pl-[3.75rem] text-sm sm:pl-[4.75rem]">
            {entry.address && <p className="text-muted">{entry.address}</p>}
            <p className="font-medium">{explainScore(entry)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pl-[3.75rem] pt-2 sm:pl-[4.75rem]">
        <a
          href={entry.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Open in Google Maps <ExternalIcon width={13} height={13} />
        </a>
      </div>
    </article>
  );
}
