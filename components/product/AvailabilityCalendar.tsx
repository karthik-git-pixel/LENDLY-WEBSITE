'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toDateInput } from '@/lib/booking';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

interface AvailabilityCalendarProps {
  /** "YYYY-MM-DD" days that already have a confirmed booking */
  booked: Set<string>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

/** Month grid: pick a start day, see which days are already booked */
export default function AvailabilityCalendar({ booked, selected, today, onSelect }: AvailabilityCalendarProps) {
  const [month, setMonth] = useState(() => {
    const [y, m] = (selected || today).split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) list.push(toDateInput(new Date(month.getFullYear(), month.getMonth(), d)));
    return list;
  }, [month]);

  const thisMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  const canGoBack = month > thisMonth;

  return (
    <div className="pd-cal">
      <div className="pd-cal-head">
        <button type="button" className="ln-icon-btn" aria-label="Previous month" disabled={!canGoBack}
          onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
          <ChevronLeft size={18} />
        </button>
        <strong>{monthFmt.format(month)}</strong>
        <button type="button" className="ln-icon-btn" aria-label="Next month"
          onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="pd-cal-grid" role="grid" aria-label="Choose a start date">
        {WEEKDAYS.map(d => <span key={d} className="pd-cal-dow" aria-hidden="true">{d.slice(0, 2)}</span>)}
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const past = day < today;
          const isBooked = booked.has(day);
          const isSelected = day === selected;
          return (
            <button
              key={day}
              type="button"
              className={`pd-cal-day ${isBooked ? 'is-booked' : ''} ${isSelected ? 'is-selected' : ''} ${day === today ? 'is-today' : ''}`}
              disabled={past}
              aria-pressed={isSelected}
              aria-label={`${day}${isBooked ? ', has a booking' : ''}`}
              onClick={() => onSelect(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="pd-cal-legend">
        <span><i className="pd-dot is-booked" /> Booked (part or all of the day)</span>
        <span><i className="pd-dot is-selected" /> Your start</span>
      </div>
    </div>
  );
}
