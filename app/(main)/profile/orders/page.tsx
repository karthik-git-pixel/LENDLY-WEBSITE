'use client';

import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import {
  getOrdersByBuyer,
  getOrdersBySeller,
  updateOrder,
  createReview,
  notifySellerOfReview,
  createReport,
  type Order
} from '@/lib/firestore';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  QrCode,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  Star,
  AlertTriangle,
  ChevronRight,
  X,
  MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// Rental countdown timer component
function RentalCountdownTimer({ order }: { order: Order }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);
  const [overdue, setOverdue] = useState({ hours: 0, fee: 0 });

  useEffect(() => {
    function getStartMs(): number {
      const raw = order.rentalStartedAt;
      if (!raw) return Date.now();
      if (typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof raw.toDate === 'function') return raw.toDate().getTime();
      if (raw instanceof Date) return raw.getTime();
      if (typeof raw === 'string') return new Date(raw).getTime();
      return Date.now();
    }

    const rentalDays = order.rentalDays || 1;
    const startMs = getStartMs();
    const totalDurationMs = rentalDays * 24 * 60 * 60 * 1000;
    const endMs = startMs + totalDurationMs;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = endMs - now;

      if (remaining <= 0) {
        setExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        const lateMs = now - endMs;
        const hoursLate = Math.ceil(lateMs / (1000 * 60 * 60));
        setOverdue({ hours: hoursLate, fee: hoursLate * 10 });
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div style={{
      padding: 16, borderRadius: 16, marginBottom: 16,
      background: expired ? 'rgba(239,68,68,0.06)' : 'rgba(249,115,22,0.06)',
      border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.3)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700, color: expired ? 'var(--danger)' : 'var(--primary)' }}>
        <Clock size={15} /> {expired ? '⚠️ Rental Overdue!' : 'Rental Time Remaining'}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[
          { val: timeLeft.days, label: 'Days' },
          { val: timeLeft.hours, label: 'Hrs' },
          { val: timeLeft.minutes, label: 'Min' },
          { val: timeLeft.seconds, label: 'Sec' },
        ].map((t, i) => (
          <div key={i} style={{
            background: expired ? 'rgba(239,68,68,0.08)' : 'var(--surface)',
            border: `1px solid ${expired ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
            borderRadius: 10, padding: '8px 12px', minWidth: 52, textAlign: 'center'
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: expired ? 'var(--danger)' : 'var(--foreground)' }}>
              {pad(t.val)}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase' }}>{t.label}</div>
          </div>
        ))}
      </div>
      {expired && (
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
          Late by {overdue.hours} hour(s) — Estimated fine: ₹{overdue.fee}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'purchases' | 'sales'>('purchases');
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const uid = profile.uid;
    let cancelled = false;

    async function load() {
      try {
        const [p, s] = await Promise.all([
          getOrdersByBuyer(uid),
          getOrdersBySeller(uid),
        ]);

        if (!cancelled) {
          setPurchases(p);
          setSales(s);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const currentOrders = tab === 'purchases' ? purchases : sales;

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateOrder(orderId, { status: newStatus });
      toast.success(`Order status updated to ${newStatus}`);
      setPurchases(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setSales(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed updating order status');
    }
  };

  const handleSendReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReviewModal || !profile) return;
    setSubmittingReview(true);
    try {
      await createReview({
        orderId: showReviewModal.id,
        buyerId: profile.uid,
        buyerName: profile.displayName || 'Buyer',
        buyerAvatar: profile.avatarUrl || '',
        sellerId: showReviewModal.sellerId,
        productId: showReviewModal.productId,
        rating,
        comment: reviewComment || 'Great transaction! Quick local pickup.',
      });
      toast.success('Thank you! Review submitted successfully ⭐️');
      // Send notification to the seller
      await notifySellerOfReview(
        showReviewModal.sellerId,
        profile.displayName || 'A buyer',
        showReviewModal.productTitle || 'your product',
        rating,
        showReviewModal.productId
      );
      setShowReviewModal(null);
      setReviewComment('');
    } catch (e) {
      console.error(e);
      toast.error('Failed submitting review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDisputeOrder = async (order: Order) => {
    if (!profile) return;
    try {
      await createReport({
        reporterId: profile.uid,
        productId: order.productId,
        sellerId: order.sellerId,
        reason: 'Order Dispute',
        description: `Dispute opened for order ${order.id} (${order.productTitle})`,
      });
      await updateOrder(order.id, { status: 'disputed' });
      toast.success('Dispute submitted. Support team will review the transaction.');
      setSelectedOrder(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to open dispute');
    }
  };

  const formatReturnDate = (value: Order['returnDate']) => {
    if (!value) return '';
    if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString();
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === 'string') {
      return new Date(value).toLocaleDateString();
    }
    return '';
  };

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Order Tracking & Purchases</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container">
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <button className={`tab-item ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>
            Purchases ({purchases.length})
          </button>
          <button className={`tab-item ${tab === 'sales' ? 'active' : ''}`} onClick={() => setTab('sales')}>
            Sales ({sales.length})
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : currentOrders.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={48} style={{ color: 'var(--muted)' }} />
            <h3>No {tab} found</h3>
            <p>Your local orders & rental pickups will appear here.</p>
          </div>
        ) : (
          currentOrders.map(o => {
            const isCompleted = o.status === 'completed';
            const isDisputed = o.status === 'disputed';
            return (
              <div
                key={o.id}
                className="glass-card fade-in"
                onClick={() => setSelectedOrder(o)}
                style={{
                  padding: 16, marginBottom: 14, cursor: 'pointer', transition: 'all 0.2s',
                  borderLeft: isDisputed ? '4px solid var(--danger)' : isCompleted ? '4px solid var(--success)' : '4px solid var(--primary)'
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Image
                    src={o.productImage || 'https://via.placeholder.com/60'}
                    alt={o.productTitle}
                    width={60}
                    height={60}
                    unoptimized
                    style={{ borderRadius: 12, objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{o.productTitle}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      <span className={`badge ${o.type === 'rental' ? 'badge-warning' : 'badge-primary'}`}>
                        {o.type}
                      </span>
                      <span className={`badge ${isCompleted ? 'badge-success' : isDisputed ? 'badge-danger' : 'badge-warning'}`}>
                        {o.status || 'in_transit'}
                      </span>
                    </div>
                    {o.returnDate && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        Return by: {formatReturnDate(o.returnDate)}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary-dark)' }}>₹{o.amount.toLocaleString()}</div>
                    <ChevronRight size={18} style={{ color: 'var(--muted)', marginTop: 4 }} />
                  </div>
                </div>

                {/* Quick Status Bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)', fontSize: 12
                }}>
                  <span style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
                    {o.status === 'completed' ? 'Completed' : (o.status === 'confirmed' || o.status === 'active') ? 'Active Rental' : 'Direct P2P Order'}
                  </span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                    Tap for details ➔
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Order Tracking Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Live Order Tracker</h3>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Order ID: #{selectedOrder.id.slice(-8)}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Direct P2P Guarantee Card */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 18, background: 'rgba(249,115,22,0.08)', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>
                <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                <span>Direct Peer-to-Peer Verified Handover</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0 26px' }}>
                ₹{selectedOrder.amount.toLocaleString()} direct payment confirmed with seller upon QR verification.
              </p>
            </div>

            {/* Live Progress Pipeline */}
            <div style={{ marginBottom: 24, padding: '0 8px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Order Progress:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
                {[
                  { step: 1, title: 'Order Placed', desc: 'Direct P2P Order Initiated', done: true },
                  { step: 2, title: 'Seller Scans QR — Handoff', desc: 'Seller verifies handover via QR code', done: ['confirmed', 'active', 'completed'].includes(selectedOrder.status) },
                  { step: 3, title: selectedOrder.type === 'rental' ? 'Rental Active' : 'Item Received', desc: selectedOrder.type === 'rental' ? 'Timer running — return before deadline' : 'Handover verified and complete', done: ['confirmed', 'active', 'completed'].includes(selectedOrder.status) },
                  { step: 4, title: selectedOrder.type === 'rental' ? 'Returned & Completed' : 'Completed', desc: selectedOrder.type === 'rental' ? 'Seller scans QR again to confirm return' : 'Transaction complete', done: selectedOrder.status === 'completed' },
                ].map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: s.done ? 'var(--primary)' : 'var(--surface-hover)',
                      color: s.done ? 'white' : 'var(--muted)',
                      border: s.done ? 'none' : '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 12, flexShrink: 0
                    }}>
                      {s.done ? <CheckCircle2 size={16} /> : s.step}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: s.done ? 'var(--foreground)' : 'var(--muted)' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rental Countdown Timer — for active rentals */}
            {selectedOrder.type === 'rental' && selectedOrder.status === 'confirmed' && selectedOrder.rentalStartedAt && (
              <RentalCountdownTimer order={selectedOrder} />
            )}

            {/* Late Fee Info for completed rentals */}
            {selectedOrder.type === 'rental' && selectedOrder.status === 'completed' && selectedOrder.lateFee !== undefined && selectedOrder.lateFee > 0 && (
              <div style={{ padding: 14, borderRadius: 14, marginBottom: 16, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>Late Fee Charged</span>
                  <span style={{ fontWeight: 900, color: 'var(--danger)' }}>₹{selectedOrder.lateFee}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => router.push(`/qr/${selectedOrder.id}`)}
                className="btn-primary"
                style={{ width: '100%', padding: 12, justifyContent: 'center' }}
              >
                <QrCode size={18} />
                <span>Show Order QR Code</span>
              </button>

              {tab === 'purchases' && selectedOrder.status === 'completed' && (
                <button
                  onClick={() => {
                    const orderToReview = selectedOrder;
                    setSelectedOrder(null);
                    setShowReviewModal(orderToReview);
                  }}
                  className="btn-secondary"
                  style={{ width: '100%', padding: 12, justifyContent: 'center', color: 'var(--primary-dark)' }}
                >
                  <Star size={18} style={{ color: 'var(--primary)' }} />
                  <span>Rate Seller & Leave Review</span>
                </button>
              )}

              {tab === 'sales' && selectedOrder.status === 'pending' && (
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    router.push('/scan');
                  }}
                  className="btn-secondary"
                  style={{ width: '100%', padding: 12, justifyContent: 'center' }}
                >
                  <QrCode size={18} style={{ color: 'var(--primary)' }} />
                  <span>Scan QR to Confirm Handoff</span>
                </button>
              )}

              <button
                onClick={() => handleDisputeOrder(selectedOrder)}
                className="btn-ghost"
                style={{ width: '100%', padding: 10, color: 'var(--danger)', fontSize: 12 }}
              >
                <AlertTriangle size={15} />
                <span>Report Issue / Open Dispute</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Rating Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(null)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Rate & Review Seller</h3>
              <button onClick={() => setShowReviewModal(null)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendReview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Select Star Rating:</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRating(s)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Star
                        size={30}
                        style={{
                          color: s <= rating ? '#f97316' : 'var(--border-color)',
                          fill: s <= rating ? '#f97316' : 'none'
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="input-label">Written Feedback:</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="How was the local handover? Fast response, item condition..."
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowReviewModal(null)} className="btn-secondary" style={{ flex: 1, padding: 12 }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: 12 }} disabled={submittingReview}>
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
