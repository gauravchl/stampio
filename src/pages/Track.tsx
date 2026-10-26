import { useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { nextColor, type Activity, type Entry, type Store } from '../store';
import Sheet from '../components/Sheet';
import ActivityForm from '../components/ActivityForm';
import Header from '../components/Header';
import { displayColor, useTheme } from '../theme';

const when = (ts: number) => {
  const d = new Date(ts);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
};

export default function Track({ store }: { store: Store }) {
  const { data, logEntry, deleteEntry, addActivity, updateActivity, deleteActivity } = store;
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<{ mode: 'new' } | { mode: 'edit'; activity: Activity } | null>(null);
  const [toast, setToast] = useState<{ entry: Entry; name: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);
  const { theme } = useTheme();

  // Re-render every 30s so "today" counts and relative labels stay fresh.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const m = new Map<string, { last?: number; today: number }>();
    for (const e of data.entries) {
      const s = m.get(e.activityId) ?? { today: 0 };
      if (!s.last || e.ts > s.last) s.last = e.ts;
      if (isToday(e.ts)) s.today++;
      m.set(e.activityId, s);
    }
    return m;
  }, [data.entries]);

  const tap = (a: Activity) => {
    if (editing) {
      setSheet({ mode: 'edit', activity: a });
      return;
    }
    const entry = logEntry(a.id);
    setFlash(a.id);
    setTimeout(() => setFlash(null), 450);
    setToast({ entry, name: a.name });
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  return (
    <>
      <Header title="Track" sub={format(new Date(), 'EEEE, MMM d')}>
        <button className="link" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </Header>

      {editing && <p className="hint">Tap an activity to rename, recolor or delete it.</p>}

      <div className="grid">
        {data.activities.map((a) => {
          const s = stats.get(a.id);
          return (
            <button
              key={a.id}
              className={`tile ${flash === a.id ? 'flash' : ''} ${editing ? 'wiggle' : ''}`}
              style={{ '--c': displayColor(a.color, theme) } as React.CSSProperties}
              onClick={() => tap(a)}
            >
              <span className="tile-emoji">{a.emoji}</span>
              <span className="tile-name">{a.name}</span>
              <span className="tile-meta">
                {s?.last ? `Last ${when(s.last)}` : 'Not logged yet'}
              </span>
              {!!s?.today && <span className="badge">{s.today}× today</span>}
            </button>
          );
        })}
        <button className="tile add" onClick={() => setSheet({ mode: 'new' })}>
          <span className="tile-emoji">＋</span>
          <span className="tile-name">New activity</span>
        </button>
      </div>

      {toast && (
        <div className="toast">
          <span>
            Logged <b>{toast.name}</b> at {format(toast.entry.ts, 'HH:mm')}
          </span>
          <button
            className="link"
            onClick={() => {
              deleteEntry(toast.entry.id);
              setToast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}

      {sheet?.mode === 'new' && (
        <Sheet title="New activity" onClose={() => setSheet(null)}>
          <ActivityForm
            initial={{ name: '', emoji: '⏱️', color: nextColor(data.activities) }}
            onSave={(v) => {
              addActivity(v);
              setSheet(null);
            }}
          />
        </Sheet>
      )}
      {sheet?.mode === 'edit' && (
        <Sheet title="Edit activity" onClose={() => setSheet(null)}>
          <ActivityForm
            initial={sheet.activity}
            onSave={(v) => {
              updateActivity(sheet.activity.id, v);
              setSheet(null);
            }}
            onDelete={() => {
              const n = data.entries.filter((e) => e.activityId === sheet.activity.id).length;
              if (confirm(`Delete "${sheet.activity.name}" and its ${n} logged timestamp${n === 1 ? '' : 's'}?`)) {
                deleteActivity(sheet.activity.id);
                setSheet(null);
              }
            }}
          />
        </Sheet>
      )}
    </>
  );
}
