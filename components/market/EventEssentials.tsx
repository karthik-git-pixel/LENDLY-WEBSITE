'use client';

import { CATEGORIES, EVENT_SUB_ICONS, formatPrice } from '@/lib/catalog';
import type { NearbyItem } from '@/lib/use-nearby';

const EVENT_SUBS = CATEGORIES.find(c => c.id === 'event-sound')?.subcategories ?? [];

interface EventEssentialsProps {
  items: NearbyItem[];
  activeSub: string | null;
  onSelect: (sub: string | null) => void;
}

/** Venue, sound, lights… — only the kinds that are actually available nearby */
export default function EventEssentials({ items, activeSub, onSelect }: EventEssentialsProps) {
  const tiles = EVENT_SUBS.map(sub => {
    const matches = items.filter(i => i.listingType === 'rent' && i.subcategory === sub);
    const cheapest = matches.reduce<NearbyItem | null>((best, i) => (!best || i.price < best.price ? i : best), null);
    return { sub, count: matches.length, cheapest };
  }).filter(t => t.count > 0);

  if (tiles.length === 0) return null;

  return (
    <div className="ln-hscroll ln-essentials" role="group" aria-label="Event essentials">
      {tiles.map(({ sub, count, cheapest }) => {
        const Icon = EVENT_SUB_ICONS[sub];
        const selected = activeSub === sub;
        return (
          <button
            key={sub}
            type="button"
            className="ln-essential"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : sub)}
          >
            <span className="ln-essential-icon" aria-hidden="true">{Icon && <Icon size={20} />}</span>
            <span className="ln-essential-text">
              <strong>{sub}</strong>
              <span>
                {count} nearby{cheapest ? ` · from ${formatPrice(cheapest.price, 'rent', cheapest.rentDuration)}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
