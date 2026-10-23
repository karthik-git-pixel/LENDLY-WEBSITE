'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getBookedProductIds } from './supabase-db';
import { matchesCategory } from './catalog';
import type { NearbyItem } from './use-nearby';

export type MarketView = 'all' | 'rent';
export type MarketSort = 'popular' | 'nearest' | 'newest' | 'price_asc' | 'price_desc';

export interface MarketFilters {
  type: MarketView;
  category: string;
  /** Narrows a category, e.g. "Halls & Venues" */
  sub: string | null;
  sort: MarketSort;
  minPrice: number | null;
  maxPrice: number | null;
  verified: boolean;
  availableToday: boolean;
}

export const DEFAULT_FILTERS: MarketFilters = {
  type: 'all',
  category: 'all',
  sub: null,
  sort: 'popular',
  minPrice: null,
  maxPrice: null,
  verified: false,
  availableToday: false,
};

const SORTS: MarketSort[] = ['popular', 'nearest', 'newest', 'price_asc', 'price_desc'];

function num(v: string | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseFilters(params: URLSearchParams): MarketFilters {
  const type = params.get('type');
  const sort = params.get('sort') as MarketSort | null;
  return {
    type: type === 'rent' ? type : 'all',
    category: params.get('category') || 'all',
    sub: params.get('sub') || null,
    sort: sort && SORTS.includes(sort) ? sort : 'popular',
    minPrice: num(params.get('min')),
    maxPrice: num(params.get('max')),
    verified: params.get('verified') === '1',
    availableToday: params.get('today') === '1',
  };
}

function toParams(f: MarketFilters, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (key: string, value: string | null) => (value === null ? p.delete(key) : p.set(key, value));
  set('type', f.type === 'all' ? null : f.type);
  set('category', f.category === 'all' ? null : f.category);
  set('sub', f.sub);
  set('sort', f.sort === 'popular' ? null : f.sort);
  set('min', f.minPrice === null ? null : String(f.minPrice));
  set('max', f.maxPrice === null ? null : String(f.maxPrice));
  set('verified', f.verified ? '1' : null);
  set('today', f.availableToday ? '1' : null);
  return p;
}

export function countActiveFilters(f: MarketFilters): number {
  return [
    f.type !== 'all',
    f.sort !== 'popular',
    f.minPrice !== null,
    f.maxPrice !== null,
    f.verified,
    f.availableToday,
  ].filter(Boolean).length;
}

/** Filter state kept in the URL, so views like /home?type=rent are shareable */
export function useMarketFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);

  const setFilters = useCallback((patch: Partial<MarketFilters>) => {
    const next = { ...filters, ...patch };
    const qs = toParams(next, new URLSearchParams(params.toString())).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, params, pathname, router]);

  const reset = useCallback(() => {
    const keep = new URLSearchParams();
    const q = params.get('q');
    if (q) keep.set('q', q);
    const qs = keep.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return { filters, setFilters, reset };
}

/** Rentals booked at some point today (end of day, local time) */
export function useBookedToday(enabled: boolean): Set<string> | null {
  const [booked, setBooked] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const start = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    getBookedProductIds(start, end).then(ids => { if (!cancelled) setBooked(ids); });
    return () => { cancelled = true; };
  }, [enabled]);
  return enabled ? booked : null;
}

export function matchesText(item: NearbyItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.title, item.description, item.category, item.subcategory,
    item.seller?.storeName, item.seller?.displayName, item.location?.address,
    ...(item.features || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every(word => haystack.includes(word));
}

export function applyFilters(items: NearbyItem[], f: MarketFilters, bookedToday: Set<string> | null): NearbyItem[] {
  const filtered = items.filter(item => {
    if (f.type !== 'all' && item.listingType !== f.type) return false;
    if (!matchesCategory(item, f.category)) return false;
    if (f.sub && (item.subcategory || '').toLowerCase() !== f.sub.toLowerCase()) return false;
    if (f.minPrice !== null && item.price < f.minPrice) return false;
    if (f.maxPrice !== null && item.price > f.maxPrice) return false;
    if (f.verified && item.seller?.kycStatus !== 'VERIFIED') return false;
    if (f.availableToday && item.listingType === 'rent' && bookedToday?.has(item.id)) return false;
    return true;
  });
  return sortItems(filtered, f.sort);
}

export function sortItems(items: NearbyItem[], sort: MarketSort): NearbyItem[] {
  const list = [...items];
  switch (sort) {
    case 'nearest':
      return list.sort((a, b) => a.distance - b.distance);
    case 'newest':
      return list.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    case 'price_asc':
      return list.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return list.sort((a, b) => b.price - a.price);
    default:
      // Popular: most viewed, nearer first among equals
      return list.sort((a, b) => (b.views || 0) - (a.views || 0) || a.distance - b.distance);
  }
}

export const SORT_LABELS: Record<MarketSort, string> = {
  popular: 'Popular',
  nearest: 'Nearest first',
  newest: 'Newest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};
