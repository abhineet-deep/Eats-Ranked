import CitySwitcher from './CitySwitcher.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function Header({ cities = [], city, onCity, dark, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <a href="?" className="font-display text-xl font-semibold tracking-tight">
          Eats<span className="text-accent"> Ranked</span>
        </a>
        <div className="flex items-center gap-2">
          {cities.length > 0 && <CitySwitcher cities={cities} value={city} onChange={onCity} />}
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
