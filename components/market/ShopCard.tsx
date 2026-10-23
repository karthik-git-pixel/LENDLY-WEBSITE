'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Star } from 'lucide-react';
import { formatDistance } from '@/lib/location';
import { getOpenState } from '@/lib/store-hours';
import type { Shop } from '@/lib/use-nearby';
import { avatarFor } from '@/components/AppHeader';

interface ShopCardProps {
  shop: Shop;
  priority?: boolean;
}

export default function ShopCard({ shop, priority = false }: ShopCardProps) {
  const name = shop.storeName || shop.displayName || 'Local shop';
  const open = getOpenState(shop.storeHours);
  const rated = (shop.reviewCount || 0) > 0;

  return (
    <Link href={`/seller/${shop.uid}`} className="ln-shop" aria-label={`${name}, ${shop.topCategory}, ${formatDistance(shop.distance)} away`}>
      <div className="ln-shop-media">
        <div className="ln-shop-cover">
          {shop.coverImage ? (
            <Image
              src={shop.coverImage}
              alt=""
              fill
              sizes="(max-width: 639px) 66vw, 280px"
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
            />
          ) : (
            <div className="ln-shop-cover-blank" />
          )}
        </div>
        <span className="ln-shop-logo">
          <Image src={avatarFor(name, shop.avatarUrl)} alt="" width={46} height={46} unoptimized />
        </span>
      </div>
      <div className="ln-shop-body">
        <h3 className="ln-shop-name">
          <span>{name}</span>
          {shop.isVerified && <BadgeCheck size={16} className="ln-verified" aria-label="Verified seller" />}
        </h3>
        <p className="ln-shop-cat">{shop.topCategory}</p>
        <p className="ln-shop-meta">
          {rated ? (
            <span className="ln-rating"><Star size={12} fill="currentColor" aria-hidden="true" /> {Number(shop.rating).toFixed(1)}</span>
          ) : (
            <span>New</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{formatDistance(shop.distance)}</span>
          <span aria-hidden="true">·</span>
          <span>{shop.listingCount} item{shop.listingCount === 1 ? '' : 's'}</span>
        </p>
        {open && <p className={`ln-shop-hours ${open.open ? 'is-open' : ''}`}>{open.label}</p>}
      </div>
    </Link>
  );
}

export function ShopCardSkeleton() {
  return (
    <div className="ln-shop" aria-hidden="true">
      <div className="ln-shop-media"><div className="ln-shop-cover ln-skel" /></div>
      <div className="ln-shop-body">
        <div className="ln-skel ln-skel-line" style={{ width: '70%', height: 14 }} />
        <div className="ln-skel ln-skel-line" style={{ width: '45%' }} />
        <div className="ln-skel ln-skel-line" style={{ width: '60%' }} />
      </div>
    </div>
  );
}
