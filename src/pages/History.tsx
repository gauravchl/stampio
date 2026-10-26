import { useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { mergeRows, type Entry, type Store } from '../store';
import { fromCsv, saveCsv, toCsv } from '../csv';
import Sheet from '../components/Sheet';
import Header from '../components/Header';
import { displayColor, useTheme } from '../theme';

const PAGE = 200;
const toLocalInput = (ts: number) => format(ts, "yyyy-MM-dd'T'HH:mm");
const dayLabel = (ts: number) =>
  isToday(ts) ? 'Today' : isYesterday(ts) ? 'Yesterday' : format(ts, 'EEEE, MMM d, yyyy');

export default function History({ store }: { store: Store }) {
  const { data, logEntry, updateEntry, deleteEntry, replaceData } = store;
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  const byId = useMemo(() => new Map(data.activities.map((a) => [a.id, a])), [data.activities]);
  const list = useMemo(
    () => data.entries.filter((e) => filter === 'all' || e.activityId === filter).sort((a, b) => b.ts - a.ts),
    [data.entries, filter],
  );

  const groups: { day: string; items: Entry[] }[] = [];
  for (const e of list.slice(0, limit)) {
    const day = dayLabel(e.ts);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(e);
  }

  const onImport = async (file: File) => {
    try {
      const rows = fromCsv(await file.text());
      const { data: next, added } = mergeRows(data, rows);
      replaceData(next);
      alert(`Imported ${added} new timestamp${added === 1 ? '' : 's'} (${rows.length - added} already present).`);
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <Header title="History" sub={`${data.entries.length} timestamps logged`}>
        <button className="link" onClick={() => setAdding(true)}>＋ Add</button>
      </Header>

      <div className="actions">
        <button className="secondary" onClick={() => saveCsv(toCsv(data))} disabled={!data.entries.length}>
          ⬇︎ Export CSV
        </button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>⬆︎ Import CSV</button>
        <input
          ref={fileRef} type="file" accept=".csv,text/csv" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>

      <select className="select" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(PAGE); }}>
        <option value="all">All activities</option>
        {data.activities.map((a) => (
          <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
        ))}
      </select>

      {!list.length && <div className="empty">Nothing logged yet.</div>}

      {groups.map((g) => (
        <section key={g.day} className="day">
          <h3>{g.day}</h3>
          <div className="card list">
            {g.items.map((e) => {
              const a = byId.get(e.activityId);
              return (
                <button key={e.id} className="list-row" onClick={() => setEditing(e)}>
                  <span className="dot" style={{ background: a && displayColor(a.color, theme) }} />
                  <span className="grow">{a?.emoji} {a?.name ?? 'Unknown'}</span>
                  <span className="time">{format(e.ts, 'HH:mm')}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {list.length > limit && (
        <button className="secondary wide" onClick={() => setLimit((l) => l + PAGE)}>Show more</button>
      )}

      {editing && (
        <Sheet title={`Edit ${byId.get(editing.activityId)?.name ?? ''}`} onClose={() => setEditing(null)}>
          <EntryForm
            initialTs={editing.ts}
            onSave={(_, ts) => { updateEntry(editing.id, ts); setEditing(null); }}
            onDelete={() => { deleteEntry(editing.id); setEditing(null); }}
          />
        </Sheet>
      )}
      {adding && (
        <Sheet title="Add a missed timestamp" onClose={() => setAdding(false)}>
          <EntryForm
            activities={data.activities}
            initialTs={Date.now()}
            onSave={(activityId, ts) => { logEntry(activityId!, ts); setAdding(false); }}
          />
        </Sheet>
      )}
    </>
  );
}

function EntryForm({ activities, initialTs, onSave, onDelete }: {
  activities?: Store['data']['activities'];
  initialTs: number;
  onSave: (activityId: string | undefined, ts: number) => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(toLocalInput(initialTs));
  const [activityId, setActivityId] = useState(activities?.[0]?.id);
  const ts = new Date(value).getTime();
  const valid = !Number.isNaN(ts) && (!activities || !!activityId);

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(activityId, ts); }}>
      {activities && (
        <label className="field">
          <span>Activity</span>
          <select className="select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span>Date & time</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button className="primary" type="submit" disabled={!valid}>Save</button>
      {onDelete && <button type="button" className="danger" onClick={onDelete}>Delete timestamp</button>}
    </form>
  );
}
