export default function CategoryChips({ categories, value, onChange }) {
  const chips = [{ id: '', shortLabel: 'All' }, ...categories];
  return (
    <div role="radiogroup" aria-label="Category" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {chips.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id || 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-muted hover:text-fg'
            }`}
          >
            {c.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
