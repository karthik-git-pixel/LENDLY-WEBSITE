'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from '@/components/AppImage';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Check, MessageCircle, QrCode, ScanLine, Star, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import {
  cancelOrder, getOrdersByBuyer, getOrdersBySeller, getReviewedOrderIds, respondToOrder, submitReview,
  subscribeToMyOrders, type Order,
} from '@/lib/supabase-db';
import { openChat } from '@/lib/chat';
import { requestRefund } from '@/lib/checkout';
import { dueInfo, paymentLabel, rentBreakdown, statusLabel, statusTone, type Role } from '@/lib/orders';
import { formatDate, formatRange } from '@/lib/time';
import Sheet from '@/components/ui/Sheet';

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="ln-page"><div className="ln-shell"><div className="ln-skel" style={{ height: 200, borderRadius: 16, marginTop: 20 }} /></div></div>}>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const highlight = params.get('order');
  const [role, setRole] = useState<Role>(params.get('role') === 'seller' ? 'seller' : 'buyer');
  const [kind, setKind] = useState<'rent' | 'sale'>('rent');
  const [buying, setBuying] = useState<Order[] | null>(null);
  const [selling, setSelling] = useState<Order[] | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<Order | null>(null);
  const [now] = useState(() => Date.now());
  const uid = profile?.uid;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?redirect=/profile/orders');
  }, [authLoading, user, router]);

  const load = useCallback(() => {
    if (!uid) return;
    Promise.all([getOrdersByBuyer(uid), getOrdersBySeller(uid)]).then(async ([b, s]) => {
      setBuying(b);
      setSelling(s);
      setReviewed(await getReviewedOrderIds(b.filter(o => o.status === 'completed').map(o => o.id)));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
    return subscribeToMyOrders(uid, load);
  }, [uid, load]);

  // Jump to the order a notification pointed at
  useEffect(() => {
    if (!highlight || !buying || !selling) return;
    const inSelling = selling.find(o => o.id === highlight);
    const target = inSelling || buying.find(o => o.id === highlight);
    if (!target) return;
    const timer = setTimeout(() => {
      setRole(inSelling ? 'seller' : 'buyer');
      setKind(target.orderType === 'rent' ? 'rent' : 'sale');
      setTimeout(() => document.getElementById(`order-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }, 0);
    return () => clearTimeout(timer);
  }, [highlight, buying, selling]);

  const list = useMemo(
    () => (role === 'buyer' ? buying : selling)?.filter(o => (kind === 'rent' ? o.orderType === 'rent' : o.orderType !== 'rent')) ?? null,
    [role, kind, buying, selling]
  );
  const pendingForMe = (selling || []).filter(o => o.status === 'pending').length;

  const run = async (id: string, fn: () => Promise<Order | void>, success: string) => {
    setBusy(id);
    try {
      const result = await fn();
      if (result && result.paymentStatus === 'refund_pending') {
        await requestRefund(result.id).then(() => toast.success('Refund started')).catch(err => toast.error(err.message));
      }
      toast.success(success);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const chat = async (o: Order) => {
    try { router.push(`/chat/${await openChat(role === 'buyer' ? o.sellerId : o.buyerId, o.productId)}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not open chat'); }
  };

  return (
    <div className="ln-page">
      <div className="top-header">
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Bookings &amp; orders</h1>
        <Link href="/scan" className="ln-btn ln-btn-ghost ln-btn-sm"><ScanLine size={16} aria-hidden="true" /> Scan QR</Link>
      </div>
      <div className="ln-shell" style={{ paddingTop: 14 }}>
        <div className="ln-seg" role="tablist">
          <button type="button" role="tab" className="ln-seg-btn" aria-pressed={role === 'buyer'} onClick={() => setRole('buyer')}>My bookings</button>
          <button type="button" role="tab" className="ln-seg-btn" aria-pressed={role === 'seller'} onClick={() => setRole('seller')}>
            Requests for me{pendingForMe ? ` (${pendingForMe})` : ''}
          </button>
        </div>
        <div className="ln-tabs" style={{ marginTop: 12 }}>
          <button type="button" className="ln-tab" aria-selected={kind === 'rent'} onClick={() => setKind('rent')}>Rentals</button>
          <button type="button" className="ln-tab" aria-selected={kind === 'sale'} onClick={() => setKind('sale')}>Purchases</button>
        </div>

        {!list ? (
          <div className="ln-skel" style={{ height: 160, borderRadius: 16, marginTop: 16 }} />
        ) : list.length === 0 ? (
          <div className="ln-empty">
            <h2>{role === 'buyer' ? `No ${kind === 'rent' ? 'rentals' : 'purchases'} yet` : `No ${kind === 'rent' ? 'booking' : 'purchase'} requests yet`}</h2>
            <p>{role === 'buyer' ? 'Find something nearby and book it in a tap.' : 'Requests for your listings will show up here.'}</p>
            <div className="ln-empty-actions">
              <Link href={role === 'buyer' ? `/home?type=${kind}` : '/sell/new'} className="ln-btn ln-btn-primary">{role === 'buyer' ? 'Browse nearby' : 'List an item'}</Link>
            </div>
          </div>
        ) : (
          <ul className="od-list">
            {list.map(o => {
              const other = role === 'buyer' ? o.seller : o.buyer;
              const due = o.status === 'active' ? dueInfo(o, now) : null;
              return (
                <li key={o.id} id={`order-${o.id}`} className={`od-card ${highlight === o.id ? 'is-highlight' : ''}`}>
                  <div className="od-top">
                    <Link href={o.productId ? `/product/${o.productId}` : '#'} className="od-img">
                      {o.productImage && <Image src={o.productImage} alt="" fill sizes="72px" />}
                    </Link>
                    <div className="od-info">
                      <span className={`od-status is-${statusTone(o)}`}>{statusLabel(o, role)}</span>
                      <h3>{o.productTitle}</h3>
                      <p>{role === 'buyer' ? 'From ' : 'By '}{other?.storeName || other?.displayName || 'Lendly member'} · {formatDate(o.createdAt)}</p>
                    </div>
                    <strong className="od-amount">₹{Math.round(o.amount).toLocaleString('en-IN')}</strong>
                  </div>
                  {o.orderType === 'rent' && o.startAt && (
                    <p className="od-line"><CalendarDays size={14} aria-hidden="true" /> {formatRange(o.startAt, o.endAt)} · {rentBreakdown(o)}</p>
                  )}
                  <p className="od-line">{paymentLabel(o)}{o.depositAmount ? ` · ₹${Math.round(o.depositAmount).toLocaleString('en-IN')} deposit` : ''}{o.lateFee ? ` · Late fee ₹${o.lateFee}` : ''}</p>
                  {due && <p className={`od-line ${due.overdue ? 'is-bad' : ''}`}>{due.text}</p>}
                  {o.notes && <p className="od-note">“{o.notes}”</p>}
                  {(o.status === 'declined' || o.status === 'cancelled') && o.declineReason && <p className="od-line is-bad">{o.declineReason}</p>}

                  <div className="od-actions">
                    {role === 'seller' && o.status === 'pending' && (
                      <>
                        <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" disabled={busy === o.id} onClick={() => run(o.id, () => respondToOrder(o.id, true), 'Accepted — the buyer has been notified')}>
                          <Check size={15} aria-hidden="true" /> Accept
                        </button>
                        <button type="button" className="ln-btn ln-btn-danger ln-btn-sm" disabled={busy === o.id} onClick={() => run(o.id, () => respondToOrder(o.id, false, ''), 'Declined')}>
                          <X size={15} aria-hidden="true" /> Decline
                        </button>
                      </>
                    )}
                    {role === 'seller' && (o.status === 'accepted' || o.status === 'active') && (
                      <Link href="/scan" className="ln-btn ln-btn-primary ln-btn-sm">
                        <ScanLine size={15} aria-hidden="true" /> {o.status === 'active' ? 'Scan to take back' : 'Scan to hand over'}
                      </Link>
                    )}
                    {role === 'buyer' && ['pending', 'accepted', 'active'].includes(o.status) && (
                      <Link href={`/qr/${o.id}`} className="ln-btn ln-btn-primary ln-btn-sm"><QrCode size={15} aria-hidden="true" /> Show QR</Link>
                    )}
                    {role === 'buyer' && o.status === 'completed' && !reviewed.has(o.id) && (
                      <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" onClick={() => setReviewFor(o)}><Star size={15} aria-hidden="true" /> Review</button>
                    )}
                    {((role === 'buyer' && ['pending', 'accepted'].includes(o.status)) || (role === 'seller' && o.status === 'accepted')) && (
                      <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" disabled={busy === o.id}
                        onClick={() => { if (confirm('Cancel this order?')) void run(o.id, () => cancelOrder(o.id), 'Order cancelled'); }}>
                        Cancel
                      </button>
                    )}
                    <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => chat(o)}><MessageCircle size={15} aria-hidden="true" /> Chat</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ReviewSheet order={reviewFor} onClose={() => setReviewFor(null)} onDone={id => { setReviewed(prev => new Set(prev).add(id)); setReviewFor(null); }} />
    </div>
  );
}

function ReviewSheet({ order, onClose, onDone }: { order: Order | null; onClose: () => void; onDone: (id: string) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  if (!order) return null;
  const send = async () => {
    setSending(true);
    try {
      await submitReview(order.id, rating, comment.trim());
      toast.success('Thanks for the review!');
      onDone(order.id);
      setComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Rate your experience"
      footer={<button type="button" className="ln-btn ln-btn-primary ln-btn-block" disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Submit review'}</button>}>
      <p className="ln-note">{order.productTitle}</p>
      <div style={{ display: 'flex', gap: 6, margin: '14px 0' }} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="ln-icon-btn" onClick={() => setRating(n)}>
            <Star size={28} fill={n <= rating ? '#f59e0b' : 'none'} color={n <= rating ? '#f59e0b' : '#cbd5e1'} />
          </button>
        ))}
      </div>
      <textarea className="ln-input" rows={3} placeholder="How was the handover and the item?" value={comment} onChange={e => setComment(e.target.value)} />
    </Sheet>
  );
}
