import { useEffect, useRef } from 'react';
import { bayes } from '../lib/format.js';
import { CloseIcon } from './Icons.jsx';

export default function HowItWorksModal({ meta, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const C = meta.averageRating;
  const m = meta.m.cityTop;
  const a = { rating: 4.9, reviews: 40 };
  const b = { rating: 4.4, reviews: 8000 };
  const sa = bayes(a.rating, a.reviews, C, m);
  const sb = bayes(b.rating, b.reviews, C, m);

  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="how-title" className="font-display text-2xl font-semibold">
            How ranking works
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-fg">
            <CloseIcon />
          </button>
        </div>

        <p className="mt-3 text-muted">
          A 5.0 from three friends isn’t as trustworthy as a 4.5 from ten thousand strangers. So instead of sorting by raw rating, each place gets a
          score that starts at the city average and moves toward the place’s own rating as reviews pile up.
        </p>

        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-center font-mono text-sm text-accent">
          score = v/(v+m) × R + m/(v+m) × C
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          <li>
            <b className="text-fg">R</b> the place’s Google rating
          </li>
          <li>
            <b className="text-fg">v</b> how many Google reviews it has
          </li>
          <li>
            <b className="text-fg">C</b> the average rating of all places in {meta.name} ({C.toFixed(2)})
          </li>
          <li>
            <b className="text-fg">m</b> how many reviews it takes to be taken at face value: {meta.m.cityTop} for the city list, {meta.m.lists} for
            area and category lists
          </li>
        </ul>

        <h3 className="mt-5 font-medium">Example, city list</h3>
        <p className="mt-1 text-sm text-muted">
          {a.rating}★ from {a.reviews} reviews scores <b className="text-fg">{sa.toFixed(2)}</b>. {b.rating}★ from {b.reviews.toLocaleString('en-IN')}{' '}
          reviews scores <b className="text-fg">{sb.toFixed(2)}</b>, so the second ranks higher.
        </p>
        <p className="mt-4 text-xs text-muted">
          The “confidence” bar on each card is v/(v+m): how much of the score comes from the place itself rather than the city average.
        </p>
      </div>
    </div>
  );
}
