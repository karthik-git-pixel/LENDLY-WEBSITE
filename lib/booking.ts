import { rentUnitInfo } from './catalog';
import type { BookedSlot } from './supabase-db';
import { toMillis } from './time';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-24" in local time, for <input type="date"> */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Date from "2026-10-24" + "10:30" */
export function combineDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export function addUnits(start: Date, unit: string | null | undefined, count: number): Date {
  return new Date(start.getTime() + count * rentUnitInfo(unit).hours * 3600 * 1000);
}

/** Half-hour slots for the start-time picker */
export const TIME_SLOTS: string[] = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 06:00 → 23:30
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

export function formatSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** A sensible first suggestion: the next free half hour, or 10 AM tomorrow */
export function defaultStart(unit: string | null | undefined, now: Date): { date: string; time: string } {
  const hourly = rentUnitInfo(unit).id === 'hour';
  const next = new Date(now);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (hourly && next.getHours() >= 6 && next.getHours() <= 22) {
    return { date: toDateInput(next), time: `${pad(next.getHours())}:${pad(next.getMinutes())}` };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + (now.getHours() < 9 ? 0 : 1));
  return { date: toDateInput(tomorrow), time: '10:00' };
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Bookings that clash with a requested window */
export function conflictsWith(bookings: BookedSlot[], start: Date, end: Date): BookedSlot[] {
  return bookings.filter(b => overlaps(start.getTime(), end.getTime(), toMillis(b.startAt), toMillis(b.endAt)));
}

/** Days (local "YYYY-MM-DD") touched by any booking */
export function bookedDays(bookings: BookedSlot[]): Set<string> {
  const days = new Set<string>();
  for (const b of bookings) {
    const start = new Date(toMillis(b.startAt));
    const end = toMillis(b.endAt);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor.getTime() < end) {
      days.add(toDateInput(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return days;
}
