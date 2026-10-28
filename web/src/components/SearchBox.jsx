import { CloseIcon, SearchIcon } from './Icons.jsx';

export default function SearchBox({ value, onChange }) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search this list by name"
        aria-label="Search this list by name"
        className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-9 text-sm outline-none placeholder:text-muted focus:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
