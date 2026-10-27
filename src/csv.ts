import { format } from 'date-fns';
import type { Data } from './store';

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * One row per activity (blank timestamp, home-screen order) so activities with
 * no entries, their emoji, color and order survive a round trip; then one row per entry.
 */
export function toCsv({ activities, entries }: Data) {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const defs = activities.map((a) => [a.name, '', '', '', '', a.emoji, a.color].map(esc).join(','));
  const rows = [...entries]
    .sort((a, b) => a.ts - b.ts)
    .map((e) => {
      const d = new Date(e.ts);
      const a = byId.get(e.activityId);
      return [
        a?.name ?? 'Unknown',
        format(d, "yyyy-MM-dd'T'HH:mm:ssxxx"),
        format(d, 'yyyy-MM-dd'),
        format(d, 'HH:mm:ss'),
        format(d, 'EEE'),
        a?.emoji ?? '',
        a?.color ?? '',
      ].map(esc).join(',');
    });
  return ['activity,timestamp,date,time,weekday,emoji,color', ...defs, ...rows].join('\n') + '\n';
}

function parseLine(line: string) {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface CsvActivity { name: string; emoji?: string; color?: string }

/**
 * Reads a CSV produced by toCsv (needs `activity` and `timestamp` columns).
 * Activities come back in file order; rows with a blank timestamp only declare an activity.
 */
export function fromCsv(text: string) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const activities: CsvActivity[] = [];
  const rows: { name: string; ts: number }[] = [];
  if (!lines.length) return { activities, rows };
  const head = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const ai = head.indexOf('activity'), ti = head.indexOf('timestamp');
  const ei = head.indexOf('emoji'), ci = head.indexOf('color');
  if (ai < 0 || ti < 0) throw new Error('CSV needs "activity" and "timestamp" columns.');
  const seen = new Map<string, CsvActivity>();
  for (const line of lines.slice(1)) {
    const cols = parseLine(line);
    const name = cols[ai]?.trim();
    if (!name) continue;
    let a = seen.get(name.toLowerCase());
    if (!a) {
      a = { name };
      seen.set(name.toLowerCase(), a);
      activities.push(a);
    }
    const emoji = ei >= 0 ? cols[ei]?.trim() : '';
    const color = ci >= 0 ? cols[ci]?.trim() : '';
    if (emoji && !a.emoji) a.emoji = emoji;
    if (color && /^#[0-9a-f]{6}$/i.test(color) && !a.color) a.color = color;
    const raw = cols[ti]?.trim();
    if (!raw) continue;
    const ts = Date.parse(raw);
    if (!Number.isNaN(ts)) rows.push({ name, ts });
  }
  return { activities, rows };
}

/** On iPhone, the share sheet ("Save to Files") is more reliable than a download link. */
export async function saveCsv(csv: string) {
  const name = `stampio-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  const file = new File([csv], name, { type: 'text/csv' });
  const touch = navigator.maxTouchPoints > 0;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
