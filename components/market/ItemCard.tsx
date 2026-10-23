'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { rentUnitInfo } from '@/lib/catalog';
import { areaName, formatDistance } from '@/lib/location';
import type { NearbyItem } from '@/lib/use-nearby';
import { avatarFor } from '@/components/AppHeader';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=60';

export const ITEM_SIZES = '(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1199px) 25vw, 240px';

interface ItemCardProps {
  item: NearbyItem;
  /** Above-the-fold cards load eagerly */
  priority?: boolean;
}

export default function ItemCard({ item, priority = false }: ItemCardProps) {
  const { profile, toggleSaved } = useAuth();
  const { requireAuth } = useRequireAuth();
  const [busy, setBusy] = useState(false);
  const saved = Boolean(profile?.savedProducts?.includes(item.id));
  const isRent = item.listingType === 'rent';
  const area = areaName(item.location?.address);
  const sellerName = item.seller?.storeName || item.seller?.displayName || 'Neighbour';

  const onSave = async () => {
    if (!requireAuth(undefined, 'Log in to save items')) return;
    setBusy(true);
    try { await toggleSaved(item.id); } finally { setBusy(false); }
  };

  return (
    <article className="ln-item">
      <Link href={`/product/${item.id}`} className="ln-item-link">
        <div className="ln-item-media">
          <Image
            src={item.images?.[0] || FALLBACK_IMAGE}
            alt={item.title}
            fill
            sizes={ITEM_SIZES}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
          />
          <span className={`ln-tag ${isRent ? 'ln-tag-rent' : ''}`}>{isRent ? 'RENT' : 'SALE'}</span>
        </div>
        <div className="ln-item-body">
          <h3 className="ln-item-title">{item.title}</h3>
          <p className="ln-item-price">
            ₹{Math.round(item.price).toLocaleString('en-IN')}
            {isRent && <small>/{rentUnitInfo(item.rentDuration).short}</small>}
          </p>
          <p className="ln-item-meta">
            <Image src={avatarFor(sellerName, item.seller?.avatarUrl)} alt="" width={18} height={18} unoptimized />
            <span>{formatDistance(item.distance)}{area ? ` · ${area}` : ''}</span>
          </p>
        </div>
      </Link>
      <button
        type="button"
        className={`ln-heart ${saved ? 'is-saved' : ''}`}
        onClick={onSave}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
      >
        <span><Heart size={16} fill={saved ? '#ef4444' : 'none'} color={saved ? '#ef4444' : '#0f172a'} strokeWidth={2.2} /></span>
      </button>
    </article>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="ln-item" aria-hidden="true">
      <div className="ln-item-media ln-skel" />
      <div className="ln-item-body">
        <div className="ln-skel ln-skel-line" style={{ width: '85%' }} />
        <div className="ln-skel ln-skel-line" style={{ width: '45%', height: 16 }} />
        <div className="ln-skel ln-skel-line" style={{ width: '65%' }} />
      </div>
    </div>
  );
}
