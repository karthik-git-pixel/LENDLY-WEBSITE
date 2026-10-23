'use client';

import Image from 'next/image';
import { useState, useEffect, use } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getUserProfile,
  getProductsBySeller,
  isSubscribed,
  subscribeToSeller,
  unsubscribeFromSeller,
  updateUserProfile,
  type Product,
  type UserProfile
} from '@/lib/firestore';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { createOrGetChatRoom } from '@/lib/chat';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Bell, BellOff, MessageCircle, ExternalLink,
  Package, Star, ShieldCheck, Share2, Search, Filter, Camera, Store,
  CheckCircle2, Sparkles, Navigation
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [seller, setSeller] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters within seller store
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'rent'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Seller Own Edit State
  const isOwnProfile = profile?.uid === id;
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const s = await getUserProfile(id);
        if (cancelled) return;

        setSeller(s);
        if (s) {
          const prods = await getProductsBySeller(id);
          if (cancelled) return;

          setProducts(prods.filter(p => p.status === 'available'));
          if (profile) {
            const sub = await isSubscribed(profile.uid, id);
            if (!cancelled) {
              setSubscribed(sub);
            }
          }
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
  }, [id, profile]);

  const handleSubscribe = async () => {
    if (!profile) return toast.error('Please log in to follow this seller');
    if (subscribed) {
      await unsubscribeFromSeller(profile.uid, id);
      setSubscribed(false);
      toast.success('Unfollowed seller notifications');
    } else {
      await subscribeToSeller(profile.uid, id);
      setSubscribed(true);
      toast.success('Subscribed! You will receive alerts for new listings.');
    }
  };

  const handleChat = async () => {
    if (!profile || !seller) return router.push('/login');
    if (profile.uid === seller.uid) return toast.error('This is your own seller store');

    try {
      const roomId = await createOrGetChatRoom(
        profile.uid,
        seller.uid,
        profile.displayName || 'Buyer',
        seller.storeName || seller.displayName || 'Seller',
        profile.avatarUrl || '',
        seller.avatarUrl || '',
      );
      router.push(`/chat/${roomId}`);
    } catch (err) {
      console.error('Chat error:', err);
      toast.error('Failed to open chat');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: seller?.storeName || seller?.displayName || 'Lendly Seller',
          text: `Check out ${seller?.storeName || seller?.displayName}'s store on Lendly!`,
          url,
        });
      } catch {
        // Fallback
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Store link copied to clipboard!');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      setUploadingAvatar(true);
      const url = await uploadImageToCloudinary(file, profile.uid, 'avatar');
      await updateUserProfile(profile.uid, { avatarUrl: url });
      setSeller(prev => prev ? { ...prev, avatarUrl: url } : prev);
      await refreshProfile();
      toast.success('Profile picture updated!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      setUploadingCover(true);
      const url = await uploadImageToCloudinary(file, profile.uid, 'cover');
      await updateUserProfile(profile.uid, { coverUrl: url });
      setSeller(prev => prev ? { ...prev, coverUrl: url } : prev);
      await refreshProfile();
      toast.success('Cover image updated!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload cover';
      toast.error(msg);
    } finally {
      setUploadingCover(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Store size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Seller Not Found</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>This seller store may have been deactivated or moved.</p>
        <button onClick={() => router.push('/home')} className="btn-primary" style={{ marginTop: 20, padding: '10px 24px' }}>
          Back to Home
        </button>
      </div>
    );
  }

  const filteredProducts = products.filter(p => {
    const matchesType = filterType === 'all' ||
      (filterType === 'sale' && p.listingType !== 'rent') ||
      (filterType === 'rent' && p.listingType === 'rent');
    const matchesSearch = !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div style={{ paddingBottom: 90 }} className="fade-in">
      {/* Hidden File Inputs for Seller's Own Store */}
      {isOwnProfile && (
        <>
          <input id="public-seller-avatar" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          <input id="public-seller-cover" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
        </>
      )}

      {/* Top Header Bar */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleShare} className="btn-secondary" style={{ padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Share2 size={15} />
            <span>Share Store</span>
          </button>
          {isOwnProfile && (
            <button onClick={() => router.push('/seller/dashboard')} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800 }}>
              Seller Dashboard
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '16px auto 0', padding: '0 20px' }}>
        {/* Luxury Cover Banner Card */}
        <div className="glass-card" style={{ borderRadius: 26, overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', marginBottom: 28 }}>
          {/* Cover Image */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: 220,
            background: seller.coverUrl
              ? `url(${seller.coverUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, #0b2240 0%, #1e293b 50%, #2b3a55 100%)',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%)' }} />

            {/* Cover Upload Button for Owner */}
            {isOwnProfile && (
              <button
                onClick={() => document.getElementById('public-seller-cover')?.click()}
                disabled={uploadingCover}
                className="btn-secondary"
                style={{
                  position: 'absolute', top: 16, right: 16,
                  padding: '7px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                  background: 'rgba(0,0,0,0.65)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, zIndex: 2
                }}
              >
                <Camera size={14} />
                <span>{uploadingCover ? 'Uploading...' : 'Update Cover'}</span>
              </button>
            )}
          </div>

          {/* Profile Details & Store Metrics */}
          <div style={{ padding: '0 26px 26px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20, marginTop: -50 }}>
              {/* Avatar + Main Title */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
                <div style={{ position: 'relative', width: 96, height: 96, borderRadius: 26, overflow: 'hidden', border: '4px solid var(--surface)', background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', flexShrink: 0 }}>
                  <Image
                    src={seller.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.displayName)}&background=0b2240&color=fff`}
                    alt=""
                    fill
                    unoptimized
                    style={{ objectFit: 'cover' }}
                  />

                  {/* Avatar Upload for Owner */}
                  {isOwnProfile && (
                    <button
                      onClick={() => document.getElementById('public-seller-avatar')?.click()}
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
                  )}
                </div>

                <div style={{ paddingBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.7)', margin: 0, letterSpacing: '-0.5px' }}>
                      {seller.storeName || seller.displayName}
                    </h1>
                    <span className="badge badge-primary" style={{ fontSize: 11.5, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ShieldCheck size={13} /> Verified Seller
                    </span>
                  </div>

                  <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '4px 0 0', fontWeight: 500, maxWidth: 550 }}>
                    {seller.storeDescription || 'Local verified seller providing instant neighborhood pickup & rentals.'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
                    <span style={{ color: '#ea580c', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={14} fill="#fca311" /> {seller.rating?.toFixed(1) || '5.0'} ({seller.reviewCount || 0} reviews)
                    </span>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} style={{ color: 'var(--primary)' }} />
                      {seller.location?.address?.split(',').slice(0, 2).join(',') || 'Local Area'}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                      {products.length} active listing{products.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Chat & Follow */}
              {!isOwnProfile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
                  <button
                    onClick={handleSubscribe}
                    className={subscribed ? 'btn-secondary' : 'btn-secondary'}
                    style={{
                      padding: '10px 18px', borderRadius: 14, fontSize: 13.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: subscribed ? 'rgba(249,115,22,0.12)' : 'var(--surface-hover)',
                      borderColor: subscribed ? 'var(--primary)' : 'var(--border-color)'
                    }}
                  >
                    {subscribed ? (
                      <>
                        <BellOff size={16} style={{ color: 'var(--primary-dark)' }} />
                        <span style={{ color: 'var(--primary-dark)' }}>Following</span>
                      </>
                    ) : (
                      <>
                        <Bell size={16} />
                        <span>Follow Seller</span>
                      </>
                    )}
                  </button>

                  <button onClick={handleChat} className="btn-primary" style={{ padding: '10px 22px', borderRadius: 14, fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageCircle size={17} />
                    <span>Chat & Inquire</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Store Inventory Section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 900, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={19} style={{ color: 'var(--primary)' }} />
                Store Catalog ({filteredProducts.length})
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 0' }}>
                Browse verified items available for immediate pickup or rental
              </p>
            </div>

            {/* Filter and Search within Seller Store */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-hover)', padding: '6px 12px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <Search size={15} style={{ color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Search in store..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12.5, color: 'var(--foreground)', width: 140 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-hover)', padding: 3, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'sale', label: 'Buy' },
                  { id: 'rent', label: 'Rent' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setFilterType(t.id as 'all' | 'sale' | 'rent')}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: filterType === t.id ? 'var(--foreground)' : 'transparent',
                      color: filterType === t.id ? '#ffffff' : 'var(--muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', borderRadius: 24 }}>
              <Package size={44} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>No matching listings</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>This seller currently has no items matching your criteria.</p>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="product-card"
                  onClick={() => router.push(`/product/${product.id}`)}
                  style={{
                    borderRadius: 22,
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '190px', overflow: 'hidden', background: 'var(--surface-hover)' }}>
                    <Image
                      src={product.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=60'}
                      alt={product.title}
                      fill
                      unoptimized
                      style={{ objectFit: 'cover', transition: 'transform 0.3s ease' }}
                    />
                    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
                      <span className={`badge ${product.listingType === 'rent' ? 'badge-warning' : 'badge-primary'}`} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 800 }}>
                        {product.listingType === 'rent' ? 'Rent' : 'Buy'}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{
                      fontWeight: 800, fontSize: 15, color: 'var(--foreground)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4
                    }}>
                      {product.title}
                    </div>

                    <div style={{ fontSize: 11.5, color: '#64748b', opacity: 0.85, fontWeight: 500, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.category}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--foreground)' }}>
                        ₹{product.price.toLocaleString()}
                        {product.listingType === 'rent' && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>/day</span>}
                      </div>

                      <span className="btn-ghost" style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, color: 'var(--primary-dark)' }}>
                        View Details ➔
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location & Neighborhood Directions Card */}
        {seller.location && seller.location.lat !== 0 && (
          <div className="glass-card" style={{ padding: 22, borderRadius: 24, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={17} style={{ color: 'var(--primary)' }} />
                  Store Location & Neighborhood Proximity
                </h3>
                <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 0' }}>
                  {seller.location.address || 'Neighborhood verified local address'}
                </p>
              </div>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${seller.location.lat},${seller.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <button className="btn-secondary" style={{ padding: '8px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={14} style={{ color: 'var(--primary-dark)' }} />
                  <span>Get Directions</span>
                  <ExternalLink size={12} />
                </button>
              </a>
            </div>

            <div style={{ height: 220, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <MapView
                center={seller.storeLocation || seller.location}
                sellers={[{ ...seller, distance: 0 }]}
                products={[]}
                radiusKm={2}
                onSellerClick={() => {}}
                onProductClick={() => {}}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
