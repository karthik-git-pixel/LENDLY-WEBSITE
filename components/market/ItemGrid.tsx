'use client';

import { useEffect, useRef, useState } from 'react';
import ItemCard, { ItemCardSkeleton } from './ItemCard';
import type { NearbyItem } from '@/lib/use-nearby';

interface ItemGridProps {
  items: NearbyItem[];
  pageSize?: number;
  /** How many leading cards to load eagerly */
  eager?: number;
}

/** Responsive grid that reveals more cards as you reach the end */
export default function ItemGrid({ items, pageSize = 12, eager = 4 }: ItemGridProps) {
  const [visible, setVisible] = useState(pageSize);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = visible < items.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setVisible(v => v + pageSize);
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, pageSize]);

  return (
    <>
      <div className="ln-grid">
        {items.slice(0, visible).map((item, i) => (
          <ItemCard key={item.id} item={item} priority={i < eager} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinel} className="ln-more">
          <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setVisible(v => v + pageSize)}>
            Load more
          </button>
        </div>
      )}
    </>
  );
}

export function ItemGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="ln-grid" aria-busy="true" aria-label="Loading listings">
      {Array.from({ length: count }, (_, i) => <ItemCardSkeleton key={i} />)}
    </div>
  );
}

/** Single-row horizontal scroller of item cards */
export function ItemRow({ items }: { items: NearbyItem[] }) {
  return (
    <div className="ln-hscroll ln-item-row">
      {items.map(item => (
        <div key={item.id} className="ln-row-cell"><ItemCard item={item} /></div>
      ))}
    </div>
  );
}
