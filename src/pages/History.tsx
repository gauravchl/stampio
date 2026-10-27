import { useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { mergeRows, type Entry, type Store } from '../store';
import { fromCsv, saveCsv, toCsv } from '../csv';
import Sheet from '../components/Sheet';
import Header from '../components/Header';
import { ChevronRight, ChevronUpDown, GlobeIcon, ImportIcon, MailIcon, PlusIcon, ShareIcon } from '../components/Icons';
import { displayColor, useTheme } from '../theme';
import { fmtTime } from '../format';

const PAGE = 200;
const ENTRY_FORM_ID = 'entry-form';
const toLocalInput = (ts: number) => format(ts, "yyyy-MM-dd'T'HH:mm");
const dayLabel = (ts: number) =>
  isToday(ts) ? 'Today' : isYesterday(ts) ? 'Yesterday' : format(ts, 'EEEE, MMMM d');

export default function History({ store }: { store: Store }) {
  const { data, logEntry, updateEntry, deleteEntry, replaceData } = store;
  const { theme } = useTheme();
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const parsed = fromCsv(await file.text());
      const { data: next, added, created } = mergeRows(data, parsed);
      replaceData(next);
      const acts = created ? ` Added ${created} activit${created === 1 ? 'y' : 'ies'}.` : '';
      alert(`Imported ${added} new entr${added === 1 ? 'y' : 'ies'}. ${parsed.rows.length - added} were already here.${acts}`);
    } catch (err) {
      alert(`Couldn’t import that file. ${(err as Error).message}`);
    }
  };

  const filterName = filter === 'all' ? 'All Activities' : byId.get(filter)?.name ?? 'All Activities';

  return (
    <>
      <Header
        title="History"
        actions={
          <button className="circle-btn tint" onClick={() => setAdding(true)} aria-label="Add entry" disabled={!data.activities.length}>
            <PlusIcon width={16} height={16} />
          </button>
        }
      />

      <div className="group list">
        <label className="row picker-row">
          <span className="row-title">Show</span>
          <span className="picker-value">
            {filterName}
            <ChevronUpDown width={14} height={14} />
          </span>
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(PAGE); }} aria-label="Filter by activity">
            <option value="all">All Activities</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>
        </label>
      </div>

      {!list.length && (
        <div className="empty standalone">
          <b>No Entries</b>
          <span>Times you log on the Today tab appear here.</span>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="list-header">{g.day}</h3>
          <div className="group list">
            {g.items.map((e) => {
              const a = byId.get(e.activityId);
              return (
                <button key={e.id} className="row entry-row" onClick={() => setEditing(e)}>
                  <span className="glyph" style={{ '--c': a && displayColor(a.color, theme) } as React.CSSProperties}>
                    {a?.emoji ?? '⏱️'}
                  </span>
                  <span className="row-title grow">{a?.name ?? 'Unknown'}</span>
                  <span className="row-detail">{fmtTime(e.ts)}</span>
                  <ChevronRight className="chevron" width={14} height={14} />
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {list.length > limit && (
        <div className="group">
          <button className="row tint center" onClick={() => setLimit((l) => l + PAGE)}>Show More</button>
        </div>
      )}

      <h3 className="list-header">Data</h3>
      <div className="group list">
        <button className="row tint" onClick={() => saveCsv(toCsv(data))} disabled={!data.activities.length}>
          <ShareIcon width={19} height={19} /> Export as CSV
        </button>
        <button className="row tint" onClick={() => fileRef.current?.click()}>
          <ImportIcon width={19} height={19} /> Import from CSV
        </button>
      </div>
      <p className="footnote">
        {data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'} stored on this device. Export now and then to keep a backup.
      </p>

      <h3 className="list-header">About</h3>
      <div className="group list">
        <a className="row" href="https://gauravchl.com" target="_blank" rel="noopener">
          <img className="avatar" src="./gaurav.jpg" alt="" width={44} height={44} />
          <span className="row-text">
            <span className="row-title">Gaurav Chikhale</span>
            <span className="row-sub wrap">Built this for myself, sharing it with you</span>
          </span>
        </a>
        <a className="row tint" href="https://gauravchl.com" target="_blank" rel="noopener">
          <GlobeIcon width={19} height={19} /> gauravchl.com
        </a>
        <a className="row tint" href="mailto:mail@gauravchl.com">
          <MailIcon width={19} height={19} /> mail@gauravchl.com
        </a>
      </div>
      <p className="footnote">Questions or ideas? I'd love to hear them.</p>
      <input
        ref={fileRef} type="file" accept=".csv,text/csv" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = '';
        }}
      />

      {editing && (
        <Sheet
          title={byId.get(editing.activityId)?.name ?? 'Entry'} onClose={() => setEditing(null)}
          confirmLabel="Done" formId={ENTRY_FORM_ID}
        >
          <EntryForm
            initialTs={editing.ts}
            onSave={(_, ts) => { updateEntry(editing.id, ts); setEditing(null); }}
            onDelete={() => { deleteEntry(editing.id); setEditing(null); }}
          />
        </Sheet>
      )}
      {adding && (
        <Sheet title="New Entry" onClose={() => setAdding(false)} confirmLabel="Add" formId={ENTRY_FORM_ID}>
          <EntryForm
            activities={data.activities}
            initialActivityId={filter === 'all' ? undefined : filter}
            initialTs={Date.now()}
            onSave={(activityId, ts) => { logEntry(activityId!, ts); setAdding(false); }}
          />
        </Sheet>
      )}
    </>
  );
}

function EntryForm({ activities, initialActivityId, initialTs, onSave, onDelete }: {
  activities?: Store['data']['activities'];
  initialActivityId?: string;
  initialTs: number;
  onSave: (activityId: string | undefined, ts: number) => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(toLocalInput(initialTs));
  const [activityId, setActivityId] = useState(initialActivityId ?? activities?.[0]?.id);
  const ts = new Date(value).getTime();
  const valid = !Number.isNaN(ts) && (!activities || !!activityId);
  const current = activities?.find((a) => a.id === activityId);

  return (
    <form id={ENTRY_FORM_ID} className="form" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(activityId, ts); }}>
      <div className="group list">
        {activities && (
          <label className="row picker-row">
            <span className="row-title">Activity</span>
            <span className="picker-value">
              {current ? `${current.emoji} ${current.name}` : 'Choose'}
              <ChevronUpDown width={14} height={14} />
            </span>
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)} aria-label="Activity">
              {activities.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
            </select>
          </label>
        )}
        <label className="row">
          <span className="row-title grow">Time</span>
          <input
            className="datetime" type="datetime-local" value={value}
            max={toLocalInput(Date.now())} onChange={(e) => setValue(e.target.value)}
          />
        </label>
      </div>
      {onDelete && (
        <div className="group">
          <button type="button" className="row destructive center" onClick={onDelete}>Delete Entry</button>
        </div>
      )}
    </form>
  );
}
