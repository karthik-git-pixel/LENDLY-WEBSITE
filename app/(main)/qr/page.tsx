'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getOrdersByBuyer, type Order } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Copy, Package, Share2, QrCode, ChevronRight, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function MyQRPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUserOrders() {
      if (!user) return;
      try {
        const userOrders = await getOrdersByBuyer(user.uid);
        if (!cancelled) {
          setOrders(userOrders);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoadingOrders(false);
        }
      }
    }

    void loadUserOrders();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const userProfileCode = `RCART-USER-${user?.uid || 'guest'}`;

  const copyProfileCode = () => {
    navigator.clipboard.writeText(userProfileCode);
    toast.success('Member ID copied to clipboard! 📋');
  };

  return (
    <div className="fade-in">
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>My QR Code</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container">
        {/* Navigation Tab Bar */}
        <div className="tab-bar" style={{ marginBottom: 20, padding: 6 }}>
          <button
            className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px' }}
          >
            <QrCode size={16} /> My Member QR
          </button>
          <button
            className={`tab-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px' }}
          >
            <Package size={16} /> Active Orders ({orders.length})
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div className="slide-up">
            {/* User Profile Card */}
            <div style={{
              background: 'var(--gradient-primary)', borderRadius: 24, padding: 24, color: 'white',
              boxShadow: 'var(--shadow-glow)', marginBottom: 24, textAlign: 'center', position: 'relative'
            }}>
              <img
                src={profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid || 'user'}`}
                alt={profile?.displayName || 'User'}
                style={{
                  width: 64, height: 64, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.8)',
                  objectFit: 'cover', margin: '0 auto 12px'
                }}
              />
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{profile?.displayName || 'Lendly Member'}</h2>
              <p style={{ fontSize: 13, opacity: 0.9, margin: '4px 0 14px' }}>{user?.email}</p>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(10px)', padding: '8px 18px', borderRadius: 999
              }}>
                <ShieldCheck size={16} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Verified Local Member
                </span>
              </div>
            </div>

            {/* QR Code Container Card */}
            <div className="glass-card" style={{ padding: 28, textAlign: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--foreground)' }}>
                Member Profile QR
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                Scan to instantly view your profile, listings, and trade history
              </p>

              <div style={{
                background: 'white', padding: 20, borderRadius: 24, display: 'inline-block',
                boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)'
              }}>
                <QRCodeSVG
                  value={userProfileCode}
                  size={210}
                  level="H"
                  includeMargin
                  bgColor="white"
                  fgColor="#000000"
                />
              </div>

              <div style={{
                marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--surface-hover)', padding: '10px 16px', borderRadius: 14, fontSize: 13, fontWeight: 600
              }}>
                <span style={{ color: 'var(--muted)' }}>Member ID:</span>
                <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{userProfileCode}</span>
                <button onClick={copyProfileCode} className="btn-ghost" style={{ padding: 4 }}>
                  <Copy size={15} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={copyProfileCode} className="btn-secondary" style={{ flex: 1, padding: 12 }}>
                <Copy size={16} /> Copy ID
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Lendly Member Profile',
                      text: `Check out my profile on Lendly: ${userProfileCode}`,
                    }).catch(() => {});
                  } else {
                    copyProfileCode();
                  }
                }}
                className="btn-primary"
                style={{ flex: 1, padding: 12 }}
              >
                <Share2 size={16} /> Share QR
              </button>
            </div>
          </div>
        ) : (
          <div className="slide-up">
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14, color: 'var(--foreground)' }}>
              Active Exchange Orders
            </h3>

            {loadingOrders ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="spinner spinner-lg" />
              </div>
            ) : orders.length === 0 ? (
              <div className="empty-state">
                <Package size={44} />
                <h3>No Active Orders Found</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  When you purchase or rent products, their QR verification codes will appear here.
                </p>
                <Link href="/home" style={{ textDecoration: 'none', marginTop: 14, display: 'inline-block' }}>
                  <button className="btn-primary" style={{ padding: '10px 20px' }}>
                    Browse Products
                  </button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="glass-card"
                    style={{ padding: 18, cursor: 'pointer' }}
                    onClick={() => router.push(`/qr/${ord.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <img
                        src={ord.productImage || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=60'}
                        alt={ord.productTitle}
                        style={{ width: 60, height: 60, borderRadius: 14, objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className={`badge ${ord.type === 'rental' ? 'badge-warning' : 'badge-primary'}`}>
                            {ord.type}
                          </span>
                          <span className={`badge ${ord.status === 'completed' ? 'badge-success' : 'badge-primary'}`}>
                            {ord.status}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ord.productTitle}
                        </h4>
                        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', margin: '4px 0 0 0' }}>
                          ₹{ord.amount}
                        </p>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
