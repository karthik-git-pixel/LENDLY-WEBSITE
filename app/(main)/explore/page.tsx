'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getAllAvailableProducts, getAllSellers, type Product, type UserProfile } from '@/lib/firestore';
import { getCurrentLocation, filterByDistance, formatDistance, type Coordinates } from '@/lib/location';
import { useRouter } from 'next/navigation';
import { List, Map as MapIcon, ExternalLink, MapPin, Store, Package } from 'lucide-react';
import dynamic from 'next/dynamic';
import DesktopSidebar from '@/components/DesktopSidebar';
import MobileHeader from '@/components/MobileHeader';
import CategoryGridFilter from '@/components/CategoryGridFilter';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function ExplorePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [category, setCategory] = useState('All');
  const [sellers, setSellers] = useState<(UserProfile & { distance: number })[]>([]);
  const [products, setProducts] = useState<(Product & { distance: number })[]>([]);
  const [userLoc, setUserLoc] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(30);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

        const [allProducts, allSellers] = await Promise.all([
          getAllAvailableProducts(),
          getAllSellers(),
        ]);

        if (cancelled) return;
        setSellers(filterByDistance(
          allSellers.filter(s => s.uid !== profile?.uid).map(s => ({ ...s, location: s.storeLocation || s.location })),
          loc, radius
        ));
        setProducts(filterByDistance(allProducts, loc, radius));
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
  }, [profile, radius]);

  const filteredProducts = products.filter(p => {
    if (category === 'All') return true;
    return p.category?.toLowerCase() === category.toLowerCase() ||
      (category === 'Cars' && (p.category?.toLowerCase().includes('car') || p.category?.toLowerCase().includes('vehicle') || p.category?.toLowerCase().includes('auto'))) ||
      (category === 'Properties' && (p.category?.toLowerCase().includes('propert') || p.category?.toLowerCase().includes('real') || p.category?.toLowerCase().includes('house') || p.category?.toLowerCase().includes('room') || p.category?.toLowerCase().includes('flat'))) ||
      (category === 'Mobiles' && (p.category?.toLowerCase().includes('mobile') || p.category?.toLowerCase().includes('phone') || p.category?.toLowerCase().includes('tablet') || p.category?.toLowerCase().includes('ipad'))) ||
      (category === 'Jobs' && (p.category?.toLowerCase().includes('job') || p.category?.toLowerCase().includes('gig') || p.category?.toLowerCase().includes('work'))) ||
      (category === 'Fashion' && (p.category?.toLowerCase().includes('cloth') || p.category?.toLowerCase().includes('fashion') || p.category?.toLowerCase().includes('wear') || p.category?.toLowerCase().includes('shoe') || p.category?.toLowerCase().includes('dress'))) ||
      (category === 'Bikes' && (p.category?.toLowerCase().includes('bike') || p.category?.toLowerCase().includes('scooter') || p.category?.toLowerCase().includes('motorcycle') || p.category?.toLowerCase().includes('cycle'))) ||
      (category === 'Electronics' && (p.category?.toLowerCase().includes('electr') || p.category?.toLowerCase().includes('appliance') || p.category?.toLowerCase().includes('gadget') || p.category?.toLowerCase().includes('laptop') || p.category?.toLowerCase().includes('camera'))) ||
      (category === 'Commercial' && (p.category?.toLowerCase().includes('commercial') || p.category?.toLowerCase().includes('spare') || p.category?.toLowerCase().includes('truck') || p.category?.toLowerCase().includes('parts'))) ||
      (category === 'Furniture' && (p.category?.toLowerCase().includes('furnit') || p.category?.toLowerCase().includes('decor') || p.category?.toLowerCase().includes('chair') || p.category?.toLowerCase().includes('table') || p.category?.toLowerCase().includes('bed'))) ||
      (category === 'Pets' && (p.category?.toLowerCase().includes('pet') || p.category?.toLowerCase().includes('dog') || p.category?.toLowerCase().includes('cat') || p.category?.toLowerCase().includes('animal'))) ||
      (category === 'Books' && (p.category?.toLowerCase().includes('book') || p.category?.toLowerCase().includes('sport') || p.category?.toLowerCase().includes('station'))) ||
      (category === 'Services' && p.category?.toLowerCase().includes('service'));
  });

  return (
    <div className="fade-in">
      {/* Mobile Top Header */}
      <MobileHeader radius={radius} onRadiusChange={setRadius} />

      {/* Main Body */}
      <div className="desktop-body-grid">
        {/* Desktop Left Sidebar */}
        <DesktopSidebar radius={radius} onRadiusChange={setRadius} />

        {/* Content Area */}
        <div className="desktop-content-container page-container">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12,
            flexWrap: 'wrap',
            background: 'var(--surface)', padding: '16px 20px', borderRadius: 20, border: '1px solid var(--border-color)',
            boxShadow: 'var(--elev-2)'
          }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px', margin: 0 }}>
                Explore Nearby
              </h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                Interactive map & list view within {radius} km
              </p>
            </div>
            <div className="tab-bar" style={{ width: 'auto', background: 'var(--surface-hover)' }}>
              <button className={`tab-item ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
                <MapIcon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Map
              </button>
              <button className={`tab-item ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
                <List size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> List
              </button>
            </div>
          </div>

          {/* 3D Squircle Category Grid Filter */}
          <CategoryGridFilter selectedCategory={category} onSelectCategory={setCategory} />

          {/* Mobile Radius Filter Bar */}
          <div className="glass-card mobile-only" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Search Radius</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[2, 5, 10, 25].map(r => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`chip ${radius === r ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : view === 'map' && userLoc ? (
            <div>
              <MapView
                center={userLoc}
                sellers={sellers}
                products={filteredProducts}
                radiusKm={radius}
                onSellerClick={(id) => router.push(`/seller/${id}`)}
                onProductClick={(id) => router.push(`/product/${id}`)}
                onLocateMe={async () => {
                  const loc = await getCurrentLocation();
                  setUserLoc(loc);
                }}
                userAvatar={profile?.avatarUrl}
              />
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                💡 Click on map pins to view product or seller details
              </div>
            </div>
          ) : (
            <div>
              {sellers.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h2 className="rc-section-title" style={{ marginBottom: 12 }}>
                    <Store size={18} style={{ color: 'var(--primary)' }} /> Sellers ({sellers.length})
                  </h2>
                  <div className="rc-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {sellers.map(s => (
                      <div
                        key={s.uid}
                        className="glass-card rc-interactive"
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}
                        onClick={() => router.push(`/seller/${s.uid}`)}
                      >
                        <Image
                          src={s.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.displayName)}&background=6366f1&color=fff`}
                          alt=""
                          className="avatar"
                          width={44}
                          height={44}
                          style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.storeName || s.displayName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {formatDistance(s.distance)}
                          </div>
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${s.location.lat},${s.location.lng}`}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          <ExternalLink size={13} /> Nav
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredProducts.length > 0 && (
                <div>
                  <h2 className="rc-section-title" style={{ marginBottom: 12 }}>
                    <Package size={18} style={{ color: 'var(--primary)' }} /> Products ({filteredProducts.length})
                  </h2>
                  <div className="rc-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        className="glass-card rc-interactive"
                        style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}
                        onClick={() => router.push(`/product/${p.id}`)}
                      >
                        <Image
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=60'}
                          alt=""
                          width={64}
                          height={64}
                          style={{ borderRadius: 14, objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.title}
                            </div>
                            {p.isPromoted && (
                              <span style={{
                                fontSize: 9.5,
                                padding: '2px 7px',
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                color: '#ffffff',
                                borderRadius: 999,
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                display: 'inline-flex'
                              }}>
                                Promoted
                              </span>
                            )}
                          </div>
                          {p.sellerName && (
                            <div style={{ fontSize: 11.5, color: '#64748b', opacity: 0.8, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.sellerName}
                            </div>
                          )}
                          <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 15, marginTop: 2 }}>
                            ₹{p.price.toLocaleString()} {p.listingType === 'rent' && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>/day</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, textAlign: 'right' }}>
                          <MapPin size={11} style={{ display: 'inline', marginRight: 2 }} />
                          {formatDistance(p.distance)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sellers.length === 0 && products.length === 0 && (
                <div className="empty-state">
                  <MapPin size={44} />
                  <h3>Nothing found within {radius} km</h3>
                  <p>Try increasing your radius filter above.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
