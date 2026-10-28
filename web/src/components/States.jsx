export function LoadingState() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pt-10" aria-busy="true" aria-label="Loading rankings">
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-line/60" />
      ))}
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 text-center" role="alert">
      <p className="font-display text-3xl font-semibold">No rankings yet</p>
      <p className="mt-3 text-muted">
        The rankings file <code className="rounded bg-line px-1.5 py-0.5 text-sm text-fg">data/rankings.json</code> is missing or unreadable.
      </p>
      <p className="mt-3 text-muted">
        Run <code className="rounded bg-line px-1.5 py-0.5 text-sm text-fg">npm run refresh</code> to build it from Google, or{' '}
        <code className="rounded bg-line px-1.5 py-0.5 text-sm text-fg">npm run build-mock</code> for sample data.
      </p>
      {message && <p className="mt-4 text-xs text-muted">({message})</p>}
    </div>
  );
}

export function EmptyState({ query, onClearQuery, onResetFilters }) {
  return (
    <div className="animate-fade rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-xl font-semibold">{query ? `Nothing matches “${query}”` : 'No ranked places here yet'}</p>
      <p className="mt-2 text-sm text-muted">
        {query ? 'Try a shorter name, or clear the search.' : 'This area and category combination has no places in the data.'}
      </p>
      <button
        type="button"
        onClick={query ? onClearQuery : onResetFilters}
        className="mt-5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent"
      >
        {query ? 'Clear search' : 'Reset filters'}
      </button>
    </div>
  );
}
