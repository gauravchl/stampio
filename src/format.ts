import { differenceInCalendarDays, format } from 'date-fns';

// Follow the device's 12/24-hour preference, like native iOS apps do.
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });

const atMinutes = (m: number) => new Date(2000, 0, 1, 0, Math.round(m) % 1440);

export const fmtTime = (ts: number | Date) => timeFmt.format(ts);
export const fmtMinutes = (m: number) => fmtTime(atMinutes(m));
export const hourLabel = (m: number) => hourFmt.format(atMinutes(m));

/** Splits "7:12 AM" into the number and the AM/PM part so the period can be set smaller. */
export function timeParts(ts: number | Date) {
  const parts = timeFmt.formatToParts(ts);
  return {
    main: parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim(),
    period: parts.find((p) => p.type === 'dayPeriod')?.value ?? '',
  };
}
export const minuteParts = (m: number) => timeParts(atMinutes(m));

/** "Today", "Yesterday", "Friday" within the week, otherwise "Oct 23". */
export function relativeDay(ts: number, now = Date.now()) {
  const d = differenceInCalendarDays(now, ts);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return format(ts, 'EEEE');
  return format(ts, d < 300 ? 'MMM d' : 'MMM d, yyyy');
}
