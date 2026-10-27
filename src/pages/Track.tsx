import { useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday } from 'date-fns';
import { nextColor, type Activity, type Entry, type Store } from '../store';
import Sheet from '../components/Sheet';
import ActivityForm, { ACTIVITY_FORM_ID } from '../components/ActivityForm';
import Header from '../components/Header';
import { PlusIcon } from '../components/Icons';
import { displayColor, useTheme } from '../theme';
import { fmtTime, relativeDay } from '../format';
import { haptic } from '../haptics';

type SheetState = { mode: 'new' } | { mode: 'edit'; activity: Activity } | null;

export default function Track({ store }: { store: Store }) {
  const { data, logEntry, deleteEntry, addActivity, updateActivity, deleteActivity } = store;
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [valid, setValid] = useState(false);
  const [banner, setBanner] = useState<{ entry: Entry; activity: Activity } | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const bannerTimer = useRef<number>(undefined);

  // Re-render every 30s so "Today"/"Yesterday" captions stay fresh.
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

  const openSheet = (s: SheetState) => {
    setValid(s?.mode === 'edit');
    setSheet(s);
  };

  const tap = (a: Activity) => {
    if (editing) {
      openSheet({ mode: 'edit', activity: a });
      return;
    }
    haptic();
    const entry = logEntry(a.id);
    setPulse(a.id);
    setTimeout(() => setPulse(null), 600);
    setBanner({ entry, activity: a });
    clearTimeout(bannerTimer.current);
    bannerTimer.current = window.setTimeout(() => setBanner(null), 4000);
  };

  return (
    <>
      <Header
        title={format(new Date(), 'EEEE, MMM d')}
        actions={
          data.activities.length > 0 && (
            <button className="nav-btn" onClick={() => setEditing((v) => !v)}>
              {editing ? <b>Done</b> : 'Edit'}
            </button>
          )
        }
      />

      <div className="grid">
        {data.activities.map((a) => {
          const s = stats.get(a.id);
          // One short line: today's time, otherwise just the day it was last logged.
          const caption = editing
            ? 'Edit'
            : !s?.last
              ? 'No logs yet'
              : isToday(s.last)
                ? fmtTime(s.last)
                : relativeDay(s.last);
          return (
            <button
              key={a.id}
              className={`tile ${pulse === a.id ? 'pulse' : ''} ${editing ? 'jiggle' : ''}`}
              style={{ '--c': displayColor(a.color, theme) } as React.CSSProperties}
              onClick={() => tap(a)}
              aria-label={editing ? `Edit ${a.name}` : `Log ${a.name}`}
            >
              <span className="tile-head">
                <span className="glyph">{a.emoji}</span>
                {!editing && s && s.today > 1 && (
                  <span className="tile-count" aria-hidden>{s.today}×</span>
                )}
              </span>
              <span className="tile-name">{a.name}</span>
              <span
                className={`tile-caption ${editing ? 'tint' : s?.last && isToday(s.last) ? 'today' : ''}`}
              >
                {caption}
              </span>
            </button>
          );
        })}
      </div>

      <div className="group">
        <button className="row tint" onClick={() => openSheet({ mode: 'new' })}>
          <PlusIcon width={18} height={18} /> Add Activity
        </button>
      </div>

      {banner && (
        <div className="banner" role="status" key={banner.entry.id}>
          <span className="glyph" style={{ '--c': displayColor(banner.activity.color, theme) } as React.CSSProperties}>
            {banner.activity.emoji}
          </span>
          <span className="banner-text">
            <b>{banner.activity.name}</b>
            <span>Logged at {fmtTime(banner.entry.ts)}</span>
          </span>
          <button
            className="banner-btn"
            onClick={() => {
              deleteEntry(banner.entry.id);
              setBanner(null);
            }}
          >
            Undo
          </button>
        </div>
      )}

      {sheet?.mode === 'new' && (
        <Sheet
          title="New Activity" onClose={() => setSheet(null)}
          confirmLabel="Add" confirmDisabled={!valid} formId={ACTIVITY_FORM_ID}
        >
          <ActivityForm
            initial={{ name: '', emoji: '⏱️', color: nextColor(data.activities) }}
            onValidChange={setValid}
            onSave={(v) => {
              addActivity(v);
              setSheet(null);
            }}
          />
        </Sheet>
      )}
      {sheet?.mode === 'edit' && (
        <Sheet
          title="Edit Activity" onClose={() => setSheet(null)}
          confirmLabel="Done" confirmDisabled={!valid} formId={ACTIVITY_FORM_ID}
        >
          <ActivityForm
            initial={sheet.activity}
            onValidChange={setValid}
            onSave={(v) => {
              updateActivity(sheet.activity.id, v);
              setSheet(null);
            }}
            onDelete={() => {
              const n = data.entries.filter((e) => e.activityId === sheet.activity.id).length;
              if (confirm(`Delete “${sheet.activity.name}”? This also deletes its ${n} logged time${n === 1 ? '' : 's'}.`)) {
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
