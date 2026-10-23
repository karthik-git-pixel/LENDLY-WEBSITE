'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUserLocation } from '@/lib/location-context';
import { reverseGeocode, searchAddress } from '@/lib/location';
import type { GeoPoint } from '@/lib/supabase-db';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="ln-skel" style={{ height: 200, borderRadius: 14 }} /> });

interface LocationPickerProps {
  /** The chosen point; null shows `fallback` until something is picked */
  value: GeoPoint | null;
  fallback: GeoPoint;
  onChange: (place: GeoPoint) => void;
  /** Extra shortcut buttons, e.g. "Use shop address" */
  extra?: React.ReactNode;
  height?: number;
}

/** The typed address is required wherever a pickup point is saved */
export const hasAddressDetails = (p?: GeoPoint | null) => Boolean(p?.details?.trim());

/** Drag-the-pin map with "use my location", an area search and a typed full address */
export default function LocationPicker({ value, fallback, onChange: setPoint, extra, height = 200 }: LocationPickerProps) {
  const { locate } = useUserLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPoint[]>([]);
  const [locating, setLocating] = useState(false);
  // Only the latest pin move may write its looked-up address
  const lookup = useRef(0);
  const where = value || fallback;
  // Moving the pin changes the map point, not the address the owner typed
  const onChange = (p: GeoPoint) => setPoint({ ...p, details: p.details ?? where.details });

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const fix = await locate({ switchToDevice: false });
      if (!fix) {
        toast.error('Couldn\'t get your location — search for the area instead');
        return;
      }
      const ticket = ++lookup.current;
      const address = await reverseGeocode(fix.lat, fix.lng);
      if (ticket === lookup.current) onChange({ lat: fix.lat, lng: fix.lng, address });
    } finally {
      setLocating(false);
    }
  };

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    const found = await searchAddress(query);
    setResults(found);
    if (found.length === 0) toast('No matching places — try a nearby landmark');
  };

  const movePin = async (c: { lat: number; lng: number }) => {
    const ticket = ++lookup.current;
    onChange({ lat: c.lat, lng: c.lng, address: where.address || '' });
    const address = await reverseGeocode(c.lat, c.lng);
    if (ticket === lookup.current) onChange({ lat: c.lat, lng: c.lng, address });
  };

  return (
    <>
      <p className="ln-note" style={{ marginTop: 0 }}>
        <MapPin size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> {where.address || 'Using your current area'} — drag the pin or tap the map to adjust.
      </p>
      <div className="sr-map">
        <MapView center={where} pin={where} onPinMove={c => void movePin(c)} height={height} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 size={15} className="ln-spin" aria-hidden="true" /> : <Crosshair size={15} aria-hidden="true" />} Use my location
        </button>
        {extra}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div className="ln-input-icon" style={{ flex: 1 }}>
          <Search size={16} aria-hidden="true" />
          <input
            className="ln-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search area or landmark"
            aria-label="Search area or landmark"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runSearch(); } }}
          />
        </div>
        <button type="button" className="ln-btn ln-btn-ghost" onClick={runSearch}>Find</button>
      </div>
      {results.length > 0 && (
        <ul className="ln-place-list">
          {results.map(r => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => { lookup.current++; onChange(r); setResults([]); setQuery(''); }}>
                <MapPin size={15} aria-hidden="true" /><span>{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="pd-field" style={{ marginTop: 14 }}>
        <span>Full address</span>
        <textarea
          className="ln-input"
          rows={2}
          maxLength={200}
          required
          value={where.details || ''}
          onChange={e => setPoint({ ...where, details: e.target.value })}
          placeholder="House / shop no., building, street, landmark"
        />
      </label>
    </>
  );
}
