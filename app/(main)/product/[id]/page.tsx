'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bell, BellOff, CheckCircle2, Flag, Handshake, Heart, MapPin, Navigation, Pencil,
  QrCode, Share2, ShieldCheck, Star, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useUserLocation } from '@/lib/location-context';
import {
  getCachedProduct, getProduct, getProductBookings, getReviewsForProduct, getReviewsForSeller, getUserProfile,
  incrementProductViews, isSubscribed, isSubscribedToStock, subscribeToSeller, subscribeToStockNotification,
  unsubscribeFromSeller, unsubscribeFromStockNotification, type BookedSlot, type Product, type Review, type UserProfile,
} from '@/lib/supabase-db';
import { openChat } from '@/lib/chat';
import { formatDistance, getDistanceKm, getGoogleMapsUrl, areaName } from '@/lib/location';
import { getCategory, matchesCategory, pluralUnit } from '@/lib/catalog';
import { recordRecentlyViewed } from '@/lib/recently-viewed';
import { useOnlinePayments } from '@/lib/checkout';
import { useNearbyMarket } from '@/lib/use-nearby';
import { formatDate } from '@/lib/time';
import Gallery from '@/components/product/Gallery';
import RentBox from '@/components/product/RentBox';
import SaleBox from '@/components/product/SaleBox';
import SellerCard from '@/components/product/SellerCard';
import ReportSheet from '@/components/product/ReportSheet';
import { ItemRow } from '@/components/market/ItemGrid';
import ProductDetailSkeleton from '@/components/ProductDetailSkeleton';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="pd-map-skel ln-skel" /> });

