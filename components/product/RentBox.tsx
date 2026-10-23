'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarDays, Loader2, Minus, Plus, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { createOrder, type BookedSlot, type Product } from '@/lib/supabase-db';
import { pluralUnit, rentUnitInfo } from '@/lib/catalog';
import {
  addUnits, bookedDays, combineDateTime, conflictsWith, defaultStart, formatSlot, TIME_SLOTS, toDateInput,
} from '@/lib/booking';
import { formatDateTime, formatRange } from '@/lib/time';
import { payOnline } from '@/lib/checkout';
import AvailabilityCalendar from './AvailabilityCalendar';

const DEFAULT_MAX: Record<string, number> = { hour: 24, day: 30, week: 12, month: 24 };
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface RentBoxProps {
  product: Product;
  bookings: BookedSlot[];
  onlineEnabled: boolean;
}

/** The rental booking interface: pick a slot, see the quote, request it */
export default function RentBox({ product, bookings, onlineEnabled }: RentBoxProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { requireAuth } = useRequireAuth();
  const unit = rentUnitInfo(product.rentDuration);
  const minUnits = Math.max(1, product.minUnits || 1);
  const maxUnits = Math.max(minUnits, product.maxUnits || DEFAULT_MAX[unit.id] || 30);

  const [now] = useState(() => new Date());
  const [initial] = useState(() => defaultStart(unit.id, now));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [qty, setQty] = useState(minUnits);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'pickup' | 'online' | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const start = combineDateTime(date, time);
  const end = addUnits(start, unit.id, qty);
  const clashes = conflictsWith(bookings, start, end);
  const inPast = start.getTime() < now.getTime() - 15 * 60 * 1000;
  const subtotal = qty * product.price;
  const deposit = product.securityDeposit || 0;
  const booked = useMemo(() => bookedDays(bookings), [bookings]);
  const upcoming = bookings.slice(0, 4);
  const blocked = clashes.length > 0 || inPast;

  const submit = async (online: boolean) => {
    if (!requireAuth(undefined, 'Log in to book this')) return;
    if (inPast) return toast.error('Pick a start time in the future');
    if (clashes.length) return toast.error('Those dates overlap a confirmed booking');
    setBusy(online ? 'online' : 'pickup');
    try {
      let orderId: string;
      if (online) {
        orderId = await payOnline({
          kind: 'order',
          payload: { productId: product.id, start: start.toISOString(), end: end.toISOString(), notes },
          description: `${product.title} · ${pluralUnit(unit.id, qty)}`,
          prefill: { name: profile?.displayName, email: profile?.email, contact: profile?.phone },
        });
        toast.success('Paid — booking sent to the owner');
      } else {
        const order = await createOrder({ productId: product.id, start, end, notes });
        orderId = order.id;
        toast.success('Booking request sent');
      }
      router.push(`/qr/${orderId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not book this';
      if (message !== 'Payment cancelled') toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const hourly = unit.id === 'hour';

  return (
    <section className="pd-box" id="book" aria-labelledby="pd-book-title">
      <div className="pd-price">
        <span className="pd-price-amount">{inr(product.price)}</span>
        <span className="pd-price-unit">/{unit.short}</span>
      </div>
      <ul className="pd-terms">
        {deposit > 0 && <li><ShieldCheck size={15} aria-hidden="true" /> {inr(deposit)} refundable deposit at pickup</li>}
        {minUnits > 1 && <li>Minimum {pluralUnit(unit.id, minUnits)}</li>}
        {product.maxUnits ? <li>Up to {pluralUnit(unit.id, product.maxUnits)} per booking</li> : null}
      </ul>

      <h2 id="pd-book-title" className="pd-box-title">Book a slot</h2>

      <div className="pd-field-row">
        <label className="pd-field">
          <span>Start date</span>
          <input
            type="date"
            className="ln-input"
            value={date}
            min={toDateInput(now)}
            onChange={e => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label className="pd-field">
          <span>{hourly ? 'Start time' : 'Pickup time'}</span>
          <select className="ln-input" value={time} onChange={e => setTime(e.target.value)}>
            {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}
          </select>
        </label>
      </div>

      <div className="pd-field">
        <span id="pd-qty-label">Duration</span>
        <div className="pd-stepper" role="group" aria-labelledby="pd-qty-label">
          <button type="button" className="ln-icon-btn" aria-label="Shorter" disabled={qty <= minUnits} onClick={() => setQty(q => Math.max(minUnits, q - 1))}>
            <Minus size={18} />
          </button>
          <output aria-live="polite">{pluralUnit(unit.id, qty)}</output>
          <button type="button" className="ln-icon-btn" aria-label="Longer" disabled={qty >= maxUnits} onClick={() => setQty(q => Math.min(maxUnits, q + 1))}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <p className={`pd-window ${blocked ? 'is-blocked' : ''}`}>
        <CalendarDays size={16} aria-hidden="true" />
        <span>{formatRange(start, end)}</span>
      </p>
      {clashes.length > 0 && (
        <p className="ln-note ln-note-warn" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> Overlaps a booking ({formatRange(clashes[0].startAt, clashes[0].endAt)}). Try another time.
        </p>
      )}
      {inPast && <p className="ln-note ln-note-warn" role="alert">That start time has already passed.</p>}

      <button type="button" className="ln-text-btn pd-cal-toggle" aria-expanded={showCalendar} onClick={() => setShowCalendar(s => !s)}>
        {showCalendar ? 'Hide calendar' : `Check availability${bookings.length ? ` · ${bookings.length} booked` : ''}`}
      </button>
      {showCalendar && (
        <>
          <AvailabilityCalendar booked={booked} selected={date} today={toDateInput(now)} onSelect={setDate} />
          {upcoming.length > 0 && (
            <ul className="pd-booked-list" aria-label="Already booked">
              {upcoming.map(b => <li key={b.startAt}>{formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}</li>)}
            </ul>
          )}
        </>
      )}

      <dl className="pd-quote">
        <div><dt>{pluralUnit(unit.id, qty)} × {inr(product.price)}</dt><dd>{inr(subtotal)}</dd></div>
        {deposit > 0 && <div><dt>Refundable deposit</dt><dd>{inr(deposit)}</dd></div>}
        <div className="pd-quote-total"><dt>Total at pickup</dt><dd>{inr(subtotal + deposit)}</dd></div>
      </dl>

      <label className="pd-field">
        <span>Note for the owner <em>(optional)</em></span>
        <textarea
          className="ln-input"
          rows={2}
          maxLength={500}
          placeholder={product.subcategory === 'Halls & Venues' ? 'Type of event, expected guests…' : 'Event details, delivery address…'}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </label>

      <div className="pd-actions">
        <button type="button" className="ln-btn ln-btn-primary ln-btn-block" disabled={Boolean(busy) || blocked} onClick={() => submit(false)}>
          {busy === 'pickup' ? <Loader2 size={18} className="ln-spin" /> : null}
          Request booking · pay at pickup
        </button>
        {onlineEnabled && (
          <button type="button" className="ln-btn ln-btn-dark ln-btn-block" disabled={Boolean(busy) || blocked} onClick={() => submit(true)}>
            {busy === 'online' ? <Loader2 size={18} className="ln-spin" /> : null}
            Pay {inr(subtotal)} online now
          </button>
        )}
      </div>
      <p className="pd-fine">Nothing is charged until the owner confirms. Show your QR code at pickup and again when you return it.</p>
    </section>
  );
}
