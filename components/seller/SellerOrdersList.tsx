'use client';

import { useState } from 'react';
import Image from '@/components/AppImage';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  Clock,
  MessageCircle,
  QrCode,
  ShieldCheck,
  User,
  X,
  Loader2,
  ScanLine,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openChat } from '@/lib/chat';
import {
  respondToOrder,
  scanHandover,
  type Order,
} from '@/lib/supabase-db';
import { formatDate, formatRange } from '@/lib/time';
import { paymentLabel, rentBreakdown, statusLabel, statusTone } from '@/lib/orders';
import Sheet from '@/components/ui/Sheet';

interface SellerOrdersListProps {
  orders: Order[];
  onRefresh: () => void;
  onOpenScanner?: () => void;
}

type FilterTab = 'all' | 'pending' | 'accepted' | 'active' | 'completed';

export default function SellerOrdersList({ orders, onRefresh, onOpenScanner }: SellerOrdersListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codePromptOrder, setCodePromptOrder] = useState<Order | null>(null);
  const [inputCode, setInputCode] = useState('');

  const pendingList = orders.filter(o => o.status === 'pending');
  const acceptedList = orders.filter(o => o.status === 'accepted');
  const activeList = orders.filter(o => o.status === 'active');
  const completedList = orders.filter(o => o.status === 'completed');

  const filteredOrders =
    filter === 'pending'
      ? pendingList
      : filter === 'accepted'
        ? acceptedList
        : filter === 'active'
          ? activeList
          : filter === 'completed'
            ? completedList
            : orders;

  const handleConfirm = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await respondToOrder(orderId, true);
      toast.success('Booking confirmed! Customer has been notified.');
      onRefresh();
      setSelectedOrder(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not confirm booking');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (orderId: string) => {
    const reason = prompt('Reason for declining this request (optional):') ?? '';
    setBusyId(orderId);
    try {
      await respondToOrder(orderId, false, reason);
      toast.success('Booking request declined');
      onRefresh();
      setSelectedOrder(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline request');
    } finally {
      setBusyId(null);
    }
  };

  const handleCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setBusyId('verify');
    try {
      const res = await scanHandover(inputCode.trim());
      toast.success(
        res.action === 'rental_started'
          ? 'Rental started! Picked up by customer.'
          : res.action === 'rental_returned'
            ? 'Return approved! Rental completed.'
            : 'Handover complete!'
      );
      setInputCode('');
      setCodePromptOrder(null);
      setSelectedOrder(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusyId(null);
    }
  };

  const chat = async (o: Order) => {
    try {
      const chatId = await openChat(o.buyerId, o.productId);
      router.push(`/chat/${chatId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open chat');
    }
  };

  return (
    <div className="sh-orders-container">
      {/* Filter Tabs */}
      <div className="sh-order-filter-bar">
        <button
          type="button"
          className={`sh-filter-pill ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({orders.length})
        </button>
        <button
          type="button"
          className={`sh-filter-pill ${filter === 'pending' ? 'is-active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Needs Approval ({pendingList.length})
        </button>
        <button
          type="button"
          className={`sh-filter-pill ${filter === 'accepted' ? 'is-active' : ''}`}
          onClick={() => setFilter('accepted')}
        >
          Ready for Pickup ({acceptedList.length})
        </button>
        <button
          type="button"
          className={`sh-filter-pill ${filter === 'active' ? 'is-active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Out on Rent ({activeList.length})
        </button>
        <button
          type="button"
          className={`sh-filter-pill ${filter === 'completed' ? 'is-active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Returned ({completedList.length})
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="ln-empty" style={{ padding: '36px 16px' }}>
          <h3>No {filter === 'all' ? 'customer bookings' : `${filter} bookings`}</h3>
          <p>When customers reserve or borrow items from your shop, they will appear here.</p>
        </div>
      ) : (
        <ul className="sh-order-list">
          {filteredOrders.map(o => {
            const isPending = o.status === 'pending';
            const isAccepted = o.status === 'accepted';
            const isActive = o.status === 'active';
            const isCompleted = o.status === 'completed';

            return (
              <li key={o.id} className="sh-order-card">
                {/* Header: Customer Info & Status */}
                <div className="sh-order-top" onClick={() => setSelectedOrder(o)} role="button" tabIndex={0}>
                  <div className="sh-order-customer">
                    <div className="sh-customer-avatar-sm">
                      {o.buyer?.avatarUrl ? (
                        <Image src={o.buyer.avatarUrl} alt="" fill sizes="36px" />
                      ) : (
                        <User size={18} />
                      )}
                    </div>
                    <div>
                      <h4>{o.buyer?.displayName || 'Customer'}</h4>
                      <span className="sh-customer-date">{formatDate(o.createdAt)}</span>
                    </div>
                  </div>
                  <span className={`od-status is-${statusTone(o)}`}>
                    {statusLabel(o, 'seller')}
                  </span>
                </div>

                {/* Product & Rent Details */}
                <div className="sh-order-body" onClick={() => setSelectedOrder(o)} role="button" tabIndex={0}>
                  <div className="sh-order-img">
                    {o.productImage ? (
                      <Image src={o.productImage} alt="" fill sizes="64px" />
                    ) : (
                      <QrCode size={24} />
                    )}
                  </div>
                  <div className="sh-order-details">
                    <h5>{o.productTitle}</h5>
                    {o.orderType === 'rent' && o.startAt && (
                      <p className="sh-order-time">
                        <CalendarDays size={13} aria-hidden="true" />
                        <span>{formatRange(o.startAt, o.endAt)}</span>
                      </p>
                    )}
                    <p className="sh-order-price">
                      <strong>₹{Math.round(o.amount).toLocaleString('en-IN')}</strong>
                      <span> · {paymentLabel(o)}</span>
                      {o.depositAmount > 0 && <span> · ₹{Math.round(o.depositAmount).toLocaleString('en-IN')} deposit</span>}
                    </p>
                  </div>
                </div>

                {/* Actions: Direct Seller Approval */}
                <div className="sh-order-actions">
                  {isPending && (
                    <>
                      <button
                        type="button"
                        className="ln-btn ln-btn-primary ln-btn-sm"
                        disabled={busyId === o.id}
                        onClick={() => handleConfirm(o.id)}
                      >
                        {busyId === o.id ? (
                          <Loader2 size={14} className="ln-spin" />
                        ) : (
                          <Check size={14} aria-hidden="true" />
                        )}
                        Confirm Booking
                      </button>
                      <button
                        type="button"
                        className="ln-btn ln-btn-danger ln-btn-sm"
                        disabled={busyId === o.id}
                        onClick={() => handleDecline(o.id)}
                      >
                        <X size={14} aria-hidden="true" /> Decline
                      </button>
                    </>
                  )}

                  {isAccepted && (
                    <button
                      type="button"
                      className="ln-btn ln-btn-primary ln-btn-sm"
                      onClick={() => setCodePromptOrder(o)}
                    >
                      <ScanLine size={14} aria-hidden="true" /> Mark Picked Up (Enter Code)
                    </button>
                  )}

                  {isActive && (
                    <button
                      type="button"
                      className="ln-btn ln-btn-primary ln-btn-sm"
                      onClick={() => setCodePromptOrder(o)}
                    >
                      <Check size={14} aria-hidden="true" /> Approve Return
                    </button>
                  )}

                  {isCompleted && (
                    <span className="sh-order-done-badge">
                      <ShieldCheck size={14} /> Return Approved &amp; Complete
                    </span>
                  )}

                  <button
                    type="button"
                    className="ln-btn ln-btn-ghost ln-btn-sm"
                    onClick={() => chat(o)}
                    title="Chat with customer"
                  >
                    <MessageCircle size={14} aria-hidden="true" /> Chat
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Code Input Modal for Pickup/Return Approval */}
      <Sheet open={Boolean(codePromptOrder)} onClose={() => setCodePromptOrder(null)}>
        {codePromptOrder && (
          <div className="sh-scan-modal-inner">
            <div className="sh-scan-modal-head">
              <div>
                <h2>
                  {codePromptOrder.status === 'accepted'
                    ? 'Approve Pickup Handover'
                    : 'Approve Rental Return'}
                </h2>
                <p className="ln-sub">
                  Enter the customer’s handover code from their &quot;Your booking&quot; screen
                </p>
              </div>
              <button
                type="button"
                className="ln-icon-btn"
                onClick={() => setCodePromptOrder(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sh-customer-card" style={{ marginTop: 12 }}>
              <div className="sh-customer-avatar">
                {codePromptOrder.buyer?.avatarUrl ? (
                  <Image src={codePromptOrder.buyer.avatarUrl} alt="" fill sizes="48px" />
                ) : (
                  <User size={24} />
                )}
              </div>
              <div className="sh-customer-meta">
                <h4>{codePromptOrder.buyer?.displayName || 'Customer'}</h4>
                <p>{codePromptOrder.productTitle}</p>
              </div>
            </div>

            <form onSubmit={handleCodeVerify} style={{ marginTop: 16 }}>
              <label htmlFor="modal-handover-code" className="ln-field-label">
                Customer Handover Code
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  id="modal-handover-code"
                  className="ln-input"
                  placeholder="e.g. LND-C4AE6B80BE"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  autoFocus
                />
                <button
                  type="submit"
                  className="ln-btn ln-btn-primary"
                  disabled={busyId === 'verify' || !inputCode.trim()}
                >
                  {busyId === 'verify' ? (
                    <Loader2 size={16} className="ln-spin" />
                  ) : codePromptOrder.status === 'accepted' ? (
                    'Approve Pickup'
                  ) : (
                    'Approve Return'
                  )}
                </button>
              </div>
            </form>

            {onOpenScanner && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <span className="ln-sub" style={{ display: 'block', marginBottom: 8 }}>— or —</span>
                <button
                  type="button"
                  className="ln-btn ln-btn-ghost ln-btn-sm"
                  onClick={() => {
                    setCodePromptOrder(null);
                    onOpenScanner();
                  }}
                >
                  <ScanLine size={15} /> Use camera scanner instead
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* Customer & Order Inspection Modal */}
      <Sheet open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)}>
        {selectedOrder && (
          <div className="sh-scan-modal-inner">
            <div className="sh-scan-modal-head">
              <div>
                <h2>Customer Booking Details</h2>
                <p className="ln-sub">Order ID: {selectedOrder.id.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                className="ln-icon-btn"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer Information */}
            <div className="sh-customer-card" style={{ marginTop: 12 }}>
              <div className="sh-customer-avatar">
                {selectedOrder.buyer?.avatarUrl ? (
                  <Image src={selectedOrder.buyer.avatarUrl} alt="" fill sizes="48px" />
                ) : (
                  <User size={24} />
                )}
              </div>
              <div className="sh-customer-meta">
                <span className="sh-customer-badge">
                  <ShieldCheck size={12} /> Verified Customer
                </span>
                <h4>{selectedOrder.buyer?.displayName || 'Customer'}</h4>
                <p>Member on Lendly</p>
              </div>
              <button
                type="button"
                className="ln-btn ln-btn-ghost ln-btn-sm"
                onClick={() => chat(selectedOrder)}
              >
                <MessageCircle size={15} /> Chat
              </button>
            </div>

            {/* Product Details */}
            <div className="sh-scanned-item-card" style={{ marginTop: 12 }}>
              <div className="sh-scanned-item-row">
                {selectedOrder.productImage && (
                  <div className="sh-scanned-item-img">
                    <Image src={selectedOrder.productImage} alt="" fill sizes="60px" />
                  </div>
                )}
                <div>
                  <h5>{selectedOrder.productTitle}</h5>
                  <span className={`od-status is-${statusTone(selectedOrder)}`}>
                    {statusLabel(selectedOrder, 'seller')}
                  </span>
                </div>
              </div>

              {selectedOrder.orderType === 'rent' && selectedOrder.startAt && (
                <div className="sh-scanned-dates" style={{ marginTop: 10 }}>
                  <CalendarDays size={14} />
                  <span>{formatRange(selectedOrder.startAt, selectedOrder.endAt)}</span>
                </div>
              )}

              <div className="sh-scanned-checklist" style={{ marginTop: 10 }}>
                <div>
                  <span>Rent Fee:</span>
                  <strong>₹{Math.round(selectedOrder.amount).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span>Refundable Deposit:</span>
                  <strong>
                    {selectedOrder.depositAmount > 0
                      ? `₹${Math.round(selectedOrder.depositAmount).toLocaleString('en-IN')}`
                      : 'None'}
                  </strong>
                </div>
                <div>
                  <span>Payment Method:</span>
                  <strong>{paymentLabel(selectedOrder)}</strong>
                </div>
                <div>
                  <span>Payment Status:</span>
                  <strong className={selectedOrder.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                    {selectedOrder.paymentStatus}
                  </strong>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="sh-scanned-actions" style={{ marginTop: 16 }}>
              {selectedOrder.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="ln-btn ln-btn-primary ln-btn-block"
                    disabled={busyId === selectedOrder.id}
                    onClick={() => handleConfirm(selectedOrder.id)}
                  >
                    <Check size={16} /> Confirm Booking
                  </button>
                  <button
                    type="button"
                    className="ln-btn ln-btn-danger ln-btn-block"
                    disabled={busyId === selectedOrder.id}
                    onClick={() => handleDecline(selectedOrder.id)}
                  >
                    <X size={16} /> Decline Request
                  </button>
                </>
              )}

              {selectedOrder.status === 'accepted' && (
                <button
                  type="button"
                  className="ln-btn ln-btn-primary ln-btn-block"
                  onClick={() => {
                    const o = selectedOrder;
                    setSelectedOrder(null);
                    setCodePromptOrder(o);
                  }}
                >
                  <ScanLine size={16} /> Mark Picked Up (Enter Customer Code)
                </button>
              )}

              {selectedOrder.status === 'active' && (
                <button
                  type="button"
                  className="ln-btn ln-btn-primary ln-btn-block"
                  onClick={() => {
                    const o = selectedOrder;
                    setSelectedOrder(null);
                    setCodePromptOrder(o);
                  }}
                >
                  <Check size={16} /> Approve Return &amp; Refund Deposit
                </button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
