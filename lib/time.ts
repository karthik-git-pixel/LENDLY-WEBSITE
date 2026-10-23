/**
 * Milliseconds since epoch for anything the app stores as a time:
 * ISO strings from Supabase, Dates, epoch numbers, or legacy Firestore
 * Timestamp-like objects.
 */
export function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  return 0;
}

export function toDate(value: unknown): Date | null {
  const ms = toMillis(value);
  return ms ? new Date(ms) : null;
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function formatDate(value: unknown): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '';
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '';
}

/** "12 Oct, 10:00 am → 13 Oct, 10:00 am" */
export function formatRange(start: unknown, end: unknown): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return '';
  return `${dateTimeFmt.format(a)} → ${dateTimeFmt.format(b)}`;
}
