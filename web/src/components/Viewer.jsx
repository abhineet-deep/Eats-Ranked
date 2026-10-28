import { useMemo, useState } from 'react';
import { selectList } from '../lib/filters.js';
import { useFilters } from '../lib/hooks.js';
import Filters from './Filters.jsx';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
import Hero from './Hero.jsx';
import HowItWorksModal from './HowItWorksModal.jsx';
import PlaceCard from './PlaceCard.jsx';
import { EmptyState } from './States.jsx';

export default function Viewer({ rankings, dark, onToggleTheme }) {
  const [filters, update] = useFilters(rankings);
  const [query, setQuery] = useState('');
  const [showHow, setShowHow] = useState(false);

  const cityData = rankings.cities[filters.city];
  const { meta } = cityData;
  const { entries, m, size } = selectList(cityData, filters);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;
  }, [entries, query]);

  const names = useMemo(
    () => ({
      categories: Object.fromEntries(meta.categories.map((c) => [c.id, c.shortLabel ?? c.label])),
      localities: Object.fromEntries(meta.localities.map((l) => [l.id, l.name])),
    }),
    [meta],
  );

  const cities = useMemo(() => Object.values(rankings.cities).map((c) => ({ id: c.meta.id, name: c.meta.name })), [rankings]);

  const areaName = filters.area ? names.localities[filters.area] : 'All areas';
  const catName = filters.cat ? names.categories[filters.cat] : 'All categories';
  const partial = entries.length > 0 && entries.length < size;
  const listKey =`${filters.city}|${filters.area}|${filters.cat}`;

  return (
    <>
      <Header
        cities={cities}
        city={filters.city}
        onCity={(city) => update({ city, area: '' })}
        dark={dark}
        onToggleTheme={onToggleTheme}
      />
      <main className="mx-auto max-w-3xl px-4 pb-4">
        <Hero meta={meta} generatedAt={meta.generatedAt ?? rankings.generatedAt} onHow={() => setShowHow(true)} />
        <Filters meta={meta} filters={filters} onChange={update} query={query} onQuery={setQuery} />

        <div className="mt-8 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Top {size}</h2>
            <p className="text-sm text-muted">
              {areaName} · {catName}
            </p>
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {shown.length} {shown.length === 1 ? 'place' : 'places'}
          </p>
        </div>

        {partial && (
          <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
            Only {entries.length} {entries.length === 1 ? 'place' : 'places'} here met the bar (at least 3.5★ and a Google rating), so this list is
            shorter than {size}.
          </p>
        )}

        <div key={listKey} className="mt-4 space-y-3">
          {shown.length === 0 ? (
            <EmptyState
              query={query.trim()}
              onClearQuery={() => setQuery('')}
              onResetFilters={() => update({ area: '', cat: '' })}
            />
          ) : (
            shown.map((entry, i) => (
              <PlaceCard
                key={entry.id}
                entry={entry}
                index={i}
                m={m}
                categoryNames={names.categories}
                localityNames={names.localities}
                activeCat={filters.cat}
                activeArea={filters.area}
              />
            ))
          )}
        </div>
      </main>
      <Footer generatedAt={meta.generatedAt ?? rankings.generatedAt} source={rankings.source} usage={rankings.usage} onHow={() => setShowHow(true)} />
      {showHow && <HowItWorksModal meta={meta} onClose={() => setShowHow(false)} />}
    </>
  );
}
