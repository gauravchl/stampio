import { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Tooltip,
  type ChartOptions, type Plugin,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from 'date-fns';
import type { Store } from '../store';
import Header from '../components/Header';
import { CheckIcon, ChevronRight } from '../components/Icons';
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

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** Draws each point as its activity's emoji. Drawn as text so it stays crisp at any pixel ratio. */
const emojiPoints: Plugin<'line'> = {
  id: 'emojiPoints',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: area } = chart;
    const active = new Set(chart.getActiveElements().map((e) => `${e.datasetIndex}:${e.index}`));
    ctx.save();
    // Clip only the sides so panned-away points vanish but midnight/late-night emoji aren't cut off.
    ctx.beginPath();
    ctx.rect(area.left, 0, area.width, chart.height);
    ctx.clip();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((ds, i) => {
      const { emoji, emojiSize } = ds as { emoji?: string; emojiSize?: number };
      if (!emoji || !emojiSize || !chart.isDatasetVisible(i)) return;
      chart.getDatasetMeta(i).data.forEach((pt, j) => {
        if ((pt as { skip?: boolean }).skip) return;
        ctx.font = `${active.has(`${i}:${j}`) ? emojiSize * 1.5 : emojiSize}px ${EMOJI_FONT}`;
        ctx.fillText(emoji, pt.x, pt.y);
      });
    });
    ctx.restore();
  },
};

