import { useEffect, useState } from 'react';
import { useStore } from './store';
import Track from './pages/Track';
import Chart from './pages/Chart';
import History from './pages/History';

type Tab = 'track' | 'chart' | 'history';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'track', label: 'Track', icon: '⏱️' },
  { id: 'chart', label: 'Chart', icon: '📈' },
  { id: 'history', label: 'History', icon: '🗂️' },
];

const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) ? h : 'track';
};

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>(fromHash);

  useEffect(() => {
    if (import.meta.env.DEV) import('./dev/seed').then((m) => m.install(store.replaceData));
  }, [store.replaceData]);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    history.replaceState(null, '', `#${t}`);
    setTab(t);
    scrollTo(0, 0);
  };

  return (
    <div className="app">
      <main className="page">
        {tab === 'track' && <Track store={store} />}
        {tab === 'chart' && <Chart store={store} />}
        {tab === 'history' && <History store={store} />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
