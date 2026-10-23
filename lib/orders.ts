import type { Order } from './supabase-db';
import { rentUnitInfo } from './catalog';
import { toMillis } from './time';

export type Role = 'buyer' | 'seller';

/** Badge text for an order, worded for whoever is looking at it */
export function statusLabel(order: Order, role: Role): string {
  const rent = order.orderType === 'rent';
  switch (order.status) {
    case 'pending': return role === 'seller' ? 'Needs your reply' : 'Waiting for seller';
    case 'accepted': return rent ? 'Booking confirmed' : 'Reserved for you';
    case 'active': return 'Rental in progress';
    case 'completed': return rent ? 'Returned' : 'Completed';
    case 'declined': return 'Declined';
    case 'cancelled': return 'Cancelled';
    default: return order.status;
  }
}

export type StatusTone = 'pending' | 'good' | 'active' | 'done' | 'bad';

export function statusTone(order: Order): StatusTone {
  switch (order.status) {
    case 'pending': return 'pending';
    case 'accepted': return 'good';
    case 'active': return 'active';
    case 'completed': return 'done';
    default: return 'bad';
  }
}

/** The steps shown on an order's progress tracker */
export function orderSteps(order: Order): { label: string; done: boolean }[] {
  const rent = order.orderType === 'rent';
  const s = order.status;
  const accepted = ['accepted', 'active', 'completed'].includes(s);
  if (rent) {
    return [
      { label: 'Requested', done: true },
      { label: 'Confirmed', done: accepted },
      { label: 'Picked up', done: s === 'active' || s === 'completed' },
      { label: 'Returned', done: s === 'completed' },
    ];
  }
  return [
    { label: 'Requested', done: true },
    { label: 'Reserved', done: accepted },
    { label: 'Handed over', done: s === 'completed' },
  ];
}

export function isOpenOrder(order: Order): boolean {
  return ['pending', 'accepted', 'active'].includes(order.status);
}

/** How long until (or since) a rental is due back */
export function dueInfo(order: Order, now: number): { overdue: boolean; text: string } | null {
  if (order.orderType !== 'rent' || !order.endAt) return null;
  const end = toMillis(order.endAt);
  const diff = end - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const d = Math.floor(h / 24);
  const m = Math.floor((abs % 3600000) / 60000);
  const span = d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? { overdue: false, text: `Due back in ${span}` } : { overdue: true, text: `Overdue by ${span}` };
}

/** "3 days × ₹2,500" */
export function rentBreakdown(order: Order): string {
  if (order.orderType !== 'rent' || !order.rate) return '';
  const unit = rentUnitInfo(order.rentUnit);
  const word = unit.short === 'hr' ? 'hour' : unit.short;
  return `${order.units} ${word}${order.units === 1 ? '' : 's'} × ₹${Math.round(order.rate).toLocaleString('en-IN')}`;
}

export function paymentLabel(order: Order): string {
  if (order.paymentMethod === 'online') {
    if (order.paymentStatus === 'refund_pending') return 'Paid online · refund pending';
    if (order.paymentStatus === 'refunded') return 'Paid online · refunded';
    return 'Paid online';
  }
  return order.status === 'completed' ? 'Paid at pickup' : 'Pay at pickup';
}
