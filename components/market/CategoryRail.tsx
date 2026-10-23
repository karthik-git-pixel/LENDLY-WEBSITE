'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { railItems } from '@/lib/catalog';
import type { MarketView } from '@/lib/market-filters';

// Soft tint + icon colour per category, like the app icons in the design
const TINTS: Record<string, [string, string]> = {
  all: ['#dcfce7', '#15803d'],
  'event-sound': ['#ede9fe', '#6d28d9'],
  electronics: ['#e0f2fe', '#0369a1'],
  vehicles: ['#fee2e2', '#b91c1c'],
  furniture: ['#ffedd5', '#c2410c'],
  properties: ['#dcfce7', '#15803d'],
  tools: ['#fef9c3', '#a16207'],
  fashion: ['#fce7f3', '#be185d'],
  books: ['#e0e7ff', '#4338ca'],
  sports: ['#cffafe', '#0e7490'],
  services: ['#f1f5f9', '#334155'],
  print: ['#e0f2fe', '#1d4ed8'],
};

const ORDER = ['all', 'event-sound', 'electronics', 'vehicles', 'furniture', 'properties', 'tools', 'fashion', 'books', 'sports', 'services', 'print'];

interface CategoryRailProps {
  view: MarketView;
  active: string;
  onSelect: (categoryId: string) => void;
}

/** Category tiles: 4-across grid on phones (with "More"), one row on desktop */
export default function CategoryRail({ view, active, onSelect }: CategoryRailProps) {
  const [expanded, setExpanded] = useState(false);
  const items = railItems(view).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  return (
    <nav className={`ln-catgrid ${expanded ? 'is-expanded' : ''}`} aria-label="Categories">
      {items.map(({ id, label, icon: Icon, href }, i) => {
        const [bg, fg] = TINTS[id] || TINTS.services;
        const style = { '--cat-bg': bg, '--cat-fg': fg } as React.CSSProperties;
        const extra = i >= 7 ? 'is-extra' : '';
        if (href) {
          return (
            <Link key={id} href={href} className={`ln-cat ${extra}`} style={style}>
              <span className="ln-cat-orb"><Icon size={26} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="ln-cat-label">{label}</span>
            </Link>
          );
        }
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`ln-cat ${extra}`}
            style={style}
            aria-pressed={selected}
            onClick={() => onSelect(selected && id !== 'all' ? 'all' : id)}
          >
            <span className="ln-cat-orb"><Icon size={26} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="ln-cat-label">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="ln-cat ln-cat-more"
        style={{ '--cat-bg': '#f1f5f9', '--cat-fg': '#334155' } as React.CSSProperties}
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
      >
        <span className="ln-cat-orb"><MoreHorizontal size={26} aria-hidden="true" /></span>
        <span className="ln-cat-label">{expanded ? 'Less' : 'More'}</span>
      </button>
    </nav>
  );
}
