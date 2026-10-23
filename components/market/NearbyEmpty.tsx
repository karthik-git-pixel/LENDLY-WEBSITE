import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';

interface NearbyEmptyProps {
  radiusKm: number;
  onExpand?: () => void;
  /** Filters are hiding results that do exist nearby */
  filtered?: boolean;
  onClearFilters?: () => void;
}

export default function NearbyEmpty({ radiusKm, onExpand, filtered, onClearFilters }: NearbyEmptyProps) {
  if (filtered) {
    return (
      <div className="ln-empty">
        <MapPin size={28} aria-hidden="true" />
        <h2>No matches within {radiusKm} km</h2>
        <p>Try another category or loosen the filters.</p>
        <div className="ln-empty-actions">
          {onClearFilters && <button type="button" className="ln-btn ln-btn-primary" onClick={onClearFilters}>Clear filters</button>}
          {onExpand && radiusKm < 30 && <button type="button" className="ln-btn ln-btn-ghost" onClick={onExpand}>Expand to 30 km</button>}
        </div>
      </div>
    );
  }
  return (
    <div className="ln-empty">
      <MapPin size={28} aria-hidden="true" />
      <h2>Nothing within {radiusKm} km yet</h2>
      <p>Be the first to list something your neighbours need.</p>
      <div className="ln-empty-actions">
        {onExpand && radiusKm < 30 && (
          <button type="button" className="ln-btn ln-btn-primary" onClick={onExpand}>Expand to 30 km</button>
        )}
        <Link href="/sell/new" className={`ln-btn ${onExpand && radiusKm < 30 ? 'ln-btn-ghost' : 'ln-btn-primary'}`}>
          <Plus size={16} aria-hidden="true" /> List the first item
        </Link>
      </div>
    </div>
  );
}