const STATUS_COPY: Record<string, string> = {
  reserved: 'Reserved',
  sold: 'Sold',
  rented: 'Rented out',
  paused: 'Paused by seller',
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile, toggleSaved } = useAuth();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const { coords, device } = useUserLocation();
  const online = useOnlinePayments();
  const market = useNearbyMarket();

  const [product, setProduct] = useState<Product | null>(() => (typeof window !== 'undefined' ? getCachedProduct(id) : null));
  const [loaded, setLoaded] = useState(Boolean(product));
  const [seller, setSeller] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<BookedSlot[]>([]);
  const [following, setFollowing] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProduct(id).then(p => {
      if (cancelled) return;
      setProduct(p);
      setLoaded(true);
      if (!p) return;
      recordRecentlyViewed(p.id);
      void incrementProductViews(p.id);
      getUserProfile(p.sellerId).then(s => { if (!cancelled) setSeller(s); });
      Promise.all([getReviewsForProduct(p.id), getReviewsForSeller(p.sellerId)]).then(([a, b]) => {
        if (cancelled) return;
        const seen = new Set(a.map(r => r.id));
        setReviews([...a, ...b.filter(r => !seen.has(r.id))]);
      });
      if (p.listingType === 'rent') getProductBookings(p.id).then(list => { if (!cancelled) setBookings(list); });
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!profile || !product) return;
    let cancelled = false;
    Promise.all([isSubscribed(profile.uid, product.sellerId), isSubscribedToStock(profile.uid, product.id)])
      .then(([f, s]) => { if (!cancelled) { setFollowing(f); setAlerted(s); } });
    return () => { cancelled = true; };
  }, [profile, product]);

  const similar = useMemo(() => {
    if (!product) return [];
    const cat = getCategory(product.category)?.id || '';
    return market.nearbyItems
      .filter(i => i.id !== product.id && i.listingType === product.listingType && matchesCategory(i, cat))
      .slice(0, 10);
  }, [market.nearbyItems, product]);

  if (!loaded) return <ProductDetailSkeleton />;
  if (!product) {
    return (
      <div className="ln-page"><div className="ln-shell">
        <div className="ln-empty" style={{ marginTop: 40 }}>
          <h2>Listing not found</h2>
          <p>It may have been sold or removed by the seller.</p>
          <div className="ln-empty-actions"><Link href="/home" className="ln-btn ln-btn-primary">Back to home</Link></div>
        </div>
      </div></div>
    );
  }

  const rent = product.listingType === 'rent';
  const isMine = profile?.uid === product.sellerId;
  const unavailable = product.status !== 'available' ? STATUS_COPY[product.status] || product.status : null;
  const hasPlace = Boolean(product.location?.lat || product.location?.lng);
  const distance = hasPlace ? getDistanceKm(coords, product.location) : null;
  const saved = Boolean(profile?.savedProducts?.includes(product.id));
  const category = getCategory(product.category);
  const attributes = Object.entries(product.attributes || {}).filter(([, v]) => v);

  const chat = async () => {
    if (!requireAuth(undefined, 'Log in to chat with the seller')) return;
    try {
      router.push(`/chat/${await openChat(product.sellerId, product.id)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open chat');
    }
  };

  const follow = async () => {
    if (!profile || !requireAuth(undefined, 'Log in to follow shops')) return;
    try {
      if (following) await unsubscribeFromSeller(profile.uid, product.sellerId);
      else await subscribeToSeller(profile.uid, product.sellerId);
      setFollowing(!following);
      toast.success(following ? 'Unfollowed' : 'You\'ll hear about their new listings');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    }
  };

  const toggleAlert = async () => {
    if (!profile || !requireAuth(undefined, 'Log in to get alerts')) return;
    try {
      if (alerted) await unsubscribeFromStockNotification(profile.uid, product.id);
      else await subscribeToStockNotification(profile.uid, product.id);
      setAlerted(!alerted);
      toast.success(alerted ? 'Alert removed' : 'We\'ll notify you when it\'s available');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the alert');
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: product.title, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const save = async () => {
    if (!requireAuth(undefined, 'Log in to save items')) return;
    await toggleSaved(product.id);
  };

  return (
    <div className="ln-page pd-page">
      <div className="pd-topbar">
        <button type="button" className="ln-icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
        <nav className="pd-crumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/home${category ? `?category=${category.id}` : ''}`}>{category?.name || product.category}</Link>
          {product.subcategory && <><span aria-hidden="true">/</span><span>{product.subcategory}</span></>}
        </nav>
        <div className="pd-topbar-actions">
          <button type="button" className="ln-icon-btn" onClick={share} aria-label="Share"><Share2 size={19} /></button>
          <button type="button" className="ln-icon-btn" onClick={save} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'}>
            <Heart size={19} fill={saved ? '#ef4444' : 'none'} color={saved ? '#ef4444' : 'currentColor'} />
          </button>
        </div>
      </div>

      <div className="ln-shell pd-layout">
        <div className="pd-area-top">
          <Gallery images={product.images} title={product.title} badge={rent ? 'FOR RENT' : 'FOR SALE'} rent={rent} dimmed={unavailable} />

          <header className="pd-head">
            <h1>{product.title}</h1>
            <p className="pd-meta">
              {distance !== null && <span><MapPin size={14} aria-hidden="true" /> {formatDistance(distance)} away{areaName(product.location.address) ? ` · ${areaName(product.location.address)}` : ''}</span>}
              {product.views ? <span>{product.views} views</span> : null}
              <span>Listed {formatDate(product.createdAt)}</span>
            </p>
            {(product.capacity || product.features?.length || attributes.length) ? (
              <ul className="pd-chips">
                {product.capacity ? <li><Users size={14} aria-hidden="true" /> Up to {product.capacity} guests</li> : null}
                {attributes.map(([k, v]) => <li key={k}>{v}</li>)}
                {product.features?.map(f => <li key={f}><CheckCircle2 size={14} aria-hidden="true" /> {f}</li>)}
              </ul>
            ) : null}
          </header>

        </div>

        {/* Under the photos on phones; a sticky right column on desktop */}
        <aside className="pd-area-box">
          {actionArea()}
          {seller && (
            <SellerCard seller={seller} following={following} onFollow={follow} onChat={chat} canInteract={!isMine} />
          )}
        </aside>

        <div className="pd-area-rest">
          {product.description && (
            <section className="pd-card">
              <h2 className="pd-card-title">About this {rent ? 'rental' : 'item'}</h2>
              <p className="pd-desc">{product.description}</p>
            </section>
          )}

          {hasPlace && (
            <section className="pd-card">
              <div className="pd-card-row">
                <h2 className="pd-card-title">{rent ? 'Pickup location' : 'Where to meet'}</h2>
                <a className="ln-text-btn" href={getGoogleMapsUrl(product.location.lat, product.location.lng)} target="_blank" rel="noopener noreferrer">
                  <Navigation size={14} aria-hidden="true" /> Directions
                </a>
              </div>
              <MapView
                center={product.location}
                pin={product.location}
                user={device ? { lat: device.lat, lng: device.lng, accuracy: device.accuracy } : null}
                height={220}
                className="pd-map"
              />
              {product.location.details && <p className="pd-map-caption"><strong>{product.location.details}</strong></p>}
              <p className="pd-map-caption">
                <MapPin size={14} aria-hidden="true" /> {product.location.address || 'Neighbourhood'}
                {distance !== null ? ` · ${formatDistance(distance)} from you` : ''}
              </p>
            </section>
          )}

          <section className="pd-card pd-trust" aria-label="How Lendly deals work">
            <div><QrCode size={18} aria-hidden="true" /><span><strong>QR-verified handover</strong> The {rent ? 'owner' : 'seller'} scans your code at pickup{rent ? ' and return' : ''}.</span></div>
            <div><ShieldCheck size={18} aria-hidden="true" /><span><strong>Verified neighbours</strong> Look for the badge on KYC-verified shops.</span></div>
            <div><Handshake size={18} aria-hidden="true" /><span><strong>Direct P2P deal</strong> {rent ? 'Pay the rent at pickup; the deposit comes back on return.' : 'Inspect first, then pay the seller directly.'}</span></div>
          </section>

          <section className="pd-card">
            <h2 className="pd-card-title">Reviews {reviews.length ? `(${reviews.length})` : ''}</h2>
            {reviews.length === 0 ? (
              <p className="pd-muted">No reviews yet. Reviews come from completed {rent ? 'rentals' : 'purchases'}.</p>
            ) : (
              <ul className="pd-reviews">
                {reviews.slice(0, 6).map(r => (
                  <li key={r.id}>
                    <div className="pd-review-head">
                      <strong>{r.buyerName}</strong>
                      <span className="ln-rating"><Star size={11} fill="currentColor" aria-hidden="true" /> {r.rating.toFixed(1)}</span>
                      <em>{formatDate(r.createdAt)}</em>
                    </div>
                    {r.comment && <p>{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {similar.length > 0 && (
            <section className="ln-section">
              <div className="ln-section-head"><h2 className="ln-section-title">Similar {rent ? 'rentals' : 'items'} nearby</h2></div>
              <ItemRow items={similar} />
            </section>
          )}

          <div className="pd-foot">
            <span>Listing ID {product.id.slice(0, 8).toUpperCase()}</span>
            {isAuthenticated && !isMine && (
              <button type="button" className="ln-text-btn" onClick={() => setReportOpen(true)}><Flag size={14} aria-hidden="true" /> Report listing</button>
            )}
          </div>
        </div>
      </div>

      {!isMine && !unavailable && (
        <div className="pd-mobile-bar">
          <div>
            <strong>₹{Math.round(product.price).toLocaleString('en-IN')}{rent ? <small>/{pluralUnit(product.rentDuration, 1).split(' ')[1]}</small> : null}</strong>
            <span>{rent ? 'Pay at pickup' : product.condition || 'Pay at pickup'}</span>
          </div>
          <button type="button" className="ln-btn ln-btn-ghost" onClick={chat} aria-label="Chat with seller">Chat</button>
          <a href="#book" className="ln-btn ln-btn-primary">{rent ? 'Book now' : 'Buy now'}</a>
        </div>
      )}

      {profile && (
        <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} reporterId={profile.uid} productId={product.id} sellerId={product.sellerId} />
      )}
    </div>
  );

  function actionArea() {
    if (!product) return null;
    if (isMine) {
      return (
        <section className="pd-box">
          <p className="pd-box-title">This is your listing</p>
          <p className="pd-muted">{unavailable ? `Status: ${unavailable}.` : 'It is live for neighbours nearby.'}</p>
          <div className="pd-actions">
            <Link href={`/sell/${product.id}/edit`} className="ln-btn ln-btn-ghost ln-btn-block"><Pencil size={16} aria-hidden="true" /> Edit listing</Link>
            <Link href={`/sell?tab=${rent ? 'rent' : 'sale'}`} className="ln-btn ln-btn-primary ln-btn-block">
              {rent ? 'Manage bookings' : 'Manage requests'}
            </Link>
          </div>
        </section>
      );
    }
    if (unavailable) {
      return (
        <section className="pd-box">
          <p className="pd-box-title">{unavailable}</p>
          <p className="pd-muted">Get a notification as soon as it&apos;s available again.</p>
          <button type="button" className="ln-btn ln-btn-primary ln-btn-block" onClick={toggleAlert}>
            {alerted ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
            {alerted ? 'Alert is on — turn off' : 'Notify me when available'}
          </button>
        </section>
      );
    }
    return rent
      ? <RentBox product={product} bookings={bookings} onlineEnabled={online} />
      : <SaleBox product={product} onlineEnabled={online} />;
  }
}
