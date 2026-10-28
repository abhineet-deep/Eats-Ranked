import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSearch, parseFilters } from './filters.js';

/** Loads /data/rankings.json once. Never talks to Google. */
export function useRankings() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/rankings.json`, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!data?.cities || !Object.keys(data.cities).length) throw new Error('rankings.json has no cities');
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

const storedTheme = () => {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
};

/** Follows the system theme until the user flips the toggle; then remembers their choice. */
export function useTheme() {
  const media = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), []);
  const [explicit, setExplicit] = useState(storedTheme);
  const [systemDark, setSystemDark] = useState(media.matches);

  useEffect(() => {
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [media]);

  const dark = explicit ? explicit === 'dark' : systemDark;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = useCallback(() => {
    const next = dark ? 'light' : 'dark';
    setExplicit(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* private mode: the choice just won't persist */
    }
  }, [dark]);

  return { dark, toggle };
}

/** [filters, update]: city/area/cat mirrored into the query string, back button included. */
export function useFilters(rankings) {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPop = () => setSearch(window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const filters = useMemo(() => parseFilters(search, rankings), [search, rankings]);

  const update = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      window.history.pushState(null, '', `?${buildSearch(next)}`);
      setSearch(window.location.search);
    },
    [filters],
  );

  return [filters, update];
}
