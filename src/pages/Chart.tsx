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
import { CheckIcon } from '../components/Icons';
import { displayColor, useTheme, type Theme } from '../theme';
import { fmtMinutes, fmtTime, hourLabel, minuteParts } from '../format';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip);
ChartJS.defaults.font.family = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif';

const RANGES = [
  { id: '7', label: 'W', days: 7, name: 'week' },
  { id: '30', label: 'M', days: 30, name: 'month' },
  { id: '90', label: '3M', days: 90, name: '3 months' },
  { id: 'all', label: 'All', days: Infinity, name: 'all time' },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const CHART_THEME: Record<Theme, { text: string; grid: string; surface: string; tipBg: string; tipBorder: string; tipText: string; tipSub: string }> = {
  light: { text: 'rgba(60,60,67,0.6)', grid: 'rgba(60,60,67,0.12)', surface: '#ffffff', tipBg: '#ffffff', tipBorder: 'rgba(60,60,67,0.18)', tipText: '#000000', tipSub: 'rgba(60,60,67,0.6)' },
  dark: { text: 'rgba(235,235,245,0.6)', grid: 'rgba(235,235,245,0.14)', surface: '#1c1c1e', tipBg: '#2c2c2e', tipBorder: 'rgba(84,84,88,0.65)', tipText: '#ffffff', tipSub: 'rgba(235,235,245,0.6)' },
};

const SEL_KEY = 'timestamp-app:chart';
const minutesOfDay = (ts: number) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
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
    if (Array.isArray(v.hidden) && RANGES.some((r) => r.id === v.range)) return v;
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
  const range = RANGES.find((r) => r.id === sel.range)!;
  const days = range.days;
  const todayStart = startOfDay(new Date()).getTime();
  const firstTs = entries.reduce((m, e) => Math.min(m, e.ts), Infinity);
  const since = days === Infinity
    ? (Number.isFinite(firstTs) ? startOfDay(firstTs).getTime() : todayStart)
    : startOfDay(subDays(new Date(), days - 1)).getTime();

  const all = activities.map((a) => {
    const pts = entries.filter((e) => e.activityId === a.id && e.ts >= since).sort((p, q) => p.ts - q.ts);
    const mins = pts.map((e) => minutesOfDay(e.ts));
    return { activity: a, pts, mins, color: displayColor(a.color, theme) };
  });
  const series = all.filter((s) => !hidden.has(s.activity.id));
  const total = series.reduce((n, s) => n + s.pts.length, 0);

  // Headline above the chart, like Health: one activity shows its average time, several show a count.
  const single = series.length === 1 && series[0].mins.length ? series[0] : null;
  const avg = single ? minuteParts(meanTime(single.mins)) : null;
  const sameYear = new Date(since).getFullYear() === new Date().getFullYear();
  const rangeLabel = `${format(since, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(new Date(), 'MMM d, yyyy')}`;

  const chartData = {
    datasets: series.map(({ activity: a, pts, color }) => ({
      label: a.name,
      data: pts.map((e) => ({ x: startOfDay(e.ts).getTime() + 12 * 3600_000, y: minutesOfDay(e.ts), ts: e.ts })),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: days <= 30 ? 3.5 : 2.5,
      pointHoverRadius: 6,
      pointBorderColor: t.surface,
      pointBorderWidth: 1.5,
      pointHitRadius: 14,
      tension: 0.2,
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
    layout: { padding: { top: 6, left: 2 } },
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.tipBg,
        borderColor: t.tipBorder,
        borderWidth: 0.5,
        titleColor: t.tipSub,
        bodyColor: t.tipText,
        titleFont: { size: 12, weight: 500 },
        bodyFont: { size: 15, weight: 600 },
        padding: { x: 12, y: 9 },
        cornerRadius: 12,
        caretSize: 0,
        boxPadding: 5,
        usePointStyle: true,
        callbacks: {
          title: (items) => format((items[0].raw as { ts: number }).ts, 'EEE, MMM d').toUpperCase(),
          label: (item) => `${item.dataset.label}  ${fmtTime((item.raw as { ts: number }).ts)}`,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: days <= 7 ? 'day' : days <= 30 ? 'week' : 'month',
          displayFormats: { day: 'EEEEE', week: 'MMM d', month: 'MMM' },
        },
        min: since,
        max: todayStart + 86_400_000,
        grid: { color: t.grid, drawTicks: false },
        border: { display: false, dash: [2, 3] },
        ticks: { color: t.text, font: { size: 11, weight: 500 }, maxRotation: 0, autoSkipPadding: 16, padding: 8, align: 'start' },
      },
      y: {
        position: 'right',
        reverse: true,
        min: 0,
        max: 1440,
        ticks: { color: t.text, font: { size: 11, weight: 500 }, stepSize: 360, padding: 6, callback: (v) => hourLabel(Number(v)) },
        grid: { color: t.grid, drawTicks: false },
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
      <Header title="Trends" />

      <div className="segmented" role="tablist">
        {RANGES.map((r) => (
          <button
            key={r.id} role="tab" aria-selected={sel.range === r.id} aria-label={r.name}
            className={sel.range === r.id ? 'on' : ''}
            onClick={() => setSel((s) => ({ ...s, range: r.id }))}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="group chart-group">
        <div className="headline">
          <span className="eyebrow">{single ? `Average ${single.activity.name}` : 'Logged'}</span>
          <span className="headline-value">
            {avg ? (
              <>
                <span className="num">{avg.main}</span>
                {avg.period && <span className="unit">{avg.period}</span>}
              </>
            ) : (
              <>
                <span className="num">{total}</span>
                <span className="unit">{total === 1 ? 'time' : 'times'}</span>
              </>
            )}
          </span>
          <span className="headline-range">{rangeLabel}</span>
        </div>
        <div className="chart-box">
          {total === 0 ? (
            <div className="empty">
              <b>No Data</b>
              <span>{series.length === 0 ? 'Choose an activity below to see it here.' : `Nothing logged in this ${range.name === 'all time' ? 'range' : range.name}.`}</span>
            </div>
          ) : (
            <Line data={chartData} options={options} />
          )}
        </div>
      </div>

      <div className="section-head">
        <h2>Activities</h2>
        <span className="section-note">Tap to show or hide</span>
      </div>
      <div className="group list">
        {all.map(({ activity: a, pts, mins, color }) => {
          const on = !hidden.has(a.id);
          return (
            <button key={a.id} className="row legend-row" onClick={() => toggle(a.id)} aria-pressed={on}>
              <span className={`check ${on ? 'on' : ''}`} style={{ '--c': color } as React.CSSProperties}>
                {on && <CheckIcon width={13} height={13} />}
              </span>
              <span className="row-text">
                <span className="row-title">{a.emoji} {a.name}</span>
                <span className="row-sub">
                  {mins.length
                    ? `${pts.length} ${pts.length === 1 ? 'log' : 'logs'} · ${fmtMinutes(Math.min(...mins))} – ${fmtMinutes(Math.max(...mins))}`
                    : 'No logs in this range'}
                </span>
              </span>
              {mins.length > 0 && (
                <span className="row-value">
                  <span className="row-value-label">AVG</span>
                  {fmtMinutes(meanTime(mins))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
