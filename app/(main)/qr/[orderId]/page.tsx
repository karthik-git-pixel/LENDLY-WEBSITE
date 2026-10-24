'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from '@/components/AppImage';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Navigation,
  Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import {
  cancelOrder,
  getHandoverCode,
  getOrder,
  getProduct,
  getUserProfile,
  hasPoint,
  subscribeToOrder,
  type GeoPoint,
  type Order,
  type UserProfile,
} from '@/lib/supabase-db';
import { openChat } from '@/lib/chat';
import { requestRefund } from '@/lib/checkout';
import { orderSteps, paymentLabel, rentBreakdown, statusLabel, statusTone } from '@/lib/orders';
import { formatDistance, getDistanceKm, getGoogleMapsUrl } from '@/lib/location';
import { useUserLocation } from '@/lib/location-context';
import { formatRange } from '@/lib/time';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="qr-map-skel" />,
});

export default function QRPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { profile } = useAuth();
  const { coords: userCoords, device } = useUserLocation();

  const [order, setOrder] = useState<Order | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [shopLocation, setShopLocation] = useState<GeoPoint | null>(null);
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOrder(orderId), getHandoverCode(orderId)]).then(async ([o, c]) => {
      if (cancelled) return;
      setOrder(o);
      setCode(c);
      if (o) {
        try {
          const [prod, seller] = await Promise.all([
            o.productId ? getProduct(o.productId) : null,
            o.sellerId ? getUserProfile(o.sellerId) : null,
          ]);
          if (cancelled) return;
          if (seller) setSellerProfile(seller);
          const loc = (prod?.location && hasPoint(prod.location))
            ? prod.location
            : (seller?.storeLocation && hasPoint(seller.storeLocation))
              ? seller.storeLocation
              : (seller?.location && hasPoint(seller.location))
                ? seller.location
                : (o.seller?.storeLocation && hasPoint(o.seller.storeLocation))
                  ? o.seller.storeLocation
                  : null;
          setShopLocation(loc);
        } catch {
          // Fallback gracefully
        }
      }
      setLoaded(true);
    });

    // The page flips to "Handed over" the moment the seller scans
    const unsubscribe = subscribeToOrder(orderId, updated =>
      setOrder(prev => ({ ...updated, buyer: prev?.buyer, seller: prev?.seller }))
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [orderId]);

  const distanceKm = useMemo(() => {
    if (!shopLocation || !hasPoint(shopLocation) || !userCoords) return null;
    const d = getDistanceKm(userCoords, shopLocation);
    return Number.isFinite(d) ? d : null;
  }, [shopLocation, userCoords]);

  if (!loaded) {
    return (
      <div className="ln-page">
        <div className="ln-shell">
          <div className="ln-skel" style={{ height: 320, borderRadius: 20, marginTop: 24 }} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="ln-page">
        <div className="ln-shell">
          <div className="ln-empty">
            <h2>Order not found</h2>
            <div className="ln-empty-actions">
              <Link href="/profile/orders" className="ln-btn ln-btn-primary">
                My bookings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isBuyer = profile?.uid === order.buyerId;
  const rent = order.orderType === 'rent';
  const open = ['pending', 'accepted', 'active'].includes(order.status);
  const steps = orderSteps(order);

  const cancel = async () => {
    if (!confirm('Cancel this order?')) return;
    try {
      const updated = await cancelOrder(order.id);
      setOrder(updated);
      if (updated.paymentStatus === 'refund_pending') await requestRefund(updated.id).catch(() => undefined);
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    }
  };

  const chat = async () => {
    try {
      router.push(`/chat/${await openChat(isBuyer ? order.sellerId : order.buyerId, order.productId)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open chat');
    }
  };

  const shopName =
    sellerProfile?.storeName || order.seller?.storeName || order.seller?.displayName || 'Pickup Store';

  return (
    <div className="ln-page">
      <div className="top-header">
        <button
          type="button"
          className="ln-icon-btn"
          onClick={() => router.push('/profile/orders')}
          aria-label="Back to bookings"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>{rent ? 'Your booking' : 'Your order'}</h1>
        <span style={{ width: 44 }} />
      </div>

      <div className="ln-shell qr-wrap">
        <div className="qr-product">
          {order.productImage && (
            <span className="od-img">
              <Image src={order.productImage} alt="" fill sizes="72px" />
            </span>
          )}
          <div>
            <span className={`od-status is-${statusTone(order)}`}>
              {statusLabel(order, isBuyer ? 'buyer' : 'seller')}
            </span>
            <h2>{order.productTitle}</h2>
            <p>
              {shopName} · ₹{Math.round(order.amount).toLocaleString('en-IN')} · {paymentLabel(order)}
            </p>
          </div>
        </div>

        <ol className="qr-steps">
          {steps.map(s => (
            <li key={s.label} className={s.done ? 'is-done' : ''}>
              <CheckCircle2 size={16} aria-hidden="true" /> {s.label}
            </li>
          ))}
        </ol>

        {rent && order.startAt && (
          <p className="od-line">
            <CalendarDays size={14} aria-hidden="true" /> {formatRange(order.startAt, order.endAt)} · {rentBreakdown(order)}
          </p>
        )}

        {/* QR Code / Handover Card */}
        {isBuyer && open && code ? (
          <div className="qr-card">
            <p className="qr-hint">
              {order.status === 'active'
                ? 'Returning it? Show this code — the owner scans it to close the rental.'
                : order.status === 'pending'
                  ? 'Waiting for the seller to confirm. You can still show this at pickup.'
                  : 'Show this to the seller at pickup. They scan it to hand over.'}
            </p>
            <div className="qr-code">
              <QRCodeSVG value={code} size={220} level="M" includeMargin />
            </div>
            <button
              type="button"
              className="qr-text"
              onClick={() => {
                void navigator.clipboard.writeText(code);
                toast.success('Code copied');
              }}
            >
              {code} <Copy size={14} aria-hidden="true" />
            </button>
            {order.depositAmount > 0 && order.status !== 'active' && (
              <p className="ln-note">
                Bring ₹{Math.round(order.depositAmount).toLocaleString('en-IN')} refundable deposit
                {order.paymentMethod === 'online' ? '' : ` + ₹${Math.round(order.amount).toLocaleString('en-IN')} rent`}.
              </p>
            )}
          </div>
        ) : order.status === 'completed' ? (
          <div className="qr-card is-done">
            <CheckCircle2 size={48} aria-hidden="true" />
            <h2>{rent ? 'Returned — all done' : 'Handed over — enjoy!'}</h2>
            {order.lateFee > 0 && <p className="ln-note ln-note-warn">Late fee: ₹{order.lateFee}</p>}
            <Link href="/profile/orders" className="ln-btn ln-btn-primary">
              Leave a review
            </Link>
          </div>
        ) : !open ? (
          <div className="qr-card">
            <h2>This order was {order.status}</h2>
            {order.declineReason && <p className="ln-note">{order.declineReason}</p>}
          </div>
        ) : (
          <div className="qr-card">
            <p className="qr-hint">The buyer will show you their code. Scan it to hand over.</p>
            <Link href="/scan" className="ln-btn ln-btn-primary">
              Open scanner
            </Link>
          </div>
        )}

        {/* Shop Location & Google Maps View to reach the shop */}
        {shopLocation && hasPoint(shopLocation) && (
          <section className="qr-location-card" aria-label="Shop and pickup location">
            <div className="qr-location-header">
              <div className="qr-location-shop-meta">
                <div className="qr-location-badge">
                  <Store size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3>{shopName}</h3>
                  <p className="qr-location-address">
                    <MapPin size={13} aria-hidden="true" />
                    <span>{shopLocation.address || 'Pickup location'}</span>
                    {distanceKm !== null && (
                      <span className="qr-distance-chip">{formatDistance(distanceKm)} away</span>
                    )}
                  </p>
                </div>
              </div>
              <a
                href={getGoogleMapsUrl(shopLocation.lat, shopLocation.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="ln-btn ln-btn-sm ln-btn-primary qr-directions-btn"
                title="Get turn-by-turn directions in Google Maps"
              >
                <Navigation size={14} aria-hidden="true" />
                Directions
              </a>
            </div>

            <div className="qr-map-frame">
              <MapView
                center={shopLocation}
                pin={shopLocation}
                user={
                  device
                    ? { lat: device.lat, lng: device.lng, accuracy: device.accuracy }
                    : userCoords
                      ? { lat: userCoords.lat, lng: userCoords.lng }
                      : null
                }
                height={230}
                className="qr-map-embed"
              />
            </div>

            {shopLocation.details && (
              <div className="qr-location-landmark">
                <strong>Pickup note / Landmark:</strong> {shopLocation.details}
              </div>
            )}

            <div className="qr-location-footer">
              <a
                href={getGoogleMapsUrl(shopLocation.lat, shopLocation.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="qr-maps-full-link"
              >
                <ExternalLink size={14} aria-hidden="true" /> Open in Google Maps
              </a>
              {shopLocation.address && (
                <button
                  type="button"
                  className="ln-btn ln-btn-ghost ln-btn-sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(shopLocation.address);
                    toast.success('Address copied');
                  }}
                >
                  <Copy size={13} aria-hidden="true" /> Copy address
                </button>
              )}
            </div>
          </section>
        )}

        <div className="od-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="ln-btn ln-btn-ghost" onClick={chat}>
            <MessageCircle size={16} aria-hidden="true" /> Chat
          </button>
          {isBuyer && ['pending', 'accepted'].includes(order.status) && (
            <button type="button" className="ln-btn ln-btn-danger" onClick={cancel}>
              Cancel order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
