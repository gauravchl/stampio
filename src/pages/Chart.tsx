import { useEffect, useState } from 'react';
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Tooltip,
  type ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import { format, startOfDay, subDays } from 'date-fns';
import type { Store } from '../store';
import Header from '../components/Header';
import { displayColor, useTheme, type Theme } from '../theme';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip);
ChartJS.defaults.font.family = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

const RANGES = [
  { id: '7', label: '7D', days: 7 },
  { id: '30', label: '30D', days: 30 },
  { id: '90', label: '90D', days: 90 },
  { id: 'all', label: 'All', days: Infinity },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const CHART_THEME: Record<Theme, { text: string; grid: string; surface: string; tipBg: string; tipBorder: string; tipText: string }> = {
  light: { text: '#6b7280', grid: 'rgba(0,0,0,0.07)', surface: '#ffffff', tipBg: '#ffffff', tipBorder: '#e3e5ea', tipText: '#111318' },
  dark: { text: '#9aa3b2', grid: 'rgba(255,255,255,0.06)', surface: '#171a21', tipBg: '#232733', tipBorder: '#2e3340', tipText: '#e8eaee' },
};

const SEL_KEY = 'timestamp-app:chart';
const minutesOfDay = (ts: number) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};
const hhmm = (m: number) => {
  const r = Math.round(m) % 1440;
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
};
/** Circular mean so 23:50 and 00:10 average to 00:00, not noon. */
const meanTime = (mins: number[]) => {
  let x = 0, y = 0;
  for (const m of mins) {
    const a = (m / 1440) * 2 * Math.PI;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  const a = Math.atan2(y, x);
  return (((a / (2 * Math.PI)) * 1440) + 1440) % 1440;
};

function loadSel(): { hidden: string[]; range: RangeId } {
  try {
    const v = JSON.parse(localStorage.getItem(SEL_KEY) ?? '');
    if (Array.isArray(v.hidden)) return v;
  } catch {
    // ignore
  }
  return { hidden: [], range: '30' };
}

export default function Chart({ store }: { store: Store }) {
  const { activities, entries } = store.data;
  const [sel, setSel] = useState(loadSel);
  const { theme } = useTheme();
  const t = CHART_THEME[theme];
  useEffect(() => {
    try { localStorage.setItem(SEL_KEY, JSON.stringify(sel)); } catch { /* ignore */ }
  }, [sel]);

  const hidden = new Set(sel.hidden);
  const shown = activities.filter((a) => !hidden.has(a.id));
  const days = RANGES.find((r) => r.id === sel.range)!.days;
  const since = days === Infinity ? 0 : startOfDay(subDays(new Date(), days - 1)).getTime();

  const series = shown.map((a) => ({
    activity: a,
    pts: entries.filter((e) => e.activityId === a.id && e.ts >= since).sort((p, q) => p.ts - q.ts),
  }));

  const total = series.reduce((n, s) => n + s.pts.length, 0);

  const chartData = {
    datasets: series.map(({ activity: a, pts }) => {
      const color = displayColor(a.color, theme);
      return {
        label: a.name,
        data: pts.map((e) => ({ x: startOfDay(e.ts).getTime() + 12 * 3600_000, y: minutesOfDay(e.ts), ts: e.ts })),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
        pointHitRadius: 14,
        tension: 0.25,
      };
    }),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.tipBg,
        borderColor: t.tipBorder,
        borderWidth: 1,
        titleColor: t.tipText,
        bodyColor: t.tipText,
        padding: 10,
        callbacks: {
          title: (items) => format((items[0].raw as { ts: number }).ts, 'EEE, MMM d'),
          label: (item) => ` ${item.dataset.label}  ${format((item.raw as { ts: number }).ts, 'HH:mm')}`,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: days <= 7 ? 'day' : days <= 30 ? 'week' : 'month', displayFormats: { day: 'EEE d', week: 'MMM d', month: 'MMM' } },
        min: since || undefined,
        max: startOfDay(new Date()).getTime() + 86_400_000,
        grid: { color: t.grid },
        border: { display: false },
        ticks: { color: t.text, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        reverse: true,
        min: 0,
        max: 1440,
        ticks: { color: t.text, stepSize: 180, callback: (v) => hhmm(Number(v)) },
        grid: { color: t.grid },
        border: { display: false },
      },
    },
  };

  const toggle = (id: string) =>
    setSel((s) => ({
      ...s,
      hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id],
    }));

  return (
    <>
      <Header title="Chart" sub="Time of day each activity was logged" />

      <div className="segmented">
        {RANGES.map((r) => (
          <button key={r.id} className={sel.range === r.id ? 'on' : ''} onClick={() => setSel((s) => ({ ...s, range: r.id }))}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="chips">
        {activities.map((a) => (
          <button key={a.id} className={`chip ${hidden.has(a.id) ? 'off' : ''}`} onClick={() => toggle(a.id)}>
            <span className="dot" style={{ background: displayColor(a.color, theme) }} />
            {a.emoji} {a.name}
          </button>
        ))}
      </div>

      <div className="card chart-card">
        {total === 0 ? (
          <div className="empty">
            {shown.length === 0 ? 'Select an activity above to plot it.' : 'No timestamps in this range yet. Log some on the Track tab.'}
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>

      {shown.length > 0 && (
        <div className="card">
          <table className="summary">
            <thead>
              <tr><th>Activity</th><th>Logs</th><th>Avg time</th><th>Earliest</th><th>Latest</th></tr>
            </thead>
            <tbody>
              {series.map(({ activity: a, pts }) => {
                const mins = pts.map((e) => minutesOfDay(e.ts));
                return (
                  <tr key={a.id}>
                    <td><span className="dot" style={{ background: displayColor(a.color, theme) }} /> {a.name}</td>
                    <td>{pts.length}</td>
                    <td>{mins.length ? hhmm(meanTime(mins)) : '–'}</td>
                    <td>{mins.length ? hhmm(Math.min(...mins)) : '–'}</td>
                    <td>{mins.length ? hhmm(Math.max(...mins)) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
