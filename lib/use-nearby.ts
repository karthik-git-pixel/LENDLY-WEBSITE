'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllAvailableProducts, getAllSellers, hasPoint, type Product, type UserProfile } from './supabase-db';
import { useUserLocation } from './location-context';
import { withDistance, getDistanceKm } from './location';
import { itemsInShopGenres, resolveCategory } from './catalog';

export interface NearbyItem extends Product {
  distance: number;
  seller?: UserProfile;
}

export interface Shop extends UserProfile {
  distance: number;
  listingCount: number;
  rentCount: number;
  /** Store cover, or the shop's newest photo */
  coverImage: string;
  /** What the shop mostly offers, e.g. "Sound & DJ" */
  topCategory: string;
  isVerified: boolean;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  let best = '';
  let bestCount = 0;
  counts.forEach((n, v) => { if (n > bestCount) { best = v; bestCount = n; } });
  return best;
}

/**
 * Every available listing and storefront, measured from the user's
 * current location. Each page filters this down to what it shows.
 */
export function useNearbyMarket() {
  const { coords, radiusKm } = useUserLocation();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [sellers, setSellers] = useState<UserProfile[] | null>(null);
  /** When the data arrived — "fresh listing" ages are measured from here */
  const [loadedAt, setLoadedAt] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllAvailableProducts(), getAllSellers()])
      .then(([p, s]) => {
        if (cancelled) return;
        setProducts(p);
        setSellers(s);
        setLoadedAt(Date.now());
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setSellers([]);
        setLoadedAt(Date.now());
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  const sellerMap = useMemo(() => new Map((sellers || []).map(s => [s.uid, s])), [sellers]);

  const items = useMemo<NearbyItem[]>(() => {
    if (!products) return [];
    return withDistance(products, coords)
      .map(p => ({ ...p, seller: sellerMap.get(p.sellerId) }))
      .sort((a, b) => a.distance - b.distance);
  }, [products, coords, sellerMap]);

  const shops = useMemo<Shop[]>(() => {
    if (!sellers || !products) return [];
    const bySeller = new Map<string, Product[]>();
    for (const p of products) {
      const list = bySeller.get(p.sellerId);
      if (list) list.push(p); else bySeller.set(p.sellerId, [p]);
    }
    return sellers
      .map(s => {
        // Only what fits the genre the shop deals in counts as its stock
        const listings = itemsInShopGenres(s.storeCategory, bySeller.get(s.uid) || []);
        const where = hasPoint(s.storeLocation) ? s.storeLocation : listings.find(l => hasPoint(l.location))?.location;
        if (!where) return null;
        const topCategory = s.storeCategory
          || mostCommon(listings.map(l => l.subcategory || resolveCategory(l.category, l.subcategory).name))
          || 'Local shop';
        return {
          ...s,
          distance: getDistanceKm(coords, where),
          listingCount: listings.length,
          rentCount: listings.filter(l => l.listingType === 'rent').length,
          coverImage: s.coverUrl || listings.find(l => l.images?.length)?.images[0] || '',
          topCategory,
          isVerified: s.kycStatus === 'VERIFIED',
        } satisfies Shop;
      })
      .filter((s): s is Shop => Boolean(s))
      .sort((a, b) => a.distance - b.distance);
  }, [sellers, products, coords]);

  return {
    loading: products === null || sellers === null,
    loadedAt,
    items,
    nearbyItems: useMemo(() => items.filter(i => i.distance <= radiusKm), [items, radiusKm]),
    shops,
    nearbyShops: useMemo(() => shops.filter(s => s.distance <= radiusKm && s.listingCount > 0), [shops, radiusKm]),
    sellerMap,
    radiusKm,
    reload,
  };
}
