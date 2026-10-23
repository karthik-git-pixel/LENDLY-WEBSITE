'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { listenToPrintOrdersByBuyer, type PrintOrder } from '@/lib/firestore';
import {
  Printer,
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  ArrowLeft,
  MessageCircle,
  ExternalLink,
  Phone,
  AlertCircle,
  ChevronRight,
  Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function BuyerPrintOrdersPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/print/orders');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = listenToPrintOrdersByBuyer(profile.uid, (data) => {
      setOrders(data);
      setLoading(false);
    });

    const safetyTimer = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsub();
      clearTimeout(safetyTimer);
    };
  }, [profile]);

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');

  const displayedOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const getStatusBadge = (status: PrintOrder['status']) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning" style={{ fontSize: 11, padding: '3px 8px' }}>🕒 Pending Acceptance</span>;
      case 'accepted':
        return <span className="badge badge-primary" style={{ fontSize: 11, padding: '3px 8px' }}>✓ Order Accepted</span>;
      case 'printing':
        return <span className="badge" style={{ background: '#3b82f6', color: '#fff', fontSize: 11, padding: '3px 8px' }}>🖨️ Printing Now</span>;
      case 'out_for_delivery':
        return <span className="badge" style={{ background: '#8b5cf6', color: '#fff', fontSize: 11, padding: '3px 8px' }}>🚚 Out for Delivery</span>;
      case 'completed':
        return <span className="badge badge-success" style={{ fontSize: 11, padding: '3px 8px' }}>✓ Delivered</span>;
      case 'cancelled':
        return <span className="badge badge-danger" style={{ fontSize: 11, padding: '3px 8px' }}>✕ Cancelled</span>;
    }
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 80, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Top Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#ffffff', borderBottom: '1px solid var(--border-color)',
        padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/print')} className="btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: 'var(--foreground)' }}>
              My Print Orders
            </h1>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>Track your active print requests and delivery</p>
          </div>
        </div>

        <Link href="/print" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ padding: '7px 14px', fontSize: 12, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800 }}>
            <Plus size={15} />
            <span>New Print</span>
          </button>
        </Link>
      </div>

      <div className="page-container" style={{ maxWidth: 760, margin: '0 auto', padding: '16px 16px 40px' }}>
        
        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 18 }}>
          <button
            onClick={() => setActiveTab('active')}
            className={`tab-item ${activeTab === 'active' ? 'active' : ''}`}
            style={activeTab === 'active' ? { background: 'var(--primary)', color: '#fff', fontWeight: 700 } : {}}
          >
            Active Orders ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`tab-item ${activeTab === 'completed' ? 'active' : ''}`}
            style={activeTab === 'completed' ? { background: 'var(--primary)', color: '#fff', fontWeight: 700 } : {}}
          >
            Completed History ({completedOrders.length})
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="glass-card" style={{ padding: 48, textAlign: 'center', borderRadius: 24 }}>
            <Printer size={52} style={{ color: 'var(--primary)', marginBottom: 12, opacity: 0.8 }} />
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: 'var(--foreground)' }}>
              No {activeTab} print orders
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px', maxWidth: 360, marginInline: 'auto' }}>
              {activeTab === 'active'
                ? 'Upload your PDF or image documents and get prints delivered directly to your doorstep in minutes.'
                : 'Your completed and delivered print orders will be listed here.'}
            </p>
            <Link href="/print" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '10px 22px', fontSize: 13, borderRadius: 12, fontWeight: 800 }}>
                Order New Prints
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {displayedOrders.map(order => {
              const timeStr = order.createdAt ? formatDistanceToNow(new Date(order.createdAt.toMillis?.() || Date.now()), { addSuffix: true }) : 'Just now';

              return (
                <div
                  key={order.id}
                  className="glass-card"
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14
                  }}
                >
                  {/* Top Bar: Provider Info & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        position: 'relative', width: 42, height: 42, borderRadius: '50%',
                        overflow: 'hidden', flexShrink: 0, border: '2px solid var(--primary)'
                      }}>
                        <Image
                          src={order.providerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(order.providerName || 'Provider')}&background=0b2240&color=fff`}
                          alt={order.providerName || 'Provider'}
                          fill
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>
                          {order.providerName}
                        </h4>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{timeStr}</div>
                      </div>
                    </div>

                    <div>{getStatusBadge(order.status)}</div>
                  </div>

                  {/* Specifications Pill */}
                  <div style={{
                    background: '#f8fafc', padding: '12px 14px', borderRadius: 14,
                    border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                      <strong>{order.paperSize}</strong> • {order.pageCount} Pages • {order.copies} {order.copies > 1 ? 'Copies' : 'Copy'}
                    </div>
                    <div style={{ fontSize: 12, color: order.colorMode === 'color' ? '#ea580c' : '#475569', fontWeight: 800 }}>
                      {order.colorMode === 'color' ? '🎨 Full Color' : '⚫ Black & White'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                      {order.sides === 'double' ? 'Double-Sided' : 'Single-Sided'} ({order.orientation})
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 900, color: 'var(--primary-dark)' }}>
                      ₹{order.totalAmount}
                    </div>
                  </div>

                  {/* Uploaded Files Links */}
                  {order.fileNames && order.fileNames.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                        Uploaded Files:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {order.fileNames.map((name, i) => (
                          <a
                            key={i}
                            href={order.fileUrls?.[i] || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px', borderRadius: 8, background: '#f1f5f9',
                              border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600,
                              color: 'var(--foreground)', textDecoration: 'none'
                            }}
                          >
                            <FileText size={12} style={{ color: 'var(--primary-dark)' }} />
                            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            <ExternalLink size={10} style={{ color: 'var(--muted)' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delivery Location */}
                  <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Truck size={13} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontWeight: 600 }}>Delivery to:</span>
                    <span style={{ color: 'var(--foreground)' }}>{order.deliveryAddress}</span>
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 10
                  }}>
                    <Link href={`/chat`} style={{ textDecoration: 'none' }}>
                      <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MessageCircle size={14} />
                        <span>Chat Provider</span>
                      </button>
                    </Link>

                    {order.providerPhone && (
                      <a href={`tel:${order.providerPhone}`} style={{ textDecoration: 'none' }}>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={13} />
                          <span>Call Hub</span>
                        </button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
