'use client';

import { Suspense, useMemo } from 'react';
import { Crosshair, X } from 'lucide-react';
import { useUserLocation } from '@/lib/location-context';
import { useNearbyMarket, type NearbyItem } from '@/lib/use-nearby';
import {
  applyFilters,
  useBookedToday,
  useMarketFilters,
  type MarketFilters,
} from '@/lib/market-filters';
import { getCategory, matchesCategory } from '@/lib/catalog';
import { useRecentlyViewed } from '@/lib/recently-viewed';
import SearchBar from '@/components/market/SearchBar';
import CategoryRail from '@/components/market/CategoryRail';
import FilterBar from '@/components/market/FilterBar';
import Section from '@/components/market/Section';
import ShopCard, { ShopCardSkeleton } from '@/components/market/ShopCard';
import ItemGrid, { ItemGridSkeleton, ItemRow } from '@/components/market/ItemGrid';
import EventBanner from '@/components/market/EventBanner';
import HeroBanner from '@/components/market/HeroBanner';
import EventEssentials from '@/components/market/EventEssentials';
import NearbyEmpty from '@/components/market/NearbyEmpty';
import SiteFooter from '@/components/market/SiteFooter';

const FRESH_DAYS = 14;

function gridTitle(f: MarketFilters): string {
  const cat = f.sub || getCategory(f.category)?.name;
  const noun = 'rentals';
  const what = cat ? `${cat} ${noun}` : noun;
  switch (f.sort) {
    case 'nearest': return `Nearest ${what}`;
    case 'newest': return `Newest ${what}`;
    case 'price_asc': return `${what[0].toUpperCase()}${what.slice(1)}, lowest price first`;
    case 'price_desc': return `${what[0].toUpperCase()}${what.slice(1)}, highest price first`;
    default: return `Popular ${what} near you`;
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { filters, setFilters, reset } = useMarketFilters();
  const market = useNearbyMarket();
  const { radiusKm, setRadiusKm, errorMessage, locate, status, source } = useUserLocation();
  const bookedToday = useBookedToday(filters.availableToday);
  const recentIds = useRecentlyViewed();

  const results = useMemo(
    () => applyFilters(market.nearbyItems, filters, bookedToday),
    [market.nearbyItems, filters, bookedToday]
  );

  const shops = useMemo(() => market.nearbyShops.filter(s => {
    if (filters.verified && !s.isVerified) return false;
    if (filters.type === 'rent' && s.rentCount === 0) return false;
    if (filters.category !== 'all') {
      return market.nearbyItems.some(i => i.sellerId === s.uid && matchesCategory(i, filters.category));
    }
    return true;
  }).sort((a, b) => a.distance - b.distance),
  [market.nearbyShops, market.nearbyItems, filters]);

  const fresh = useMemo(() => {
    const cutoff = market.loadedAt - FRESH_DAYS * 24 * 60 * 60 * 1000;
    return [...results]
      .filter(i => Date.parse(i.createdAt || '') > cutoff)
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .slice(0, 10);
  }, [results, market.loadedAt]);

  const recentlyViewed = useMemo(() => {
    const byId = new Map(market.items.map(i => [i.id, i]));
    return recentIds.map(id => byId.get(id)).filter((i): i is NearbyItem => Boolean(i));
  }, [recentIds, market.items]);

  const showEssentials = filters.type === 'rent' || filters.category === 'event-sound';
  const loading = market.loading;
  const nothingNearby = !loading && market.nearbyItems.length === 0;
  const filteredOut = !loading && !nothingNearby && results.length === 0;

  return (
    <div className="ln-page">
      <div className="ln-shell">
        <h1 className="ln-visually-hidden">Lendly — rent and buy from neighbours near you</h1>
        <SearchBar />
        {/* Banner first on phones; from tablet up the categories lead (see .ln-home-intro) */}
        <div className="ln-home-intro">
          {filters.type === 'all' && filters.category === 'all' && <HeroBanner />}
          <CategoryRail
            view={filters.type}
            active={filters.category}
            onSelect={category => setFilters({ category, sub: null })}
          />
        </div>

        {filters.sub && (
          <div className="ln-active-sub">
            <button type="button" className="ln-chip" aria-pressed="true" onClick={() => setFilters({ sub: null })}>
              {filters.sub} <X size={14} aria-label="Remove filter" />
            </button>
          </div>
        )}

        {loading ? (
          <>
            <Section title="Shops near you">
              <div className="ln-hscroll">
                {Array.from({ length: 4 }, (_, i) => <ShopCardSkeleton key={i} />)}
              </div>
            </Section>
            <Section title="Popular near you">
              <ItemGridSkeleton count={8} />
            </Section>
          </>
        ) : nothingNearby ? (
          <NearbyEmpty radiusKm={radiusKm} onExpand={() => setRadiusKm(30)} />
        ) : (
          <>
            {shops.length > 0 && (
              <Section title="Shops near you" seeAllHref="/search?tab=shops">
                <div className="ln-hscroll">
                  {shops.slice(0, 12).map((shop, i) => <ShopCard key={shop.uid} shop={shop} priority={i < 2} />)}
                </div>
              </Section>
            )}

            {errorMessage && source !== 'device' && (
              <p className="ln-note ln-note-warn ln-locate-note" role="status">
                <span>{status === 'denied' ? 'Location is off — showing listings near Kochi.' : errorMessage}</span>
                {status !== 'insecure' && status !== 'unsupported' && (
                  <button type="button" className="ln-text-btn" onClick={() => void locate()}>
                    <Crosshair size={14} aria-hidden="true" /> Use my location
                  </button>
                )}
              </p>
            )}

            {showEssentials && (
              <EssentialsSection
                items={market.nearbyItems}
                active={filters.sub}
                onSelect={sub => setFilters({ type: 'rent', category: sub ? 'event-sound' : filters.category, sub })}
              />
            )}

            <Section title={gridTitle(filters)}>
              <FilterBar
                filters={filters}
                onChange={setFilters}
                onReset={reset}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                resultCount={results.length}
              />
              <div style={{ height: 14 }} />
              {filteredOut ? (
                <NearbyEmpty
                  radiusKm={radiusKm}
                  filtered
                  onClearFilters={reset}
                  onExpand={() => setRadiusKm(30)}
                />
              ) : (
                <ItemGrid items={results} pageSize={12} />
              )}
            </Section>

            <EventBanner />

            {fresh.length >= 3 && filters.sort !== 'newest' && (
              <Section title="Fresh listings">
                <ItemRow items={fresh} />
              </Section>
            )}

            {recentlyViewed.length > 0 && (
              <Section title="Recently viewed">
                <ItemRow items={recentlyViewed} />
              </Section>
            )}
          </>
        )}

        <SiteFooter />
      </div>
    </div>
  );
}

function EssentialsSection(props: { items: NearbyItem[]; active: string | null; onSelect: (sub: string | null) => void }) {
  const hasAny = props.items.some(i => i.listingType === 'rent' && i.subcategory && getCategory('event-sound')?.subcategories.includes(i.subcategory));
  if (!hasAny) return null;
  return (
    <Section title="Event essentials" seeAllHref="/plan" seeAllLabel="Plan an event">
      <EventEssentials items={props.items} activeSub={props.active} onSelect={props.onSelect} />
    </Section>
  );
}

function HomeSkeleton() {
  return (
    <div className="ln-page">
      <div className="ln-shell">
        <div className="ln-search ln-skel" style={{ height: 52, borderRadius: 999 }} />
        <ItemGridSkeleton count={8} />
      </div>
    </div>
  );
}
