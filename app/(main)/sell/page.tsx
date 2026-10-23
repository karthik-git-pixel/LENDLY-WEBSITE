'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getProductsBySeller,
  deleteProduct,
  type Product,
  getOrdersBySeller,
  type Order,
  getPrintOrdersByProvider,
  updatePrintOrder,
  updateUserProfile,
  type PrintOrder
} from '@/lib/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Package,
  Edit,
  Trash2,
  Eye,
  Store,
  TrendingUp,
  IndianRupee,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  ExternalLink,
  Phone,
  MessageCircle,
  Truck,
  Sliders,
  Sparkles,
  X,
  Check,
  Save,
  Info,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SellPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [printOrders, setPrintOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'transactions' | 'print_orders'>('products');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Print Pricing Management States
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isPrintProvider, setIsPrintProvider] = useState(false);
  const [printPriceBW, setPrintPriceBW] = useState('2');
  const [printPriceColor, setPrintPriceColor] = useState('10');
  const [printStoreName, setPrintStoreName] = useState('');
  const [printDescription, setPrintDescription] = useState('');
  const [savingPricing, setSavingPricing] = useState(false);

  // Synchronize profile print settings
  useEffect(() => {
    if (profile) {
      setIsPrintProvider(profile.isPrintProvider || false);
      setPrintPriceBW(profile.printPriceBW?.toString() || '2');
      setPrintPriceColor(profile.printPriceColor?.toString() || '10');
      setPrintStoreName(profile.printStoreName || profile.storeName || profile.displayName || '');
      setPrintDescription(profile.printDescription || '');
    }
  }, [profile]);

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/sell');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!profile?.uid) return;
    const uid = profile.uid;

    let cancelled = false;

    async function loadDashboard() {
      try {
        const [prods, ords, printOrds] = await Promise.all([
          getProductsBySeller(uid),
          getOrdersBySeller(uid),
          getPrintOrdersByProvider(uid)
        ]);
        if (!cancelled) {
          setProducts(prods);
          setOrders(ords);
          setPrintOrders(printOrds);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const totalProductProfit = orders
    .filter(o => o.status === 'completed' || o.status === 'confirmed')
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  const totalPrintProfit = printOrders
    .filter(p => p.status === 'completed' || p.status === 'out_for_delivery' || p.status === 'printing' || p.status === 'accepted')
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  const totalProfit = totalProductProfit + totalPrintProfit;

  const handleSavePrintPricing = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.uid) return;
    setSavingPricing(true);
    try {
      const bw = parseFloat(printPriceBW);
      const col = parseFloat(printPriceColor);
      if (isNaN(bw) || bw < 0.5) {
        toast.error('Black & White price must be at least ₹0.50 per page');
        setSavingPricing(false);
        return;
      }
      if (isNaN(col) || col < 1) {
        toast.error('Color price must be at least ₹1.00 per page');
        setSavingPricing(false);
        return;
      }

      await updateUserProfile(user.uid, {
        isPrintProvider,
        printPriceBW: bw,
        printPriceColor: col,
        printStoreName: printStoreName.trim() || profile?.storeName || profile?.displayName || 'Local Print Hub',
        printDescription: printDescription.trim()
      });

      await refreshProfile();
      toast.success('Print service rates & pricing updated! 🎉');
      setShowPricingModal(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update pricing'));
    } finally {
      setSavingPricing(false);
    }
  };

  const handleUpdatePrintStatus = async (orderId: string, nextStatus: PrintOrder['status']) => {
    setUpdatingOrderId(orderId);
    try {
      await updatePrintOrder(orderId, { status: nextStatus });
      setPrintOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
      toast.success(`Print order marked as ${nextStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update print status'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Product deleted');
    } catch (e) { toast.error(getErrorMessage(e, 'Failed to delete product')); }
  };

  if (!profile?.isSeller) {
    return (
      <div>
        <div className="top-header"><h1 style={{ fontSize: 20, fontWeight: 800 }}>Sell</h1></div>
        <div className="page-container">
          <div className="empty-state">
            <Store size={56} />
            <h3>Start Selling on Lendly</h3>
            <p style={{ marginBottom: 20 }}>Set up your seller account to list products</p>
            <Link href="/profile/become-seller" className="btn-primary" style={{ textDecoration: 'none' }}>
              <Store size={16} /> Become a Seller
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activePrintCount = printOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;

  return (
    <div>
      <div className="top-header">
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Seller Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowPricingModal(true)}
            className="btn-secondary"
            style={{
              padding: '8px 12px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 12
            }}
            title="Manage Print Pricing & Rates"
          >
            <Printer size={15} style={{ color: 'var(--primary)' }} />
            <span>Print Pricing</span>
          </button>
          <Link href="/sell/new" className="btn-primary" style={{ padding: '8px 14px', textDecoration: 'none', fontSize: 13 }}>
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      <div className="page-container">
        {/* Seller Earnings & Storefront Feature Card */}
        <div className="glass-card" style={{
          padding: 20, borderRadius: 20, marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(11, 34, 64, 0.04) 100%)',
          border: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1 1 240px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(249, 115, 22, 0.15)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
              Local Seller & Print Hub
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 6px' }}>
              Turn Products & Services into Earnings
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
              List products for sale/rental, or fulfill on-demand print jobs for local neighbors with instant payouts!
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/sell/new" className="btn-primary" style={{ padding: '8px 14px', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Add Listing
              </Link>
              <button
                onClick={() => setShowPricingModal(true)}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 12 }}
              >
                <Sliders size={14} /> Manage Print Rates
              </button>
            </div>
          </div>
          <div style={{ flex: '0 0 auto', margin: '0 auto' }}>
            <Image
              src="/images/seller-earnings-illustration.png"
              alt="Seller Earnings & Shop Illustration"
              width={160}
              height={110}
              unoptimized
              style={{ objectFit: 'contain', borderRadius: 12, background: '#ffffff', padding: 6, boxShadow: 'var(--shadow-sm)' }}
            />
          </div>
        </div>

        {/* Business Stats Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          <div className="glass-card" style={{ padding: '14px', background: 'var(--gradient-primary)', color: 'white', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.9, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              <TrendingUp size={13} /> Total Earnings
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>₹{totalProfit.toLocaleString('en-IN')}</div>
          </div>
          
          <div className="glass-card" style={{ padding: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              <Package size={13} /> Product Orders
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--foreground)' }}>{orders.length}</div>
          </div>

          <div className="glass-card" style={{ padding: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              <Printer size={13} /> Print Jobs
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', color: '#ea580c' }}>{printOrders.length}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-bar" style={{ marginBottom: 20, padding: 6 }}>
          <button
            className={`tab-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', fontSize: 13 }}
          >
            <Package size={16} /> Products ({products.length})
          </button>
          <button
            className={`tab-item ${activeTab === 'print_orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('print_orders')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', fontSize: 13, position: 'relative' }}
          >
            <Printer size={16} /> Print Jobs ({printOrders.length})
            {activePrintCount > 0 && (
              <span style={{ background: '#ea580c', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999 }}>
                {activePrintCount}
              </span>
            )}
          </button>
          <button
            className={`tab-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', fontSize: 13 }}
          >
            <IndianRupee size={16} /> Transactions
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
        ) : activeTab === 'products' ? (
          /* Products Tab */
          products.length === 0 ? (
            <div className="empty-state">
              <Package size={48} />
              <h3>No products yet</h3>
              <p>Add your first product to start selling</p>
            </div>
          ) : (
            products.map(p => (
              <div key={p.id} className="glass-card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <Image src={p.images?.[0] || 'https://via.placeholder.com/60'} alt="" width={56} height={56} style={{ borderRadius: 10, objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                  <div style={{ color: 'var(--primary-light)', fontWeight: 700, fontSize: 15 }}>₹{p.price}</div>
                  <span className={`badge ${p.status === 'available' ? 'badge-success' : p.status === 'sold' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" style={{ padding: 8 }} onClick={() => router.push(`/product/${p.id}`)}><Eye size={16} /></button>
                  <button className="btn-ghost" style={{ padding: 8 }} onClick={() => router.push(`/sell/${p.id}/edit`)}><Edit size={16} /></button>
                  <button className="btn-ghost" style={{ padding: 8, color: 'var(--danger)' }} onClick={() => handleDelete(p.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'print_orders' ? (
          /* Print Orders & Pricing Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Print Hub Rates & Status Management Card */}
            <div
              className="glass-card"
              style={{
                padding: 18,
                borderRadius: 20,
                border: '1.5px solid rgba(249, 115, 22, 0.3)',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(254, 243, 199, 0.35) 100%)',
                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)'
                  }}>
                    <Printer size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                        {profile?.printStoreName || profile?.storeName || 'My Print & Xerox Hub'}
                      </h3>
                      <span className={`badge ${profile?.isPrintProvider ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: 10, fontWeight: 800 }}>
                        {profile?.isPrintProvider ? '● Accepting Orders' : 'Paused / Inactive'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                      {profile?.isPrintProvider ? 'Live in neighborhood Print Directory' : 'Activate to receive print requests from local buyers'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPricingModal(true)}
                  className="btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    borderRadius: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 800
                  }}
                >
                  <Sliders size={15} />
                  <span>Manage Pricing & Rates</span>
                </button>
              </div>

              {/* Current Live Rate Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>B&W Rate</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)' }}>₹{profile?.printPriceBW ?? 2} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>/ pg</span></div>
                  </div>
                  <FileText size={22} style={{ color: '#64748b', opacity: 0.8 }} />
                </div>

                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Color Rate</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#ea580c' }}>₹{profile?.printPriceColor ?? 10} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>/ pg</span></div>
                  </div>
                  <Tag size={22} style={{ color: '#ea580c', opacity: 0.8 }} />
                </div>

                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Paper Formats</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>A4, A3, A5, Legal</div>
                  </div>
                  <CheckCircle2 size={20} style={{ color: 'var(--success)', opacity: 0.8 }} />
                </div>
              </div>
            </div>

            {/* Print Orders List */}
            {printOrders.length === 0 ? (
              <div className="empty-state">
                <Printer size={48} />
                <h3>No Print Jobs Yet</h3>
                <p>When nearby customers request documents to be printed at your rates, they will appear here in real-time.</p>
                <button
                  onClick={() => setShowPricingModal(true)}
                  className="btn-primary"
                  style={{ marginTop: 12, padding: '10px 20px', borderRadius: 12, fontSize: 13 }}
                >
                  <Sliders size={15} style={{ marginRight: 6 }} /> Manage Print Pricing & Rates
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {printOrders.map(pOrder => (
                  <div
                    key={pOrder.id}
                    className="glass-card"
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      border: '1px solid var(--border-color)',
                      background: 'var(--surface)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    {/* Top Bar: Customer & Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--foreground)' }}>
                          {pOrder.buyerName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {pOrder.createdAt ? new Date(pOrder.createdAt.toMillis?.() || Date.now()).toLocaleString() : 'Just now'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--success)' }}>
                          +₹{pOrder.totalAmount}
                        </div>
                        <span className={`badge ${
                          pOrder.status === 'completed' ? 'badge-success' :
                          pOrder.status === 'printing' ? 'badge-primary' :
                          pOrder.status === 'out_for_delivery' ? 'badge-warning' : 'badge-secondary'
                        }`} style={{ fontSize: 10, textTransform: 'uppercase', marginTop: 2 }}>
                          {pOrder.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Specs Pill */}
                    <div style={{
                      background: '#f8fafc', padding: '10px 12px', borderRadius: 12,
                      fontSize: 12, fontWeight: 700, color: 'var(--foreground)',
                      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'
                    }}>
                      <span>{pOrder.paperSize}</span>
                      <span>•</span>
                      <span>{pOrder.pageCount} Pages × {pOrder.copies} {pOrder.copies > 1 ? 'Copies' : 'Copy'}</span>
                      <span>•</span>
                      <span style={{ color: pOrder.colorMode === 'color' ? '#ea580c' : '#475569', fontWeight: 800 }}>
                        {pOrder.colorMode === 'color' ? 'Color' : 'B&W'}
                      </span>
                      <span>•</span>
                      <span style={{ color: 'var(--muted)' }}>{pOrder.sides === 'double' ? 'Double-Sided' : 'Single-Sided'}</span>
                    </div>

                    {/* Download Buyer Files */}
                    {pOrder.fileUrls && pOrder.fileUrls.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                          Customer Files to Print ({pOrder.fileUrls.length}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {pOrder.fileUrls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 8, background: '#f1f5f9',
                                border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700,
                                color: 'var(--primary-dark)', textDecoration: 'none'
                              }}
                            >
                              <FileText size={12} />
                              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pOrder.fileNames?.[i] || `File ${i + 1}`}
                              </span>
                              <ExternalLink size={10} style={{ color: 'var(--muted)' }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery Location & Notes */}
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Truck size={13} style={{ color: 'var(--primary)' }} />
                        <strong style={{ color: 'var(--foreground)' }}>Deliver to:</strong> {pOrder.deliveryAddress}
                      </div>
                      {pOrder.specialInstructions && (
                        <div style={{ marginTop: 3, fontStyle: 'italic' }}>
                          Note: &ldquo;{pOrder.specialInstructions}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 10, flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {pOrder.buyerPhone && (
                          <a href={`tel:${pOrder.buyerPhone}`} style={{ textDecoration: 'none' }}>
                            <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={12} />
                              <span>Call</span>
                            </button>
                          </a>
                        )}
                        <button
                          onClick={() => router.push('/chat')}
                          className="btn-ghost"
                          style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <MessageCircle size={12} />
                          <span>Chat</span>
                        </button>
                      </div>

                      {/* Status Changer Workflow */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {pOrder.status === 'pending' && (
                          <button
                            onClick={() => handleUpdatePrintStatus(pOrder.id, 'accepted')}
                            disabled={updatingOrderId === pOrder.id}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, fontWeight: 800 }}
                          >
                            Accept Order
                          </button>
                        )}
                        {pOrder.status === 'accepted' && (
                          <button
                            onClick={() => handleUpdatePrintStatus(pOrder.id, 'printing')}
                            disabled={updatingOrderId === pOrder.id}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, fontWeight: 800, background: '#3b82f6' }}
                          >
                            Start Printing
                          </button>
                        )}
                        {pOrder.status === 'printing' && (
                          <button
                            onClick={() => handleUpdatePrintStatus(pOrder.id, 'out_for_delivery')}
                            disabled={updatingOrderId === pOrder.id}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, fontWeight: 800, background: '#8b5cf6' }}
                          >
                            Dispatch / Out for Delivery
                          </button>
                        )}
                        {pOrder.status === 'out_for_delivery' && (
                          <button
                            onClick={() => handleUpdatePrintStatus(pOrder.id, 'completed')}
                            disabled={updatingOrderId === pOrder.id}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, fontWeight: 800, background: 'var(--success)' }}
                          >
                            Mark Delivered ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Transactions Tab */
          orders.length === 0 ? (
            <div className="empty-state">
              <ArrowRightLeft size={48} />
              <h3>No transactions yet</h3>
              <p>When buyers purchase your items, they will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).map(ord => (
                <div key={ord.id} className="glass-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={ord.productImage || 'https://via.placeholder.com/40'} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{ord.productTitle}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{new Date(ord.createdAt?.toMillis() || Date.now()).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: (ord.status === 'completed' || ord.status === 'confirmed') ? 'var(--success)' : 'var(--foreground)' }}>
                        +₹{ord.amount}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${ord.type === 'rental' ? 'badge-warning' : 'badge-primary'}`}>
                      {ord.type}
                    </span>
                    <span className={`badge ${['completed', 'confirmed'].includes(ord.status) ? 'badge-success' : 'badge-warning'}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {['completed', 'confirmed'].includes(ord.status) ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ================= PRINT PRICING & SERVICE RATES MODAL ================= */}
      {showPricingModal && (
        <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520, borderRadius: 24, padding: 26, maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)'
                }}>
                  <Printer size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                    Manage Print Pricing
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                    Set custom page rates for local customers
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPricingModal(false)}
                className="btn-ghost"
                style={{ padding: 6, borderRadius: 10 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePrintPricing}>
              {/* Service Activation Toggle */}
              <div style={{
                background: isPrintProvider ? 'rgba(249, 115, 22, 0.08)' : 'var(--surface-hover)',
                border: isPrintProvider ? '1.5px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--border-color)',
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease'
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--foreground)' }}>
                    Offer Print & Xerox Services
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Appear in the neighborhood Print Hub directory
                  </div>
                </div>

                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 46, height: 26 }}>
                  <input
                    type="checkbox"
                    checked={isPrintProvider}
                    onChange={e => setIsPrintProvider(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      inset: 0,
                      backgroundColor: isPrintProvider ? '#f97316' : '#cbd5e1',
                      borderRadius: 999,
                      transition: '0.3s'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: 20,
                        width: 20,
                        left: isPrintProvider ? 23 : 3,
                        bottom: 3,
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    />
                  </span>
                </label>
              </div>

              {/* Shop / Print Hub Name */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={14} style={{ color: 'var(--primary)' }} />
                  <span>Print Hub / Storefront Name</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Anandhu's Express Xerox & Prints"
                  value={printStoreName}
                  onChange={e => setPrintStoreName(e.target.value)}
                  style={{ borderRadius: 12, height: 42, fontSize: 13 }}
                />
              </div>

              {/* Pricing Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                {/* Black & White Rate */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <FileText size={14} style={{ color: '#475569' }} />
                    <span>B&W Rate (₹/pg)</span>
                  </label>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--muted)' }}>₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="input-field"
                      value={printPriceBW}
                      onChange={e => setPrintPriceBW(e.target.value)}
                      style={{ paddingLeft: 28, height: 40, borderRadius: 10, fontWeight: 800, fontSize: 15 }}
                    />
                  </div>
                  {/* Preset chips */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['1.5', '2', '3', '5'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPrintPriceBW(val)}
                        style={{
                          background: printPriceBW === val ? '#0b2240' : '#ffffff',
                          color: printPriceBW === val ? '#ffffff' : 'var(--foreground)',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          padding: '2px 7px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Rate */}
                <div style={{ background: '#fff7ed', padding: 14, borderRadius: 16, border: '1px solid #ffedd5' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Tag size={14} style={{ color: '#ea580c' }} />
                    <span>Color Rate (₹/pg)</span>
                  </label>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#ea580c' }}>₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="input-field"
                      value={printPriceColor}
                      onChange={e => setPrintPriceColor(e.target.value)}
                      style={{ paddingLeft: 28, height: 40, borderRadius: 10, fontWeight: 800, fontSize: 15, borderColor: '#fdba74' }}
                    />
                  </div>
                  {/* Preset chips */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['5', '8', '10', '15', '20'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPrintPriceColor(val)}
                        style={{
                          background: printPriceColor === val ? '#ea580c' : '#ffffff',
                          color: printPriceColor === val ? '#ffffff' : '#9a3412',
                          border: '1px solid #fed7aa',
                          borderRadius: 6,
                          padding: '2px 7px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Specialty Notes & Formats */}
              <div style={{ marginBottom: 20 }}>
                <label className="input-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Specialties & Available Paper (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. A4/A3 formats, 100 GSM bond paper, spiral binding available"
                  value={printDescription}
                  onChange={e => setPrintDescription(e.target.value)}
                  style={{ borderRadius: 12, height: 42, fontSize: 13 }}
                />
              </div>

              {/* Live Rate Preview Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 14,
                padding: 12,
                marginBottom: 20,
                fontSize: 12
              }}>
                <div style={{ fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10, marginBottom: 4 }}>
                  Customer Directory Preview:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, color: 'var(--foreground)' }}>
                    {printStoreName || 'Your Print Store'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      B&W: ₹{printPriceBW}/pg
                    </span>
                    <span style={{ background: '#ffedd5', color: '#ea580c', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                      Color: ₹{printPriceColor}/pg
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowPricingModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: 12, borderRadius: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPricing}
                  className="btn-primary"
                  style={{
                    flex: 1.5,
                    padding: 12,
                    borderRadius: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {savingPricing ? (
                    <div className="spinner spinner-sm" style={{ borderColor: '#ffffff', borderTopColor: 'transparent' }} />
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Pricing</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
