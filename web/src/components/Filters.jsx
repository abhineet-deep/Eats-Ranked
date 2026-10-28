import CategoryChips from './CategoryChips.jsx';
import LocalitySelect from './LocalitySelect.jsx';
import SearchBox from './SearchBox.jsx';

export default function Filters({ meta, filters, onChange, query, onQuery }) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <LocalitySelect localities={meta.localities} value={filters.area} onChange={(area) => onChange({ area })} />
        <div className="sm:flex-1">
          <SearchBox value={query} onChange={onQuery} />
        </div>
      </div>
      <CategoryChips categories={meta.categories} value={filters.cat} onChange={(cat) => onChange({ cat })} />
    </div>
  );
}
