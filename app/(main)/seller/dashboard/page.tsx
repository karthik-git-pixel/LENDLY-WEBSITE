'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProductsBySeller, getOrdersBySeller, type Product, type Order } from '@/lib/firestore';
import { deleteProduct, updateUserProfile, promoteProduct } from '@/lib/firestore';

const PROMOTION_PLANS = [
  { days: 7, label: '7 Days', price: 99, badge: 'Popular', desc: '₹14 / day' },
  { days: 14, label: '14 Days', price: 179, badge: 'Best Value', desc: 'Save 10%' },
  { days: 30, label: '30 Days', price: 299, badge: 'Maximum Reach', desc: 'Save 25%' },
];

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Package, ShoppingBag, DollarSign, Star, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, PlusCircle, Edit, Eye, Trash2,
  BarChart3, Users, ChevronRight, QrCode, ArrowUpRight, Search,
  Filter, Wallet, ShieldCheck, RefreshCw, Calendar, Sparkles, ExternalLink,
  Camera, Image as ImageIcon, Upload, Rocket, Flame, Check
} from 'lucide-react';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { authFetch } from '@/lib/auth-fetch';
import Link from 'next/link';

type TabKey = 'overview' | 'products' | 'orders';
type Timeframe = '7d' | '30d' | 'all';

