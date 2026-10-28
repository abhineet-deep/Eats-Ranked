import Header from './components/Header.jsx';
import { ErrorState, LoadingState } from './components/States.jsx';
import Viewer from './components/Viewer.jsx';
import { useRankings, useTheme } from './lib/hooks.js';

export default function App() {
  const rankings = useRankings();
  const { dark, toggle } = useTheme();

  if (rankings.status === 'ready') {
    return <Viewer rankings={rankings.data} dark={dark} onToggleTheme={toggle} />;
  }
  return (
    <>
      <Header dark={dark} onToggleTheme={toggle} />
      {rankings.status === 'loading' ? <LoadingState /> : <ErrorState message={rankings.message} />}
    </>
  );
}
