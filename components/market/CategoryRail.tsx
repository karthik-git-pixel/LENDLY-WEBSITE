'use client';

import Link from 'next/link';
import { railItems } from '@/lib/catalog';
import type { MarketView } from '@/lib/market-filters';

interface CategoryRailProps {
  view: MarketView;
  active: string;
  onSelect: (categoryId: string) => void;
}

/** Scrollable row of round category buttons; Print & Xerox links out */
export default function CategoryRail({ view, active, onSelect }: CategoryRailProps) {
  return (
    <nav className="ln-rail" aria-label="Categories">
      {railItems(view).map(({ id, label, icon: Icon, href }) => {
        if (href) {
          return (
            <Link key={id} href={href} className="ln-cat">
              <span className="ln-cat-orb"><Icon size={24} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="ln-cat-label">{label}</span>
            </Link>
          );
        }
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            className="ln-cat"
            aria-pressed={selected}
            onClick={() => onSelect(selected && id !== 'all' ? 'all' : id)}
          >
            <span className="ln-cat-orb"><Icon size={24} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="ln-cat-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