export default function SellerDashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');
  const [productFilter, setProductFilter] = useState<'all' | 'available' | 'rented' | 'sold'>('all');
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');

  // QR Modal States
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrType, setQrType] = useState<'pickup' | 'return'>('pickup');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Promote Ad Modal States
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedPromoteProduct, setSelectedPromoteProduct] = useState<Product | null>(null);
  const [promoteDays, setPromoteDays] = useState<number>(7);
  const [promoting, setPromoting] = useState(false);

  // Hovered Chart Point
  const [hoveredPoint, setHoveredPoint] = useState<{ day: string; amount: number; orders: number } | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setUploadingAvatar(true);
      const url = await uploadImageToCloudinary(file, user.uid, 'avatar');
      await updateUserProfile(user.uid, { avatarUrl: url });
      await refreshProfile();
      toast.success('Store profile photo updated!');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setUploadingCover(true);
      const url = await uploadImageToCloudinary(file, user.uid, 'cover');
      await updateUserProfile(user.uid, { coverUrl: url });
      await refreshProfile();
      toast.success('Store cover image updated!');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to upload cover';
      toast.error(msg);
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePromoteSubmit = async () => {
    if (!selectedPromoteProduct) return;
    try {
      setPromoting(true);
      await promoteProduct(selectedPromoteProduct.id, promoteDays);
      setProducts(prev => prev.map(p => p.id === selectedPromoteProduct.id ? { ...p, isPromoted: true } : p));
      toast.success(`🚀 "${selectedPromoteProduct.title}" is now Promoted to Top for ${promoteDays} days!`);
      setShowPromoteModal(false);
      setSelectedPromoteProduct(null);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to promote ad');
    } finally {
      setPromoting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const [prods, ords] = await Promise.all([
          getProductsBySeller(user!.uid),
          getOrdersBySeller(user!.uid),
        ]);
        if (cancelled) return;
        setProducts(prods);
        setOrders(ords);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [user]);

  // ─── Computed Stats ───
  const stats = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const confirmedOrders = orders.filter(o => o.status === 'confirmed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    const totalLateFees = completedOrders.reduce((sum, o) => sum + (o.lateFee || 0), 0);
    const purchaseOrders = orders.filter(o => o.type === 'purchase');
    const rentalOrders = orders.filter(o => o.type === 'rental');
    const availableProducts = products.filter(p => p.status === 'available');
    const soldProducts = products.filter(p => p.status === 'sold');
    const rentedProducts = products.filter(p => p.status === 'rented');
    const escrowHeld = orders.filter(o => o.escrowLocked).reduce((sum, o) => sum + (o.escrowAmount || 0), 0);

    return {
      totalRevenue, totalLateFees, escrowHeld,
      completedOrders, pendingOrders, confirmedOrders,
      purchaseOrders, rentalOrders,
      availableProducts, soldProducts, rentedProducts,
    };
  }, [orders, products]);

  // ─── Dynamic Revenue Chart Data ───
  const chartData = useMemo(() => {
    const daysCount = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 14;
    const points: { day: string; amount: number; orders: number }[] = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayLabel = daysCount <= 7 
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : `${d.getDate()}/${d.getMonth() + 1}`;

      const dayStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
      const dayEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();

      const dayOrders = orders.filter(o => {
        let t = 0;
        const ca = o.createdAt as any;
        if (ca?.toDate) t = ca.toDate().getTime();
        else if (ca?.seconds) t = ca.seconds * 1000;
        else if (ca instanceof Date) t = ca.getTime();
        else if (typeof ca === 'number') t = ca;
        return t >= dayStart && t <= dayEnd;
      });

      const dayAmount = dayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
      points.push({ day: dayLabel, amount: dayAmount, orders: dayOrders.length });
    }

    const maxVal = Math.max(...points.map(p => p.amount), 500);
    return { points, maxVal };
  }, [orders, timeframe]);

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Listing removed');
    } catch {
      toast.error('Failed to delete listing');
    }
  };

  const generateQR = async (orderId: string, type: 'pickup' | 'return') => {
    setSelectedOrderId(orderId);
    setQrLoading(true);
    setShowQRModal(true);
    setQrToken(null);
    setQrType(type);
    
    try {
      const res = await authFetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, type }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setQrToken(data.token);
      setQrExpiry(data.expiresAt);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate QR code';
      toast.error(msg);
      setShowQRModal(false);
    } finally {
      setQrLoading(false);
    }
  };



  if (!user || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const filteredProducts = products.filter(p => {
    const matchesFilter = productFilter === 'all' || p.status === productFilter;
    const matchesSearch = !productSearch.trim() || p.title.toLowerCase().includes(productSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  const tabs = [
    { key: 'overview' as const, label: 'Analytics & Revenue', icon: BarChart3 },
    { key: 'products' as const, label: `My Ads & Inventory (${products.length})`, icon: Flame },
    { key: 'orders' as const, label: `Orders (${orders.length})`, icon: ShoppingBag },
  ];

  return (
    <div style={{ paddingBottom: 110 }} className="fade-in">
      {/* Top Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} className="btn-ghost" style={{ padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={18} />
            <span className="desktop-only">Back</span>
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.5px' }}>
              Seller Command Center
            </h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
              Track earnings, manage inventory, and verify instant local QR pickups
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/sell/new')} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800 }}>
            <PlusCircle size={16} />
            <span>New Listing</span>
          </button>
        </div>
      </div>

      {/* QR Code Handover Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6, color: 'var(--foreground)' }}>
              {qrType === 'pickup' ? 'Handover Verification QR' : 'Return Verification QR'}
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
              Ask the buyer to scan this dynamic QR code with their Lendly app to confirm handover.
            </p>
            
            {qrLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                <div className="spinner spinner-lg" />
              </div>
            ) : qrToken ? (
              <div style={{ background: 'white', padding: 22, borderRadius: 24, display: 'inline-block', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)', marginBottom: 16 }}>
                <QRCodeSVG value={qrToken} size={220} level="H" includeMargin bgColor="white" fgColor="#000000" />
              </div>
            ) : null}

            {qrExpiry && (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Clock size={14} /> Expires at {new Date(qrExpiry).toLocaleTimeString()}
              </div>
            )}

            <button onClick={() => setShowQRModal(false)} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: 14 }}>
              Done & Close
            </button>
          </div>
        </div>
      )}



      {/* Promote Ad Modal */}
      {showPromoteModal && selectedPromoteProduct && (
        <div className="modal-overlay" onClick={() => setShowPromoteModal(false)}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 480, padding: 26, borderRadius: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 6px 18px rgba(249,115,22,0.35)'
              }}>
                <Rocket size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                  Promote Ad to Top
                </h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  Boost visibility across 0–30km neighborhood feeds
                </p>
              </div>
            </div>

            {/* Target Product Summary */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 16,
              background: 'var(--surface-hover)',
              border: '1px solid var(--border-color)',
              marginBottom: 18
            }}>
              <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <Image
                  src={selectedPromoteProduct.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800'}
                  alt=""
                  fill
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedPromoteProduct.title}
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary-dark)', marginTop: 2 }}>
                  ₹{selectedPromoteProduct.price.toLocaleString()}
                </div>
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 900,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                Promoted
              </span>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Promoting your listing pins it to the <strong>#1 position</strong> of Home, Explore, and Search feeds across your local area with a radiant <strong>Featured / Promoted</strong> badge.
            </div>

            {/* Duration Selector with Standard INR Pricing */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label" style={{ marginBottom: 8 }}>Select Promotion Duration</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {PROMOTION_PLANS.map(d => (
                  <div
                    key={d.days}
                    onClick={() => setPromoteDays(d.days)}
                    style={{
                      padding: '12px 10px',
                      borderRadius: 14,
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: promoteDays === d.days ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: promoteDays === d.days ? 'rgba(249,115,22,0.12)' : 'var(--surface)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>
                      {d.badge}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--foreground)' }}>
                      {d.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--primary-dark)', fontWeight: 900, marginTop: 4 }}>
                      ₹{d.price}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {d.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowPromoteModal(false)}
                className="btn-secondary"
                style={{ flex: 1, padding: 12 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromoteSubmit}
                className="btn-primary"
                disabled={promoting}
                style={{ flex: 1.5, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 800 }}
              >
                <Rocket size={16} />
                <span>{promoting ? 'Processing...' : `Promote Listing — ₹${PROMOTION_PLANS.find(p => p.days === promoteDays)?.price || 99}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div style={{ maxWidth: 1200, margin: '20px auto 0', padding: '0 20px' }}>
        {/* Hidden Upload Inputs */}
        <input
          id="seller-avatar-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarUpload}
        />
        <input
          id="seller-cover-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleCoverUpload}
        />

        {/* Luxury Store Cover & Profile Banner */}
        <div className="glass-card" style={{ borderRadius: 26, marginBottom: 24, overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
          {/* Cover Photo Area */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: 180,
            background: profile.coverUrl
              ? `url(${profile.coverUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, #0b2240 0%, #1e293b 50%, #2b3a55 100%)',
          }}>
            {/* Ambient Overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)' }} />

            {/* Change Cover Photo Trigger */}
            <button
              onClick={() => document.getElementById('seller-cover-input')?.click()}
              disabled={uploadingCover}
              className="btn-secondary"
              style={{
                position: 'absolute', top: 14, right: 14,
                padding: '7px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: 'rgba(0,0,0,0.65)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)',
                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, zIndex: 2
              }}
            >
              <Camera size={14} />
              <span>{uploadingCover ? 'Uploading Cover...' : 'Change Cover'}</span>
            </button>
          </div>

          {/* Profile Details & Actions Bar */}
          <div style={{ padding: '0 24px 22px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginTop: -44 }}>
              {/* Avatar + Info */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
                {/* Avatar with Camera Icon */}
                <div style={{ position: 'relative', width: 88, height: 88, borderRadius: 24, overflow: 'hidden', border: '4px solid var(--surface)', background: 'var(--surface)', boxShadow: 'var(--shadow-md)', flexShrink: 0 }}>
                  <Image
                    src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=0b2240&color=fff`}
                    alt=""
                    fill
                    unoptimized
                    style={{ objectFit: 'cover' }}
                  />

                  {/* Avatar Upload Overlay */}
                  <button
                    onClick={() => document.getElementById('seller-avatar-input')?.click()}
                    disabled={uploadingAvatar}
                    style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer', opacity: uploadingAvatar ? 1 : 0,
                      transition: 'opacity 0.2s', color: '#ffffff'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => { if (!uploadingAvatar) e.currentTarget.style.opacity = '0'; }}
                  >
                    <Camera size={22} />
                  </button>
                </div>

                <div style={{ paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.7)', margin: 0 }}>
                      {profile.storeName || profile.displayName}
                    </h2>
                    <span className="badge badge-primary" style={{ fontSize: 11, padding: '3px 8px' }}>
                      <ShieldCheck size={13} style={{ display: 'inline', marginRight: 3 }} /> Verified Store
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', fontWeight: 500 }}>
                    {profile.storeDescription || 'Active Local Neighborhood Seller'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 12 }}>
                    <span style={{ color: '#ea580c', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={14} fill="#fca311" /> {profile.rating?.toFixed(1) || '5.0'} ({profile.reviewCount || 0} customer reviews)
                    </span>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                      {stats.completedOrders.length} orders fulfilled
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
                <Link href={`/seller/${user.uid}`} target="_blank" style={{ textDecoration: 'none' }}>
                  <button className="btn-secondary" style={{ padding: '10px 16px', borderRadius: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                    <Eye size={16} /> Public Store <ExternalLink size={13} />
                  </button>
                </Link>
                <button onClick={() => router.push('/scan')} className="btn-secondary" style={{ padding: '10px 16px', borderRadius: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <QrCode size={16} /> Scanner Desk
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--surface)', borderRadius: 18, padding: 6, border: '1px solid var(--border-color)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? 'var(--foreground)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--muted)',
                boxShadow: activeTab === tab.key ? 'var(--shadow-md)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <tab.icon size={17} /> {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════ OVERVIEW TAB: PREMIER ANALYTICS & REVENUE CHARTS ══════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Top 4 KPI Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {/* Gross Revenue */}
              <div className="glass-card" style={{ padding: 22, borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Total Gross Revenue</span>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>
                  ₹{stats.totalRevenue.toLocaleString()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                  <ArrowUpRight size={15} /> All verified transactions
                </div>
              </div>

              {/* Active Listings Count */}
              <div className="glass-card" style={{ padding: 22, borderRadius: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Active Listings</span>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(249,115,22,0.15)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>
                  {products.filter(p => p.status === 'available').length}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  <span>{products.length} total inventory items</span>
                </div>
              </div>

              {/* Escrow Custody */}
              <div className="glass-card" style={{ padding: 22, borderRadius: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Pending Handover Value</span>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>
                  ₹{stats.escrowHeld.toLocaleString()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                  <ShieldCheck size={14} /> Direct P2P verified on QR scan
                </div>
              </div>

              {/* Active Orders Count */}
              <div className="glass-card" style={{ padding: 22, borderRadius: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Total Orders Placed</span>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(11,34,64,0.08)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingBag size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>
                  {orders.length}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  {stats.completedOrders.length} completed • {stats.pendingOrders.length} pending
                </div>
              </div>
            </div>

            {/* Interactive SVG Revenue Curve Graph */}
            <div className="glass-card" style={{ padding: 26, borderRadius: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
                    Revenue Trajectory & Daily Volume
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 0' }}>
                    Real-time transaction inflow across local purchases and rentals
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 6, background: 'var(--surface-hover)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  {(['7d', '30d', 'all'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: timeframe === tf ? 'var(--foreground)' : 'transparent',
                        color: timeframe === tf ? '#fff' : 'var(--muted)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '14 Days'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tooltip Overlay Info */}
              <div style={{ minHeight: 28, marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
                {hoveredPoint ? (
                  <span style={{ background: 'var(--surface-hover)', padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <strong style={{ color: 'var(--foreground)' }}>{hoveredPoint.day}</strong>: ₹{hoveredPoint.amount.toLocaleString()} ({hoveredPoint.orders} orders)
                  </span>
                ) : (
                  <span>Hover over any data point on the chart to inspect daily breakdown</span>
                )}
              </div>

              {/* SVG Area Chart Graphic */}
              <div style={{ width: '100%', height: 260, position: 'relative' }}>
                <svg viewBox="0 0 700 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="700" y2="40" stroke="var(--border-color)" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="100" x2="700" y2="100" stroke="var(--border-color)" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="160" x2="700" y2="160" stroke="var(--border-color)" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="210" x2="700" y2="210" stroke="var(--border-color)" strokeWidth="1" />

                  {/* Data Curve & Area */}
                  {(() => {
                    const pts = chartData.points;
                    const max = chartData.maxVal;
                    const width = 700;
                    const height = 180;
                    const step = width / (pts.length - 1 || 1);

                    const coords = pts.map((p, idx) => {
                      const x = idx * step;
                      const y = 210 - (p.amount / max) * height;
                      return { x, y, ...p };
                    });

                    const pathD = coords.reduce((acc, c, idx) => {
                      if (idx === 0) return `M ${c.x} ${c.y}`;
                      const prev = coords[idx - 1];
                      const cx1 = prev.x + (c.x - prev.x) / 2;
                      const cy1 = prev.y;
                      const cx2 = prev.x + (c.x - prev.x) / 2;
                      const cy2 = c.y;
                      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${c.x} ${c.y}`;
                    }, '');

                    const areaD = `${pathD} L ${width} 210 L 0 210 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#revGradient)" />
                        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />

                        {coords.map((c, idx) => (
                          <g key={idx} onMouseEnter={() => setHoveredPoint({ day: c.day, amount: c.amount, orders: c.orders })} onMouseLeave={() => setHoveredPoint(null)} style={{ cursor: 'pointer' }}>
                            <circle cx={c.x} cy={c.y} r={hoveredPoint?.day === c.day ? 7 : 4.5} fill="#0b2240" stroke="#f97316" strokeWidth="2.5" />
                            <text x={c.x} y="232" textAnchor="middle" fontSize="11" fill="var(--muted)" fontWeight="600">
                              {c.day}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Sales vs Rentals Breakdown & Inventory Health Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Order Channel Breakdown */}
              <div className="glass-card" style={{ padding: 22, borderRadius: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
                  Order Channel Breakdown
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                      <span>Direct Purchases ({stats.purchaseOrders.length})</span>
                      <span>₹{stats.purchaseOrders.reduce((sum, o) => sum + o.amount, 0).toLocaleString()}</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: 'var(--surface-hover)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${(stats.purchaseOrders.length / (orders.length || 1)) * 100}%`, height: '100%', background: 'var(--foreground)', borderRadius: 99 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                      <span>Rentals ({stats.rentalOrders.length})</span>
                      <span>₹{stats.rentalOrders.reduce((sum, o) => sum + o.amount, 0).toLocaleString()}</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: 'var(--surface-hover)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${(stats.rentalOrders.length / (orders.length || 1)) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 99 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                      <span>Late Fees Recovered</span>
                      <span style={{ color: 'var(--danger)' }}>₹{stats.totalLateFees.toLocaleString()}</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: 'var(--surface-hover)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${stats.totalLateFees > 0 ? 100 : 0}%`, height: '100%', background: 'var(--danger)', borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory Status Breakdown */}
              <div className="glass-card" style={{ padding: 22, borderRadius: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={18} style={{ color: 'var(--primary)' }} />
                  Inventory Live Status
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                  <div style={{ padding: '16px 10px', borderRadius: 16, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{stats.availableProducts.length}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#10b981', marginTop: 4 }}>Available</div>
                  </div>
                  <div style={{ padding: '16px 10px', borderRadius: 16, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#f97316' }}>{stats.rentedProducts.length}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#f97316', marginTop: 4 }}>On Rental</div>
                  </div>
                  <div style={{ padding: '16px 10px', borderRadius: 16, background: 'rgba(11,34,64,0.06)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--foreground)' }}>{stats.soldProducts.length}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginTop: 4 }}>Sold Out</div>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button onClick={() => setActiveTab('products')} className="btn-secondary" style={{ width: '100%', padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                    Manage All Listings ➔
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ PRODUCTS TAB: INVENTORY MANAGER ══════════════════ */}
        {activeTab === 'products' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Filter and Search Bar */}
            <div className="glass-card" style={{ padding: 18, borderRadius: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240, background: 'var(--surface-hover)', padding: '8px 14px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <Search size={16} style={{ color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Search listings by title..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--foreground)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'available', 'rented', 'sold'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setProductFilter(f)}
                    style={{
                      padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: productFilter === f ? 'var(--foreground)' : 'var(--surface-hover)',
                      color: productFilter === f ? '#fff' : 'var(--muted)',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards List */}
            {filteredProducts.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: 'center', borderRadius: 24 }}>
                <Package size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>No products found</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Try adjusting your filters or list a new item.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {filteredProducts.map(p => (
                  <div key={p.id} className="glass-card" style={{ padding: 16, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-hover)' }}>
                      <Image
                        src={p.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800'}
                        alt={p.title}
                        fill
                        unoptimized
                        style={{ objectFit: 'cover' }}
                      />
                      <span className={`badge ${p.status === 'available' ? 'badge-primary' : 'badge-danger'}`} style={{ position: 'absolute', top: 10, left: 10, fontSize: 11 }}>
                        {p.status.toUpperCase()}
                      </span>
                      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                        {p.isPromoted && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 900,
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: 999,
                            letterSpacing: '0.4px',
                            textTransform: 'uppercase',
                            boxShadow: '0 2px 8px rgba(249,115,22,0.4)'
                          }}>
                            Promoted
                          </span>
                        )}
                        <span className="badge badge-warning" style={{ fontSize: 11 }}>
                          {p.listingType === 'rent' ? 'Rental' : 'Sale'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </h4>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)' }}>
                        ₹{p.price.toLocaleString()}{p.listingType === 'rent' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>/day</span>}
                      </div>
                    </div>

                    {/* Promote / Boost Ad Action Button */}
                    <button
                      onClick={() => {
                        setSelectedPromoteProduct(p);
                        setShowPromoteModal(true);
                      }}
                      className={p.isPromoted ? 'btn-secondary' : 'btn-primary'}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 12,
                        fontSize: 12.5,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: p.isPromoted ? 'rgba(249,115,22,0.12)' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: p.isPromoted ? 'var(--primary-dark)' : '#ffffff',
                        border: p.isPromoted ? '1px solid var(--primary)' : 'none'
                      }}
                    >
                      <Rocket size={14} />
                      <span>{p.isPromoted ? 'Extend Promotion' : 'Promote Ad to Top'}</span>
                    </button>

                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                      <button onClick={() => router.push(`/product/${p.id}`)} className="btn-secondary" style={{ flex: 1, padding: 8, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                        <Eye size={14} /> View
                      </button>
                      <button onClick={() => router.push(`/sell/${p.id}/edit`)} className="btn-secondary" style={{ flex: 1, padding: 8, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                        <Edit size={14} /> Edit
                      </button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="btn-ghost" style={{ padding: 8, color: 'var(--danger)', borderRadius: 10 }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ORDERS TAB: HANDOVER & DISPATCH MANAGER ══════════════════ */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Orders Filter */}
            <div className="glass-card" style={{ padding: 14, borderRadius: 18, display: 'flex', gap: 8, overflowX: 'auto' }}>
              {(['all', 'pending', 'confirmed', 'completed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setOrderFilter(s)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: orderFilter === s ? 'var(--foreground)' : 'var(--surface-hover)',
                    color: orderFilter === s ? '#fff' : 'var(--muted)',
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {s === 'pending' ? 'Pending Handover' : s === 'confirmed' ? 'Active Rentals' : s}
                </button>
              ))}
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: 'center', borderRadius: 24 }}>
                <ShoppingBag size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>No orders found</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>You will see customer orders and rental requests here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredOrders.map(ord => (
                  <div key={ord.id} className="glass-card" style={{ padding: 20, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-hover)' }}>
                        <Image
                          src={ord.productImage || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800'}
                          alt=""
                          fill
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>{ord.productTitle}</h4>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Buyer ID: {ord.buyerId.slice(0, 8)}... • Type: <strong style={{ color: 'var(--foreground)' }}>{ord.type}</strong>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', marginTop: 4 }}>
                          ₹{ord.amount.toLocaleString()}
                          {ord.escrowLocked && <span style={{ fontSize: 11, color: '#6366f1', marginLeft: 6 }}>🔒 Pending Handover</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${ord.status === 'completed' ? 'badge-primary' : ord.status === 'pending' ? 'badge-warning' : 'badge-danger'}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                        {ord.status.toUpperCase()}
                      </span>

                      {ord.status === 'pending' && (
                        <button onClick={() => generateQR(ord.id, 'pickup')} className="btn-primary" style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800 }}>
                          <QrCode size={16} /> Show Pickup QR
                        </button>
                      )}

                      {ord.status === 'confirmed' && ord.type === 'rental' && (
                        <button onClick={() => generateQR(ord.id, 'return')} className="btn-secondary" style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800 }}>
                          <QrCode size={16} /> Show Return QR
                        </button>
                      )}
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
