// Dev-only console helpers for filling the app with realistic sample data.
// Loaded from App only when running `npm run dev`; not included in production builds.
import { COLORS, uid, type Activity, type Data, type Entry } from '../store';

type Profile = { hour: number; sd: number; chance: number; weekendShift?: number };

// Typical time of day (hours), spread (hours) and daily probability by activity name.
const PROFILES: [RegExp, Profile[]][] = [
  [/wake|woke/i, [{ hour: 7.1, sd: 0.4, chance: 0.95, weekendShift: 1.2 }]],
  [/lunch/i, [{ hour: 12.8, sd: 0.45, chance: 0.9 }]],
  [/medit/i, [{ hour: 7.6, sd: 0.3, chance: 0.7, weekendShift: 1 }]],
  [/nap/i, [{ hour: 15, sd: 0.5, chance: 0.35 }]],
  [/breakfast/i, [{ hour: 8, sd: 0.4, chance: 0.85, weekendShift: 1.3 }]],
  [/dinner/i, [{ hour: 19.6, sd: 0.5, chance: 0.9 }]],
  [/coffee/i, [{ hour: 8.5, sd: 0.4, chance: 0.9 }, { hour: 14.5, sd: 0.6, chance: 0.5 }]],
  [/bed|sleep/i, [{ hour: 22.9, sd: 0.4, chance: 0.95, weekendShift: 0.6 }]],
  [/gym|workout|run|exercise/i, [{ hour: 18, sd: 0.8, chance: 0.45 }]],
];

const SEED_PREFIX = 'seed-';

// Used when there are no activities to seed; each matches a profile above.
const SAMPLE_ACTIVITIES: [string, string][] = [
  ['Woke up', '☀️'],
  ['Coffee', '☕'],
  ['Lunch', '🍽️'],
  ['Workout', '🏋️'],
  ['Bed', '🛏️'],
];

const sampleActivities = (): Activity[] => {
  const now = Date.now();
  return SAMPLE_ACTIVITIES.map(([name, emoji], i) => ({
    id: uid(), name, emoji, color: COLORS[i], createdAt: now + i,
  }));
};

const gauss = () => {
  let u = 0;
  while (!u) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};

// Stable "random" typical hour for activities without a profile, so a given
// activity always lands in the same part of the day.
const hourFor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 8 + (h % 1300) / 100; // 08:00–21:00
};

function generate(d: Data, days: number): Entry[] {
  const out: Entry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const a of d.activities) {
    const profiles = PROFILES.find(([re]) => re.test(a.name))?.[1] ?? [
      { hour: hourFor(a.name), sd: 0.6, chance: 0.6 },
    ];
    for (let i = days; i >= 1; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      for (const p of profiles) {
        if (Math.random() > p.chance) continue;
        const hour = Math.min(23.95, Math.max(0, p.hour + (weekend ? p.weekendShift ?? 0 : 0) + gauss() * p.sd));
        out.push({
          id: `${SEED_PREFIX}${a.id}-${i}-${out.length}`,
          activityId: a.id,
          ts: day.getTime() + Math.round(hour * 3600_000),
        });
      }
    }
  }
  return out;
}

const withoutSeed = (d: Data): Data => ({ ...d, entries: d.entries.filter((e) => !e.id.startsWith(SEED_PREFIX)) });

export function install(setData: (fn: (d: Data) => Data) => void) {
  const w = window as unknown as Record<string, unknown>;
  if (w.seedTestData) return; // StrictMode runs effects twice in dev

  /**
   * Replace any previous sample data with `days` days of it (before today) for every activity.
   * With no activities, adds a few sample ones first.
   */
  w.seedTestData = (days = 30) => {
    // StrictMode calls updaters twice; cache so both calls return the same random data.
    let cache: { from: Data; to: Data } | undefined;
    let n = 0;
    setData((d) => {
      if (cache?.from === d) return cache.to;
      let clean = withoutSeed(d);
      if (!clean.activities.length) clean = { ...clean, activities: sampleActivities() };
      const seeded = generate(clean, days);
      n = seeded.length;
      cache = { from: d, to: { ...clean, entries: [...clean.entries, ...seeded] } };
      return cache.to;
    });
    // The updater runs when React renders, so report once that has happened.
    setTimeout(() => console.log(`Seeded ${n} sample timestamps over ${days} days.`), 100);
  };

  /** Remove sample data only; anything you logged yourself is kept. */
  w.clearTestData = () => {
    setData(withoutSeed);
    console.log('Removed sample timestamps.');
  };

  console.info(
    '%cStampio dev tools%c\n  seedTestData(days = 30)  add sample data for every activity (adds sample activities if there are none)\n  clearTestData()          remove sample data (keeps your own logs)',
    'font-weight:bold', '',
  );
}
