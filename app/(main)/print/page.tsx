'use client';

import { useState, useEffect } from 'react';
import Image from '@/components/AppImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAllPrintProviders, getAllSellers, type UserProfile } from '@/lib/firestore';
import { getCurrentLocation, filterByDistance, formatDistance, type Coordinates } from '@/lib/location';
import {
  Printer,
  FileText,
  Truck,
  Sparkles,
  MapPin,
  Star,
  ChevronRight,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Clock,
  Layers,
  CheckCircle2,
  Store,
  MessageCircle,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PrintServicesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState<(UserProfile & { distance: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<Coordinates | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        let loc: Coordinates;
        if (profile?.location?.lat && profile?.location?.lng && (profile.location.lat !== 0 || profile.location.lng !== 0)) {
          loc = { lat: profile.location.lat, lng: profile.location.lng };
        } else {
          try {
            loc = await getCurrentLocation();
          } catch {
            loc = { lat: 10.8505, lng: 76.2711 };
          }
        }

        if (cancelled) return;
        setUserLoc(loc);

        // Fetch dedicated print providers, or fallback to sellers
        const [printProviders, allSellers] = await Promise.all([
          getAllPrintProviders(),
          getAllSellers(),
        ]);

        if (cancelled) return;

        // If there are explicit print providers, use them; otherwise, show all sellers who can print
        let providerList = printProviders;
        if (providerList.length === 0) {
          // Provide default printing options for sellers to kickstart marketplace
          providerList = allSellers.map(s => ({
            ...s,
            isPrintProvider: true,
            printPriceBW: s.printPriceBW || 2,
            printPriceColor: s.printPriceColor || 10,
            printStoreName: s.storeName || `${s.displayName}'s Print Hub`,
            printAvailableSizes: s.printAvailableSizes || ['A4', 'A3', 'Legal'],
          }));
        }

        const filtered = filterByDistance(
          providerList.filter(p => p.uid !== profile?.uid).map(p => ({
            ...p,
            location: p.storeLocation || p.location,
          })),
          loc,
          30 // 30km radius
        );

        setProviders(filtered);
      } catch (err) {
        console.error('Failed to load print providers:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <div className="fade-in" style={{ paddingBottom: 90, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Top Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#ffffff', borderBottom: '1px solid var(--border-color)',
        padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Hyperlocal Print Service</span>
              <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 7px' }}>Fast Delivery</span>
            </h1>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>Doorstep prints from nearby Xerox & Print hubs</p>
          </div>
        </div>

        <Link href="/print/orders" style={{ textDecoration: 'none' }}>
          <button className="btn-secondary" style={{ padding: '7px 14px', fontSize: 12, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <FileText size={15} style={{ color: 'var(--primary-dark)' }} />
            <span>My Orders</span>
          </button>
        </Link>
      </div>

      <div className="page-container" style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 40px' }}>
        
        {/* ================= HERO POSTER BANNER ================= */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #faf0e6 50%, #f6e4d2 100%)',
            borderRadius: 24,
            padding: '24px 20px 22px 20px',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(246, 228, 210, 0.45)',
            border: '1px solid rgba(254, 215, 170, 0.45)'
          }}
        >
          {/* Ambient Glow */}
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 200, height: 200,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(22, 163, 74, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ flex: 1, zIndex: 2 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999,
                background: '#ffffff', border: '1px solid rgba(22, 163, 74, 0.3)',
                fontSize: 11, fontWeight: 800, color: '#166534', marginBottom: 10
              }}>
                <Printer size={13} style={{ color: '#15803d' }} />
                <span>ON-DEMAND LOCAL PRINTING</span>
              </div>

              <h2 style={{
                fontSize: 'clamp(22px, 5vw, 28px)',
                fontWeight: 900,
                color: '#0b2240',
                lineHeight: 1.15,
                letterSpacing: '-0.6px',
                margin: '0 0 6px'
              }}>
                Upload. Customize.<br />Delivered in 15–45 Mins.
              </h2>

              <p style={{ fontSize: 13, color: '#7c2d12', margin: '0 0 16px', lineHeight: 1.5, opacity: 0.9 }}>
                Send PDFs or photos directly to verified neighborhood print shops. B&W or Color, A4 to A3, spiral binding & doorstep drop.
              </p>

              {/* 3 Step Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(220, 190, 165, 0.5)', borderRadius: 12,
                  padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <div style={{ color: '#15803d' }}><FileText size={18} /></div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b2240' }}>1. Upload File</div>
                    <div style={{ fontSize: 10, color: '#7c2d12' }}>PDF or High-Res Image</div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(220, 190, 165, 0.5)', borderRadius: 12,
                  padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <div style={{ color: '#15803d' }}><Layers size={18} /></div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b2240' }}>2. Choose Specs</div>
                    <div style={{ fontSize: 10, color: '#7c2d12' }}>B&W / Color / Size</div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(220, 190, 165, 0.5)', borderRadius: 12,
                  padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <div style={{ color: '#15803d' }}><Truck size={18} /></div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b2240' }}>3. Doorstep Handover</div>
                    <div style={{ fontSize: 10, color: '#7c2d12' }}>Fast QR Verification</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
              Nearby Print Hubs & Xerox Centers
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
              Select a provider to upload your files and configure your print order
            </p>
          </div>
        </div>

        {/* Providers List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : providers.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center', borderRadius: 20 }}>
            <Printer size={48} style={{ color: 'var(--primary)', marginBottom: 12, opacity: 0.8 }} />
            <h4 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px' }}>No Print Hubs in Your Direct Vicinity</h4>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', maxWidth: 400, marginInline: 'auto' }}>
              Would you like to offer printing services to your local community? Enable Print Provider mode in your profile!
            </p>
            <Link href="/profile" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '9px 18px', fontSize: 13, borderRadius: 12 }}>
                Become a Print Provider
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {providers.map(provider => {
              const bwRate = provider.printPriceBW ?? 2;
              const colorRate = provider.printPriceColor ?? 10;
              const storeTitle = provider.printStoreName || provider.storeName || `${provider.displayName}'s Print Hub`;
              const address = provider.storeLocation?.address || provider.location?.address || 'Neighborhood Print Shop';

              return (
                <div
                  key={provider.uid}
                  className="glass-card"
                  style={{
                    padding: 18,
                    borderRadius: 20,
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    {/* Left: Avatar & Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        position: 'relative', width: 52, height: 52, borderRadius: '50%',
                        overflow: 'hidden', flexShrink: 0, border: '2px solid var(--primary)'
                      }}>
                        <Image
                          src={provider.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(storeTitle)}&background=0b2240&color=fff`}
                          alt={storeTitle}
                          fill
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {storeTitle}
                          </h4>
                          <ShieldCheck size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <MapPin size={12} style={{ color: 'var(--primary)' }} />
                          <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ color: 'var(--primary-dark)', fontWeight: 800 }}>{formatDistance(provider.distance)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 11 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#166534', fontWeight: 800 }}>
                            <Star size={12} style={{ fill: '#16a34a', color: '#16a34a' }} />
                            <span>{provider.rating ? provider.rating.toFixed(1) : '5.0'}</span>
                          </span>
                          <span style={{ color: 'var(--muted)' }}>({provider.reviewCount || 1} verified orders)</span>
                        </div>
                      </div>
                    </div>

                    {/* Rate Pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <div style={{
                        background: '#f1f5f9', padding: '3px 8px', borderRadius: 8,
                        fontSize: 11, fontWeight: 700, color: '#334155', border: '1px solid #e2e8f0'
                      }}>
                        B&W: <strong style={{ color: '#0f172a' }}>₹{bwRate}</strong>/page
                      </div>
                      <div style={{
                        background: 'rgba(22, 163, 74, 0.12)', padding: '3px 8px', borderRadius: 8,
                        fontSize: 11, fontWeight: 700, color: '#166534', border: '1px solid rgba(22, 163, 74, 0.3)'
                      }}>
                        Color: <strong style={{ color: '#15803d' }}>₹{colorRate}</strong>/page
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, borderTop: '1px solid var(--border-color)', paddingTop: 12
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} />
                      <span>Ready in ~20 mins</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => router.push(`/chat`)}
                        className="btn-ghost"
                        style={{
                          padding: '7px 12px', fontSize: 12, borderRadius: 10,
                          border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 5
                        }}
                      >
                        <MessageCircle size={14} />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={() => router.push(`/print/order/${provider.uid}`)}
                        className="btn-primary"
                        style={{
                          padding: '8px 18px', fontSize: 12.5, borderRadius: 10,
                          fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6
                        }}
                      >
                        <Printer size={15} />
                        <span>Order Prints</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
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
