import type { StoreHours } from './supabase-db';

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "21:00" → "9 PM", "09:30" → "9:30 AM" */
export function formatClock(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export interface OpenState {
  open: boolean;
  /** "Open now · Closes 9 PM" / "Closed · Opens 10 AM" */
  label: string;
}

/** Whether a shop is open at `now`; null when it hasn't published hours */
export function getOpenState(hours: StoreHours | null | undefined, now: Date = new Date()): OpenState | null {
  if (!hours) return null;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (open === null || close === null) return null;

  const closedToday = (hours.closed_days || []).includes(now.getDay());
  const minutes = now.getHours() * 60 + now.getMinutes();
  // Overnight hours (e.g. 18:00–02:00) wrap past midnight
  const isOpen = !closedToday && (close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close);

  if (isOpen) {
    const soon = close > open && close - minutes <= 60;
    return { open: true, label: soon ? `Closes soon · ${formatClock(hours.close)}` : `Open now · Closes ${formatClock(hours.close)}` };
  }
  if (closedToday) return { open: false, label: 'Closed today' };
  if (minutes < open) return { open: false, label: `Closed · Opens ${formatClock(hours.open)}` };
  const closedTomorrow = (hours.closed_days || []).includes((now.getDay() + 1) % 7);
  return { open: false, label: closedTomorrow ? 'Closed · Closed tomorrow too' : `Closed · Opens tomorrow ${formatClock(hours.open)}` };
}
