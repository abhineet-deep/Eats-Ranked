import { budgetLabel, formatDate } from '../lib/format.js';

export default function Footer({ generatedAt, source, usage, onHow }) {
  const date = formatDate(generatedAt);
  const budget = budgetLabel(usage);
  return (
    <footer className="mt-14 border-t border-line">
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-8 text-sm text-muted">
        <p>Ratings data © Google. Not affiliated with or endorsed by Google.</p>
        <p>
          {date ? `Data last refreshed ${date}.` : 'Data freshness unknown.'}{' '}
          <button type="button" onClick={onHow} className="underline underline-offset-4 hover:text-fg">
            How ranking works
          </button>
        </p>
        {budget && <p className="text-xs">{budget}</p>}
        {source === 'mock' && <p className="text-accent">Showing generated sample data, not real places.</p>}
      </div>
    </footer>
  );
}
