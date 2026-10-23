'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Clock, Heart, MapPin, MessageCircle, Package, Share2, ShieldCheck, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useUserLocation } from '@/lib/location-context';
import {
  getProductsBySeller, getReviewsForSeller, getUserProfile, hasPoint, isSubscribed, subscribeToSeller, unsubscribeFromSeller,
  type Product, type Review, type UserProfile,
} from '@/lib/supabase-db';
import { openChat } from '@/lib/chat';
import { formatDistance, getDistanceKm } from '@/lib/location';
import { getOpenState } from '@/lib/store-hours';
import { itemsInShopGenres, rentUnitInfo } from '@/lib/catalog';
import { formatDate } from '@/lib/time';
import { avatarFor } from '@/components/AppHeader';

export default function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { coords } = useUserLocation();
  const [shop, setShop] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState('All Products');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getUserProfile(id), getProductsBySeller(id), getReviewsForSeller(id)]).then(([s, p, r]) => {
      if (cancelled) return;
      setShop(s);
      // Rentals only, and only what fits the genre this shop deals in
      setItems(itemsInShopGenres(s?.storeCategory, p.filter(x => x.status !== 'paused' && x.listingType === 'rent')));
      setReviews(r);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!profile || profile.uid === id) return;
    let cancelled = false;
    isSubscribed(profile.uid, id).then(v => { if (!cancelled) setFollowing(v); });
    return () => { cancelled = true; };
  }, [profile, id]);

  const tabs = useMemo(() => ['All Products', ...new Set(items.map(i => i.subcategory || i.category).filter(Boolean))], [items]);
  const shown = tab === 'All Products' ? items : items.filter(i => (i.subcategory || i.category) === tab);

  if (!loaded) return <div className="ln-page"><div className="sp-hero ln-skel" /></div>;
  if (!shop) {
    return (
      <div className="ln-page"><div className="ln-shell">
        <div className="ln-empty"><h2>Shop not found</h2><div className="ln-empty-actions"><Link href="/home" className="ln-btn ln-btn-primary">Back home</Link></div></div>
      </div></div>
    );
  }

  const name = shop.storeName || shop.displayName || 'Lendly shop';
  const where = hasPoint(shop.storeLocation) ? shop.storeLocation : items.find(i => hasPoint(i.location))?.location;
  const distance = where ? getDistanceKm(coords, where) : null;
  const open = getOpenState(shop.storeHours);
  const cover = shop.coverUrl || items.find(i => i.images?.length)?.images[0] || '';
  const isMine = profile?.uid === shop.uid;
  const rentals = items.length;

  const chat = async () => {
    if (!requireAuth(undefined, 'Log in to chat with this shop')) return;
    try { router.push(`/chat/${await openChat(shop.uid)}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not open chat'); }
  };

  const follow = async () => {
    if (!profile || !requireAuth(undefined, 'Log in to follow shops')) return;
    try {
      if (following) await unsubscribeFromSeller(profile.uid, shop.uid);
      else await subscribeToSeller(profile.uid, shop.uid);
      setFollowing(!following);
      toast.success(following ? 'Unfollowed' : 'Following — you\'ll see their new listings');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    }
  };

  const share = async () => {
    if (navigator.share) await navigator.share({ title: name, url: window.location.href }).catch(() => undefined);
    else { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }
  };

  return (
    <div className="ln-page">
      <div className="sp-hero">
        {cover ? <Image src={cover} alt="" fill sizes="100vw" loading="eager" fetchPriority="high" /> : null}
        <div className="sp-hero-bar">
          <button type="button" className="ln-icon-btn sp-round" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
          <div>
            {!isMine && (
              <button type="button" className="ln-icon-btn sp-round" onClick={follow} aria-pressed={following} aria-label={following ? 'Unfollow shop' : 'Follow shop'}>
                <Heart size={19} fill={following ? '#ef4444' : 'none'} color={following ? '#ef4444' : 'currentColor'} />
              </button>
            )}
            <button type="button" className="ln-icon-btn sp-round" onClick={share} aria-label="Share shop"><Share2 size={19} /></button>
          </div>
        </div>
      </div>

      <div className="ln-shell">
        <div className="sp-card">
          <h1>
            <Image src={avatarFor(name, shop.avatarUrl)} alt="" width={40} height={40} unoptimized style={{ borderRadius: 12, objectFit: 'cover' }} />
            {name}
            {shop.kycStatus === 'VERIFIED' && <BadgeCheck size={20} className="ln-verified" aria-label="Verified shop" />}
          </h1>
          <p className="sp-meta">
            <span><Star size={15} fill="#f59e0b" color="#f59e0b" aria-hidden="true" /> <strong>{shop.reviewCount ? Number(shop.rating).toFixed(1) : 'New'}</strong>{shop.reviewCount ? ` (${shop.reviewCount} reviews)` : ''}</span>
            {distance !== null && <span><MapPin size={15} aria-hidden="true" /> {formatDistance(distance)}</span>}
            {open && <span><span className={open.open ? 'ln-open' : ''}>{open.open ? 'Open' : 'Closed'}</span> · {open.label.split('·').pop()?.trim()}</span>}
          </p>
          {shop.storeDescription && <p className="ln-note" style={{ color: 'var(--ln-sub)' }}>{shop.storeDescription}</p>}

          <div className="sp-features">
            <div><ShieldCheck size={20} aria-hidden="true" />{shop.kycStatus === 'VERIFIED' ? 'Verified Shop' : 'Lendly Shop'}</div>
            <div><Package size={20} aria-hidden="true" />{rentals} Rentals</div>
            <div><Clock size={20} aria-hidden="true" />Since {formatDate(shop.createdAt) || 'recently'}</div>
            <div><BadgeCheck size={20} aria-hidden="true" />QR handover</div>
          </div>

          {!isMine && (
            <div style={{ display: 'flex', gap: 10, margin: '12px 0 4px' }}>
              <button type="button" className="ln-btn ln-btn-primary" style={{ flex: 1 }} onClick={chat}><MessageCircle size={17} aria-hidden="true" /> Chat with shop</button>
              <button type="button" className="ln-btn ln-btn-ghost" onClick={follow}>{following ? 'Following' : 'Follow'}</button>
            </div>
          )}
          {isMine && (
            <>
              <div style={{ display: 'flex', gap: 10, margin: '12px 0 4px' }}>
                <Link href="/sell" className="ln-btn ln-btn-primary" style={{ flex: 1 }}>Open seller hub</Link>
                <Link href="/sell/shop" className="ln-btn ln-btn-ghost">Edit shop</Link>
              </div>
              {shop.kycStatus !== 'VERIFIED' && (
                <p className="ln-note">
                  Only you see this: {shop.kycStatus === 'PENDING_VERIFICATION'
                    ? 'your ID is under review — the Verified badge appears once it’s approved.'
                    : <>renters trust verified shops more. <Link href="/sell/verify" className="ln-text-btn">Verify your identity</Link></>}
                </p>
              )}
            </>
          )}
        </div>

        <div className="ln-underline-tabs" role="tablist" style={{ marginTop: 8 }}>
          {tabs.map(t => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="ln-empty"><h2>No listings yet</h2></div>
        ) : (
          <div className="sp-grid">
            {shown.map(p => (
              <Link key={p.id} href={`/product/${p.id}`} className="sp-item">
                <span className="sp-item-img">
                  {p.images?.[0] && <Image src={p.images[0]} alt={p.title} fill sizes="(max-width: 767px) 50vw, 25vw" />}
                  <span className="ln-tag ln-tag-rent">RENT</span>
                </span>
                <span className="sp-item-body">
                  <h3>{p.title}</h3>
                  <span className="sp-item-price">
                    ₹{Math.round(p.price).toLocaleString('en-IN')}
                    <small> / {rentUnitInfo(p.rentDuration).short}</small>
                  </span>
                  <span className="sp-item-foot">
                    <span style={{ fontSize: 12, color: 'var(--ln-sub)' }}>
                      {p.status === 'available' ? (p.capacity ? `Up to ${p.capacity} guests` : p.condition || 'Available') : p.status}
                    </span>
                    <span className="sp-add">Book</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}

        {reviews.length > 0 && (
          <section className="ln-section">
            <h2 className="ln-section-title">Reviews</h2>
            <ul className="pd-reviews" style={{ marginTop: 10 }}>
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
          </section>
        )}
      </div>
    </div>
  );
}
