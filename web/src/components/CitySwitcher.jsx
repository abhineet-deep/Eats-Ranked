export default function CitySwitcher({ cities, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="City" className="flex rounded-full border border-line bg-surface p-0.5">
      {cities.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg'
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