const SEL_KEY = 'timestamp-app:chart';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
type View = { min: number; max: number };
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
  const [page, setPage] = useState(0);
  const [panning, setPanning] = useState(false);
  const chartRef = useRef<ChartJS<'line'>>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const live = useRef<View | null>(null);
  const { theme } = useTheme();
  const t = CHART_THEME[theme];
  useEffect(() => {
    try { localStorage.setItem(SEL_KEY, JSON.stringify(sel)); } catch { /* ignore */ }
  }, [sel]);

  const hidden = new Set(sel.hidden);
  const range = RANGES.find((r) => r.id === sel.range)!;
  const days = range.days;
  const pageable = days !== Infinity;
  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = addDays(todayStart, 1).getTime();
  const firstTs = entries.reduce((m, e) => Math.min(m, e.ts), Infinity);
  const firstStart = Number.isFinite(firstTs) ? startOfDay(firstTs).getTime() : todayStart;

  // Fixed-length ranges page back in time: page 0 ends today, page 1 is the window before it, and so on.
  const maxPage = pageable ? Math.max(0, Math.ceil(differenceInCalendarDays(todayEnd, firstStart) / days) - 1) : 0;
  const pg = Math.min(page, maxPage);
  const windowOf = (p: number): View => {
    if (!pageable) return { min: firstStart, max: todayEnd };
    const max = addDays(todayStart, 1 - p * days).getTime();
    return { min: subDays(max, days).getTime(), max };
  };
  const { min: since, max: until } = windowOf(pg);

  const all = activities.map((a) => {
    const allPts = entries.filter((e) => e.activityId === a.id).sort((p, q) => p.ts - q.ts);
    const pts = allPts.filter((e) => e.ts >= since && e.ts < until);
    const mins = pts.map((e) => minutesOfDay(e.ts));
    return { activity: a, allPts, pts, mins, color: displayColor(a.color, theme) };
  });
  const series = all.filter((s) => !hidden.has(s.activity.id));
  const total = series.reduce((n, s) => n + s.pts.length, 0);
  const everTotal = series.reduce((n, s) => n + s.allPts.length, 0);

  // Headline above the chart, like Health: one activity shows its average time, several show a count.
  const single = series.length === 1 && series[0].mins.length ? series[0] : null;
  const avg = single ? minuteParts(meanTime(single.mins)) : null;
  const last = pg === 0 ? Date.now() : until - 1;
  const sameYear = new Date(since).getFullYear() === new Date(last).getFullYear();
  const rangeLabel = `${format(since, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;

  const chartData = {
    datasets: series.map(({ activity: a, allPts, color }) => ({
      label: a.name,
      emoji: a.emoji,
      emojiSize: days <= 7 ? 16 : days <= 30 ? 11 : 9,
      data: allPts.map((e) => ({ x: startOfDay(e.ts).getTime() + 12 * 3600_000, y: minutesOfDay(e.ts), ts: e.ts })),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      // Points are drawn as emoji by the emojiPoints plugin; these stay invisible but hoverable.
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 14,
      tension: 0.2,
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion() ? false : { duration: 250 },
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
        displayColors: false,
        callbacks: {
          title: (items) => format((items[0].raw as { ts: number }).ts, 'EEE, MMM d').toUpperCase(),
          label: (item) => `${(item.dataset as { emoji?: string }).emoji} ${item.dataset.label}  ${fmtTime((item.raw as { ts: number }).ts)}`,
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
        // Mid-swipe the chart is driven imperatively; keep a re-render from snapping it back.
        min: live.current?.min ?? since,
        max: live.current?.max ?? until,
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

  // ---- Horizontal paging: drag, trackpad swipe or the chevrons move between windows. ----
  const drag = useRef<{ x0: number; base: number; dx: number; t: number; v: number; id?: number } | null>(null);
  const pending = useRef<{ x: number; y: number; id: number } | null>(null);
  const raf = useRef(0);
  const wheelTimer = useRef(0);
  const ctl = useRef({ pg, maxPage, pageable, windowOf });
  ctl.current = { pg, maxPage, pageable, windowOf };

  const setView = (v: View) => {
    const chart = chartRef.current;
    live.current = v;
    if (!chart) return;
    const x = chart.options.scales!.x!;
    x.min = v.min;
    x.max = v.max;
    chart.update('none');
  };

  // Hide the tooltip while panning, since it would point at a day that has scrolled away.
  const setHover = (chart: ChartJS<'line'>, on: boolean) => {
    chart.options.events = on ? ChartJS.defaults.events : [];
    chart.options.plugins!.tooltip!.enabled = on;
    chart.stop(); // a half-finished tooltip fade would otherwise freeze on screen
    chart.setActiveElements([]);
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  };

  const settle = (target: number) => {
    const { windowOf } = ctl.current;
    const to = windowOf(target);
    const from = live.current ?? to;
    cancelAnimationFrame(raf.current);
    const done = () => {
      live.current = null;
      if (chartRef.current) {
        setHover(chartRef.current, true);
        chartRef.current.update();
      }
      setPage(target);
      setPanning(false);
    };
    if (reducedMotion() || (from.min === to.min && from.max === to.max)) {
      setView(to);
      return done();
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = easeOut(Math.min(1, (now - t0) / 280));
      setView({ min: from.min + (to.min - from.min) * k, max: from.max + (to.max - from.max) * k });
      if (k < 1) raf.current = requestAnimationFrame(step);
      else done();
    };
    raf.current = requestAnimationFrame(step);
  };

  const beginPan = (x0: number, id?: number) => {
    const chart = chartRef.current;
    cancelAnimationFrame(raf.current);
    const { pg, windowOf } = ctl.current;
    const base = live.current?.min ?? windowOf(pg).min;
    drag.current = { x0, base, dx: 0, t: performance.now(), v: 0, id };
    if (chart) setHover(chart, false);
    setPanning(true);
  };

  const movePan = (dx: number) => {
    const d = drag.current, chart = chartRef.current;
    if (!d || !chart) return;
    const now = performance.now();
    d.v = 0.8 * ((dx - d.dx) / Math.max(1, now - d.t)) + 0.2 * d.v;
    d.dx = dx;
    d.t = now;
    const { maxPage, windowOf } = ctl.current;
    const span = windowOf(0).max - windowOf(0).min;
    const lo = windowOf(maxPage).min, hi = windowOf(0).min;
    let min = d.base - (dx * span) / chart.chartArea.width;
    // Rubber-band past the first and last page.
    if (min > hi) min = hi + (min - hi) / 3;
    if (min < lo) min = lo - (lo - min) / 3;
    setView({ min, max: min + span });
  };

  const endPan = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const { pg, maxPage, windowOf } = ctl.current;
    const cur = windowOf(pg);
    // Pages travelled, positive = back in time. A quick flick counts as at least one page.
    let by = Math.round((cur.min - (live.current?.min ?? cur.min)) / (cur.max - cur.min));
    if (by === 0 && Math.abs(d.v) > 0.35 && Math.abs(d.dx) > 12) by = Math.sign(d.v);
    settle(Math.max(0, Math.min(maxPage, pg + by)));
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Trackpad two-finger swipe. Needs a non-passive listener so the browser doesn't navigate back.
    const onWheel = (e: WheelEvent) => {
      if (!ctl.current.pageable || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!drag.current) beginPan(0);
      movePan(drag.current!.dx - e.deltaX);
      clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        if (drag.current) drag.current.v = 0;
        endPan();
      }, 120);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    clearTimeout(wheelTimer.current);
  }, []);

  const pointer = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!pageable || e.button !== 0) return;
      drag.current = null;
      pending.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = pending.current;
      if (p && p.id === e.pointerId) {
        const dx = e.clientX - p.x;
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - p.y)) return;
        pending.current = null;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        beginPan(p.x, e.pointerId);
      }
      if (drag.current?.id === e.pointerId) movePan(e.clientX - drag.current.x0);
    },
    onPointerUp: (e: React.PointerEvent) => {
      pending.current = null;
      if (drag.current?.id === e.pointerId) endPan();
    },
    onPointerCancel: (e: React.PointerEvent) => {
      pending.current = null;
      if (drag.current?.id === e.pointerId) endPan();
    },
  };
  const go = (p: number) => {
    if (drag.current || p < 0 || p > maxPage) return;
    live.current = live.current ?? windowOf(pg);
    setPanning(true);
    settle(p);
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
            onClick={() => {
              setSel((s) => ({ ...s, range: r.id }));
              setPage(0);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="group chart-group">
        <div className="headline-row">
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
          {pageable && maxPage > 0 && (
            <div className="pager">
              <button aria-label={`Previous ${range.name}`} disabled={pg >= maxPage} onClick={() => go(pg + 1)}>
                <ChevronRight width={17} height={17} style={{ transform: 'scaleX(-1)' }} />
              </button>
              <button aria-label={`Next ${range.name}`} disabled={pg === 0} onClick={() => go(pg - 1)}>
                <ChevronRight width={17} height={17} />
              </button>
            </div>
          )}
        </div>
        <div className={`chart-box ${pageable ? 'pannable' : ''}`} ref={boxRef} {...pointer}>
          {everTotal === 0 ? (
            <div className="empty">
              <b>No Data</b>
              <span>{series.length === 0 ? 'Choose an activity below to see it here.' : `Nothing logged in this ${range.name === 'all time' ? 'range' : range.name}.`}</span>
            </div>
          ) : (
            <>
              <Line ref={chartRef} data={chartData} options={options} plugins={[emojiPoints]} />
              {total === 0 && !panning && (
                <div className="empty chart-overlay">
                  <b>No Data</b>
                  <span>Nothing logged in this {range.name}.</span>
                </div>
              )}
            </>
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
