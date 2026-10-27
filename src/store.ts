import { useCallback, useEffect, useState } from 'react';

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
}

export interface Entry {
  id: string;
  activityId: string;
  /** Epoch milliseconds. */
  ts: number;
}

export interface Data {
  activities: Activity[];
  entries: Entry[];
}

const STORAGE_KEY = 'timestamp-app:v1';

// Categorical palette, validated for color-vision deficiency on the dark surface.
// Order matters: neighbours stay distinguishable.
export const COLORS = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767',
];

// crypto.randomUUID only exists in secure contexts; plain http on the LAN
// (handy for testing on a phone) is not one.
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

function defaults(): Data {
  const now = Date.now();
  const seed: [string, string][] = [
    ['Woke up', '☀️'],
    ['Lunch', '🍽️'],
    ['Meditation', '🧘'],
    ['Nap', '😴'],
  ];
  return {
    activities: seed.map(([name, emoji], i) => ({
      id: uid(), name, emoji, color: COLORS[i], createdAt: now + i,
    })),
    entries: [],
  };
}

function load(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Data;
      if (Array.isArray(d.activities) && Array.isArray(d.entries)) return d;
    }
  } catch {
    // fall through to defaults
  }
  return defaults();
}

export function nextColor(activities: Activity[]) {
  const used = new Set(activities.map((a) => a.color));
  return COLORS.find((c) => !used.has(c)) ?? COLORS[activities.length % COLORS.length];
}

export function useStore() {
  const [data, setData] = useState<Data>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      alert('Could not save — storage is full or unavailable.');
    }
  }, [data]);

  const addActivity = useCallback((a: Omit<Activity, 'id' | 'createdAt'>) => {
    setData((d) => ({ ...d, activities: [...d.activities, { ...a, id: uid(), createdAt: Date.now() }] }));
  }, []);

  const updateActivity = useCallback((id: string, patch: Partial<Activity>) => {
    setData((d) => ({ ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }, []);

  /** Put activities in the given id order; any not listed keep their place at the end. */
  const reorderActivities = useCallback((ids: string[]) => {
    setData((d) => {
      const rank = new Map(ids.map((id, i) => [id, i]));
      const activities = [...d.activities].sort(
        (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
      );
      return { ...d, activities };
    });
  }, []);

  const deleteActivity = useCallback((id: string) => {
    setData((d) => ({
      activities: d.activities.filter((a) => a.id !== id),
      entries: d.entries.filter((e) => e.activityId !== id),
    }));
  }, []);

  const logEntry = useCallback((activityId: string, ts = Date.now()) => {
    const entry: Entry = { id: uid(), activityId, ts };
    setData((d) => ({ ...d, entries: [...d.entries, entry] }));
    return entry;
  }, []);

  const updateEntry = useCallback((id: string, ts: number) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ts } : e)) }));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  }, []);

  return {
    data, addActivity, updateActivity, reorderActivities, deleteActivity,
    logEntry, updateEntry, deleteEntry, replaceData: setData,
  };
}

export type Store = ReturnType<typeof useStore>;

/** Merge imported rows, creating activities by name and skipping exact duplicates. */
export function mergeRows(d: Data, rows: { name: string; ts: number }[]) {
  const activities = [...d.activities];
  const entries = [...d.entries];
  const byName = new Map(activities.map((a) => [a.name.toLowerCase(), a]));
  const seen = new Set(entries.map((e) => `${e.activityId}|${e.ts}`));
  let added = 0;
  for (const r of rows) {
    let a = byName.get(r.name.toLowerCase());
    if (!a) {
      a = { id: uid(), name: r.name, emoji: '⏱️', color: nextColor(activities), createdAt: Date.now() };
      activities.push(a);
      byName.set(r.name.toLowerCase(), a);
    }
    const key = `${a.id}|${r.ts}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ id: uid(), activityId: a.id, ts: r.ts });
    added++;
  }
  return { data: { activities, entries }, added };
}
