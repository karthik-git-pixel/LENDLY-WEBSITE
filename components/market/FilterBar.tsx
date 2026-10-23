'use client';

import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import {
  countActiveFilters,
  SORT_LABELS,
  type MarketFilters,
  type MarketSort,
  type MarketView,
} from '@/lib/market-filters';

const RADIUS_PRESETS = [1, 2, 5, 10, 20, 30];
const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Under ₹500', min: null, max: 500 },
  { label: '₹500 – 2,000', min: 500, max: 2000 },
  { label: '₹2,000 – 10,000', min: 2000, max: 10000 },
  { label: '₹10,000+', min: 10000, max: null },
];

interface FilterBarProps {
  filters: MarketFilters;
  onChange: (patch: Partial<MarketFilters>) => void;
  onReset: () => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  /** Hide the Rent/Buy chips where the page already fixes the type */
  showTypeChips?: boolean;
  resultCount?: number;
}

export default function FilterBar({
  filters, onChange, onReset, radiusKm, onRadiusChange, showTypeChips = true, resultCount,
}: FilterBarProps) {
  const [sheet, setSheet] = useState<'filters' | 'radius' | null>(null);
  const activeCount = countActiveFilters(filters);
  const under500 = filters.maxPrice === 500 && filters.minPrice === null;

  const chip = (label: string, pressed: boolean, onClick: () => void) => (
    <button key={label} type="button" className="ln-chip" aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );

  const setType = (type: MarketView) => onChange({ type: filters.type === type ? 'all' : type, category: 'all' });

  return (
    <>
      <div className="ln-chips" role="toolbar" aria-label="Filters">
        {chip('Nearest', filters.sort === 'nearest', () => onChange({ sort: filters.sort === 'nearest' ? 'popular' : 'nearest' }))}
        {showTypeChips && chip('Rent', filters.type === 'rent', () => setType('rent'))}
        {showTypeChips && chip('Buy', filters.type === 'sale', () => setType('sale'))}
        {chip('Under ₹500', under500, () => onChange(under500 ? { maxPrice: null } : { minPrice: null, maxPrice: 500 }))}
        {chip('Verified', filters.verified, () => onChange({ verified: !filters.verified }))}
        {chip('Available today', filters.availableToday, () => onChange({ availableToday: !filters.availableToday }))}
        <button type="button" className="ln-chip" aria-haspopup="dialog" onClick={() => setSheet('radius')}>
          Radius: {radiusKm} km <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button type="button" className="ln-chip" aria-haspopup="dialog" onClick={() => setSheet('filters')}>
          <SlidersHorizontal size={14} aria-hidden="true" /> Filters
          {activeCount > 0 && <span className="ln-chip-count">{activeCount}</span>}
        </button>
      </div>

      <Sheet open={sheet === 'radius'} onClose={() => setSheet(null)} title="Search radius">
        <RadiusControl value={radiusKm} onChange={onRadiusChange} />
        <button type="button" className="ln-btn ln-btn-primary ln-btn-block" style={{ marginTop: 18 }} onClick={() => setSheet(null)}>
          Done
        </button>
      </Sheet>

      <Sheet
        open={sheet === 'filters'}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <>
            <button type="button" className="ln-btn ln-btn-ghost" onClick={() => { onReset(); onRadiusChange(5); }}>
              Reset
            </button>
            <button type="button" className="ln-btn ln-btn-primary" style={{ flex: 1 }} onClick={() => setSheet(null)}>
              {typeof resultCount === 'number' ? `Show ${resultCount} result${resultCount === 1 ? '' : 's'}` : 'Show results'}
            </button>
          </>
        }
      >
        {showTypeChips && (
          <fieldset className="ln-fieldset">
            <legend className="ln-field-label">Listing type</legend>
            <div className="ln-seg" role="radiogroup">
              {([['all', 'All'], ['rent', 'Rent'], ['sale', 'Buy']] as [MarketView, string][]).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={filters.type === id} className="ln-seg-btn"
                  onClick={() => onChange({ type: id, category: 'all' })}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="ln-fieldset">
          <legend className="ln-field-label">Sort by</legend>
          <div className="ln-radio-list">
            {(Object.keys(SORT_LABELS) as MarketSort[]).map(sort => (
              <label key={sort} className="ln-radio">
                <input type="radio" name="ln-sort" checked={filters.sort === sort} onChange={() => onChange({ sort })} />
                <span>{SORT_LABELS[sort]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="ln-fieldset">
          <legend className="ln-field-label">Price</legend>
          <div className="ln-chip-wrap">
            {PRICE_PRESETS.map(p => {
              const on = filters.minPrice === p.min && filters.maxPrice === p.max;
              return (
                <button key={p.label} type="button" className="ln-chip" aria-pressed={on}
                  onClick={() => onChange(on ? { minPrice: null, maxPrice: null } : { minPrice: p.min, maxPrice: p.max })}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="ln-price-inputs">
            <label>
              <span>Min ₹</span>
              <input type="number" inputMode="numeric" min={0} className="ln-input" placeholder="0"
                value={filters.minPrice ?? ''}
                onChange={e => onChange({ minPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
            </label>
            <label>
              <span>Max ₹</span>
              <input type="number" inputMode="numeric" min={0} className="ln-input" placeholder="Any"
                value={filters.maxPrice ?? ''}
                onChange={e => onChange({ maxPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
            </label>
          </div>
        </fieldset>

        <fieldset className="ln-fieldset">
          <legend className="ln-field-label">Distance</legend>
          <RadiusControl value={radiusKm} onChange={onRadiusChange} />
        </fieldset>

        <fieldset className="ln-fieldset">
          <legend className="ln-field-label">More</legend>
          <label className="ln-check">
            <input type="checkbox" checked={filters.verified} onChange={e => onChange({ verified: e.target.checked })} />
            <span>Verified sellers only</span>
          </label>
          <label className="ln-check">
            <input type="checkbox" checked={filters.availableToday} onChange={e => onChange({ availableToday: e.target.checked })} />
            <span>Rentals free today</span>
          </label>
        </fieldset>
      </Sheet>
    </>
  );
}

function RadiusControl({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return (
    <div>
      <div className="ln-radius-row">
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          aria-label="Search radius in kilometres"
          className="ln-range"
        />
        <output className="ln-radius-value">{value} km</output>
      </div>
      <div className="ln-chip-wrap">
        {RADIUS_PRESETS.map(km => (
          <button key={km} type="button" className="ln-chip" aria-pressed={value === km} onClick={() => onChange(km)}>
            {km} km
          </button>
        ))}
      </div>
    </div>
  );
}
