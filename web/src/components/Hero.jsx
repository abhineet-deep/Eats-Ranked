import { timeAgo } from '../lib/format.js';

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl font-semibold">{value}</dd>
    </div>
  );
}

export default function Hero({ meta, generatedAt, onHow }) {
  return (
    <section className="animate-fade pt-8 pb-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">The ranked guide</p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Top {meta.listSizes.cityTop} in {meta.name}
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        Ranked by rating <em>and</em> how many people agree. A 4.4 from thousands of reviews beats a 4.9 from a handful.{' '}
        <button type="button" onClick={onHow} className="font-medium text-accent underline underline-offset-4">
          How ranking works
        </button>
      </p>
      <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-line py-4">
        <Stat label="Places ranked" value={meta.placeCount.toLocaleString('en-IN')} />
        <Stat label="City average" value={`${meta.averageRating.toFixed(2)}★`} />
        <Stat label="Updated" value={<span className="text-lg">{timeAgo(generatedAt) || '—'}</span>} />
      </dl>
    </section>
  );
}
