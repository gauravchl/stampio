import { useRef, useState } from 'react';
import { mergeRows, type Store } from '../store';
import { fromCsv, saveCsv, toCsv } from '../csv';
import { useSettings } from '../settings';
import ConfirmDialog from '../components/ConfirmDialog';
import Header from '../components/Header';
import { ChevronUpDown, GlobeIcon, ImportIcon, MailIcon, ShareIcon } from '../components/Icons';
import { hourLabel } from '../format';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourName = (h: number) => hourLabel(h * 60);

export default function Settings({ store }: { store: Store }) {
  const { data, replaceData } = store;
  const [settings, update] = useSettings();
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [confirmingTestData, setConfirmingTestData] = useState<'seed' | 'clear' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dayStart = settings.dayStartHour;

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

  const deleteAll = () => {
    replaceData({ activities: [], entries: [] });
    setConfirmingDeleteAll(false);
  };
  const nActs = data.activities.length, nEntries = data.entries.length;

  // Loaded on demand so the sample-data code stays out of the main bundle.
  const seedTestData = async () => {
    const { seedTestData } = await import('../dev/seed');
    setConfirmingTestData(null);
    await seedTestData(replaceData);
  };
  const clearTestData = async () => {
    setConfirmingTestData(null);
    (await import('../dev/seed')).clearTestData(replaceData);
  };
  const nSeeded = data.entries.filter((e) => e.id.startsWith('seed-')).length;

  return (
    <>
      <Header title="Settings" />

      <h3 className="list-header">Trends Chart</h3>
      <div className="group list">
        <label className="row picker-row">
          <span className="row-title">Start of Day</span>
          <span className="picker-value">
            {hourName(dayStart)}
            <ChevronUpDown width={14} height={14} />
          </span>
          <select value={dayStart} onChange={(e) => update({ dayStartHour: Number(e.target.value) })} aria-label="Start of day">
            {HOURS.map((h) => <option key={h} value={h}>{hourName(h)}</option>)}
          </select>
        </label>
      </div>
      <p className="footnote">
        Each day on the chart runs from this time to the same time the next morning. With 4 AM, a 1 AM bedtime counts toward the night before.
      </p>

      <h3 className="list-header">Data</h3>
      <div className="group list">
        <button className="row tint" onClick={() => saveCsv(toCsv(data))} disabled={!data.activities.length}>
          <ShareIcon width={19} height={19} /> Export as CSV
        </button>
        <button className="row tint" onClick={() => fileRef.current?.click()}>
          <ImportIcon width={19} height={19} /> Import from CSV
        </button>
      </div>
      <div className="group list">
        <button className="row destructive" onClick={() => setConfirmingDeleteAll(true)} disabled={!data.activities.length && !data.entries.length}>
          Delete All Data
        </button>
      </div>
      <p className="footnote">
        {data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'} stored on this device. Export now and then to keep a backup.
      </p>

      <h3 className="list-header">Developer</h3>
      <div className="group list">
        <button className="row tint" onClick={() => setConfirmingTestData('seed')}>Seed Test Data</button>
        <button className="row destructive" onClick={() => setConfirmingTestData('clear')} disabled={!nSeeded}>Clear Test Data</button>
      </div>
      <p className="footnote">
        Seeding replaces sample data with 30 days of new samples for every activity, and adds sample activities if there are none. Clearing keeps anything you logged yourself.
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

      {confirmingTestData === 'seed' && (
        <ConfirmDialog
          title="Seed Test Data?"
          message={`This adds 30 days of sample times${nActs ? ` to your ${nActs} activit${nActs === 1 ? 'y' : 'ies'}` : ' and a few sample activities'}, mixed in with your own logs. Your own logs aren’t changed, and Clear Test Data removes the samples later.`}
          confirmLabel="Seed"
          destructive={false}
          onConfirm={seedTestData}
          onCancel={() => setConfirmingTestData(null)}
        />
      )}
      {confirmingTestData === 'clear' && (
        <ConfirmDialog
          title="Clear Test Data?"
          message={`This removes ${nSeeded} sample time${nSeeded === 1 ? '' : 's'}. Anything you logged yourself is kept.`}
          confirmLabel="Clear"
          onConfirm={clearTestData}
          onCancel={() => setConfirmingTestData(null)}
        />
      )}
      {confirmingDeleteAll && (
        <ConfirmDialog
          title="Delete All Data?"
          message={`This removes ${nActs} activit${nActs === 1 ? 'y' : 'ies'} and ${nEntries} logged time${nEntries === 1 ? '' : 's'} from this device. This can’t be undone, so export a CSV first if you want a backup.`}
          confirmLabel="Delete All"
          onConfirm={deleteAll}
          onCancel={() => setConfirmingDeleteAll(false)}
        />
      )}
    </>
  );
}
