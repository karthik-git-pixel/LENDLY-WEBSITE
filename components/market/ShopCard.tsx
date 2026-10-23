'use client';

import Image from '@/components/AppImage';
import Link from 'next/link';
import { BadgeCheck, Heart, Star } from 'lucide-react';
import { areaName, formatDistance } from '@/lib/location';
import { getOpenState } from '@/lib/store-hours';
import type { Shop } from '@/lib/use-nearby';
import { avatarFor } from '@/components/AppHeader';

interface ShopCardProps {
  shop: Shop;
  priority?: boolean;
}

/** Storefront card: photo with rating + distance, then name, what they rent, area */
export default function ShopCard({ shop, priority = false }: ShopCardProps) {
  const name = shop.storeName || shop.displayName || 'Local shop';
  const open = getOpenState(shop.storeHours);
  const rated = (shop.reviewCount || 0) > 0;
  const area = areaName(shop.storeLocation?.address);

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
            <Image src={avatarFor(name, shop.avatarUrl)} alt="" fill unoptimized />
          )}
          <span className="ln-shop-badge is-left">
            <Star size={12} fill="#facc15" color="#facc15" aria-hidden="true" />
            {rated ? `${Number(shop.rating).toFixed(1)} (${shop.reviewCount})` : 'New'}
          </span>
          <span className="ln-shop-badge is-right">{formatDistance(shop.distance)}</span>
          <span className="ln-shop-heart" aria-hidden="true"><Heart size={15} /></span>
        </div>
      </div>
      <div className="ln-shop-body">
        <h3 className="ln-shop-name">
          <span>{name}</span>
          {shop.isVerified && <BadgeCheck size={16} className="ln-verified" aria-label="Verified shop" />}
        </h3>
        <p className="ln-shop-cat">{shop.topCategory}</p>
        <p className="ln-shop-hours">
          {area || 'Nearby'}
          {open && <> · <span className={open.open ? 'is-open' : ''}>{open.label}</span></>}
        </p>
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
