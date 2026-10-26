import { format } from 'date-fns';
import type { Data } from './store';

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv({ activities, entries }: Data) {
  const names = new Map(activities.map((a) => [a.id, a.name]));
  const rows = [...entries]
    .sort((a, b) => a.ts - b.ts)
    .map((e) => {
      const d = new Date(e.ts);
      return [
        names.get(e.activityId) ?? 'Unknown',
        format(d, "yyyy-MM-dd'T'HH:mm:ssxxx"),
        format(d, 'yyyy-MM-dd'),
        format(d, 'HH:mm:ss'),
        format(d, 'EEE'),
      ].map(esc).join(',');
    });
  return ['activity,timestamp,date,time,weekday', ...rows].join('\n') + '\n';
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

/** Reads a CSV produced by toCsv (needs `activity` and `timestamp` columns). */
export function fromCsv(text: string) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const ai = head.indexOf('activity'), ti = head.indexOf('timestamp');
  if (ai < 0 || ti < 0) throw new Error('CSV needs "activity" and "timestamp" columns.');
  const rows: { name: string; ts: number }[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseLine(line);
    const name = cols[ai]?.trim(), ts = Date.parse(cols[ti]?.trim() ?? '');
    if (name && !Number.isNaN(ts)) rows.push({ name, ts });
  }
  return rows;
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
