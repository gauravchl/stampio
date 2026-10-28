import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { useStore } from './store';
import Track from './pages/Track';
import Chart from './pages/Chart';
import History from './pages/History';
import Settings from './pages/Settings';
import { HistoryIcon, SettingsIcon, TodayIcon, TrendsIcon } from './components/Icons';

type Tab = 'today' | 'trends' | 'history' | 'settings';
const TABS: { id: Tab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'today', label: 'Today', Icon: TodayIcon },
  { id: 'trends', label: 'Trends', Icon: TrendsIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) ? h : 'today';
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
    if (t === tab) {
      scrollTo({ top: 0, behavior: 'smooth' }); // tapping the active tab scrolls to top, as on iOS
      return;
    }
    history.replaceState(null, '', `#${t}`);
    setTab(t);
    scrollTo(0, 0);
  };

  return (
    <div className="app">
      <main className="page" key={tab}>
        {tab === 'today' && <Track store={store} />}
        {tab === 'trends' && <Chart store={store} />}
        {tab === 'history' && <History store={store} />}
        {tab === 'settings' && <Settings store={store} />}
      </main>
      <nav className="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon width={25} height={25} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
