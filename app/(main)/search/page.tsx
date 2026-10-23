'use client';

import { Suspense, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, Sparkles, Star } from 'lucide-react';
import { useUserLocation } from '@/lib/location-context';
import { useNearbyMarket, type NearbyItem, type Shop } from '@/lib/use-nearby';
import { applyFilters, matchesText, useBookedToday, useMarketFilters } from '@/lib/market-filters';
import { isEventQuery, matchesCategory } from '@/lib/catalog';
import { areaName, formatDistance } from '@/lib/location';
import { getOpenState } from '@/lib/store-hours';
import SearchBar from '@/components/market/SearchBar';
import FilterBar from '@/components/market/FilterBar';
import ItemGrid, { ItemGridSkeleton } from '@/components/market/ItemGrid';
import NearbyEmpty from '@/components/market/NearbyEmpty';
import { avatarFor } from '@/components/AppHeader';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="ln-skel" style={{ height: 260, borderRadius: 18, marginTop: 12 }} /> });

type ShopSort = 'nearest' | 'rating';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="ln-page"><div className="ln-shell"><ItemGridSkeleton /></div></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q') || '';
  const ai = params.get('ai') === '1';
  const tab = params.get('tab') === 'shops' ? 'shops' : params.get('tab') === 'products' ? 'products' : q ? 'products' : 'shops';
  const { filters, setFilters, reset } = useMarketFilters();
  const { coords, device, radiusKm, setRadiusKm, locate, status } = useUserLocation();
  const market = useNearbyMarket();
  const booked = useBookedToday(filters.availableToday);
  const [shopSort, setShopSort] = useState<ShopSort>('nearest');
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const items = useMemo(
    () => applyFilters(market.nearbyItems.filter(i => matchesText(i, q)), filters, booked),
    [market.nearbyItems, q, filters, booked]
  );

  const shops = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = market.nearbyShops.filter(s => {
      if (filters.verified && !s.isVerified) return false;
      const theirs = market.nearbyItems.filter(i => i.sellerId === s.uid);
      if (filters.category !== 'all' && !theirs.some(i => matchesCategory(i, filters.category))) return false;
      if (!needle) return true;
      const text = `${s.storeName} ${s.displayName} ${s.topCategory} ${s.storeDescription}`.toLowerCase();
      return text.includes(needle) || theirs.some(i => matchesText(i, needle));
    });
    return list.sort((a, b) => shopSort === 'rating'
      ? (b.reviewCount ? Number(b.rating) : 0) - (a.reviewCount ? Number(a.rating) : 0) || a.distance - b.distance
      : a.distance - b.distance);
  }, [market.nearbyShops, market.nearbyItems, q, filters, shopSort]);

  const setTab = (next: 'shops' | 'products') => {
    const p = new URLSearchParams(params.toString());
    p.set('tab', next);
    router.replace(`/search?${p.toString()}`, { scroll: false });
  };

  const user = device ? { lat: device.lat, lng: device.lng, accuracy: device.accuracy } : null;

  return (
    <div className="ln-page">
      <div className="ln-shell">
        <h1 className="ln-visually-hidden">Search {q ? `for ${q}` : 'nearby'}</h1>
        <SearchBar initialQuery={q} />

        {ai && q && (
          <p className="ln-note">
            <Sparkles size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> AI planning is coming soon — here are the closest matches for &ldquo;{q}&rdquo;.
            {isEventQuery(q) && <> <Link href="/plan" className="ln-text-btn">Build an event quote</Link></>}
          </p>
        )}

        <div className="ln-tabs" role="tablist" style={{ marginTop: 14 }}>
          <button type="button" role="tab" className="ln-tab" aria-selected={tab === 'shops'} onClick={() => setTab('shops')}>Shops</button>
          <button type="button" role="tab" className="ln-tab" aria-selected={tab === 'products'} onClick={() => setTab('products')}>Products</button>
          {tab === 'shops' && (
            <select className="ln-input" style={{ width: 'auto', height: 40, marginLeft: 'auto', borderRadius: 999 }} aria-label="Sort shops" value={shopSort} onChange={e => setShopSort(e.target.value as ShopSort)}>
              <option value="nearest">Sort: Nearest</option>
              <option value="rating">Sort: Top rated</option>
            </select>
          )}
        </div>

        <div className="sr-map">
          <MapView
            center={coords}
            user={user}
            radiusKm={radiusKm}
            shops={tab === 'shops' ? shops : []}
            products={tab === 'products' ? items.slice(0, 60) : []}
            onShopClick={id => router.push(`/seller/${id}`)}
            onProductClick={id => router.push(`/product/${id}`)}
            onLocate={async () => { const fix = await locate(); return fix ? { lat: fix.lat, lng: fix.lng } : null; }}
            locating={status === 'locating'}
            focus={focus}
            height={260}
          />
        </div>

        {tab === 'products' ? (
          <>
            <FilterBar filters={filters} onChange={setFilters} onReset={reset} radiusKm={radiusKm} onRadiusChange={setRadiusKm} resultCount={items.length} />
            <div style={{ marginTop: 16 }}>
              {market.loading ? <ItemGridSkeleton /> : items.length === 0
                ? <NearbyEmpty radiusKm={radiusKm} filtered onClearFilters={reset} onExpand={() => setRadiusKm(30)} />
                : <ItemGrid items={items} />}
            </div>
          </>
        ) : market.loading ? (
          <ItemGridSkeleton count={4} />
        ) : shops.length === 0 ? (
          <NearbyEmpty radiusKm={radiusKm} filtered={Boolean(q)} onClearFilters={reset} onExpand={() => setRadiusKm(30)} />
        ) : (
          <div style={{ marginTop: 8 }}>
            {shops.map(shop => (
              <ShopRow
                key={shop.uid}
                shop={shop}
                items={market.nearbyItems.filter(i => i.sellerId === shop.uid)}
                onHover={() => shop.storeLocation && setFocus({ lat: shop.storeLocation.lat, lng: shop.storeLocation.lng, zoom: 14 })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShopRow({ shop, items, onHover }: { shop: Shop; items: NearbyItem[]; onHover: () => void }) {
  const name = shop.storeName || shop.displayName;
  const open = getOpenState(shop.storeHours);
  const cats = [...new Set(items.map(i => i.subcategory || i.category).filter(Boolean))].slice(0, 3).join(' • ') || shop.topCategory;
  return (
    <Link href={`/seller/${shop.uid}`} className="ln-shoprow" onMouseEnter={onHover} onFocus={onHover}>
      <span className="ln-shoprow-img">
        <Image src={shop.coverImage || avatarFor(name, shop.avatarUrl)} alt="" fill sizes="96px" unoptimized={!shop.coverImage} />
      </span>
      <span className="ln-shoprow-body">
        <h3>{name}</h3>
        <span className="ln-shoprow-meta">
          <Star size={14} fill="currentColor" aria-hidden="true" />
          {shop.reviewCount ? `${Number(shop.rating).toFixed(1)} (${shop.reviewCount})` : 'New'}
          <span style={{ color: 'var(--ln-sub)', fontWeight: 500 }}>· {formatDistance(shop.distance)}{areaName(shop.storeLocation?.address) ? ` · ${areaName(shop.storeLocation?.address)}` : ''}</span>
        </span>
        <span className="ln-shoprow-cats">{cats}</span>
        <span className="ln-shoprow-foot">
          {shop.isVerified && <span className="ln-verified-pill"><BadgeCheck size={13} aria-hidden="true" /> Verified Shop</span>}
          {open && <span><span className={open.open ? 'ln-open' : ''}>{open.open ? 'Open' : 'Closed'}</span> · {open.label.split('·').pop()?.trim()}</span>}
          <span>{shop.listingCount} item{shop.listingCount === 1 ? '' : 's'}</span>
        </span>
      </span>
    </Link>
  );
}
