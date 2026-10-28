import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronIcon, PinIcon } from './Icons.jsx';

const ALL = { id: '', name: 'All areas' };

/** Searchable single-select (combobox pattern). `localities` is [{ id, name, placeCount }]. */
export default function LocalitySelect({ localities, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const options = useMemo(() => {
    const t = query.trim().toLowerCase();
    const all = [ALL, ...localities.filter((l) => l.placeCount > 0)];
    return t ? all.filter((o) => o.name.toLowerCase().includes(t)) : all;
  }, [localities, query]);

  const current = localities.find((l) => l.id === value) ?? ALL;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openMenu = () => {
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  };
  const choose = (option) => {
    onChange(option.id);
    setOpen(false);
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm"
      >
        <PinIcon className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
        <ChevronIcon className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-fade absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search areas…"
            role="combobox"
            aria-expanded="true"
            aria-controls="locality-options"
            aria-activedescendant={options[active] ? `locality-opt-${options[active].id || 'all'}` : undefined}
            className="w-full border-b border-line bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted"
          />
          <ul ref={listRef} id="locality-options" role="listbox" aria-label="Areas" className="max-h-64 overflow-y-auto py-1">
            {options.map((o, i) => (
              <li
                key={o.id || 'all'}
                id={`locality-opt-${o.id || 'all'}`}
                role="option"
                aria-selected={o.id === value}
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onPointerEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  i === active ? 'bg-accent-soft' : ''
                } ${o.id === value ? 'font-semibold text-accent' : ''}`}
              >
                <span>{o.name}</span>
                {o.placeCount != null && <span className="text-xs text-muted">{o.placeCount}</span>}
              </li>
            ))}
            {options.length === 0 && <li className="px-3 py-3 text-sm text-muted">No areas match “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
