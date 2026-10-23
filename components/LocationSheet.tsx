'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet from './ui/Sheet';
import { useAuth } from '@/lib/auth-context';
import { useUserLocation } from '@/lib/location-context';
import { searchAddress } from '@/lib/location';
import { updateUserProfile } from '@/lib/supabase-db';

const RADIUS_PRESETS = [1, 2, 5, 10, 20, 30];

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function LocationSheet({ open, onClose }: LocationSheetProps) {
  const { profile, refreshProfile } = useAuth();
  const { area, address, source, device, status, errorMessage, radiusKm, setRadiusKm, locate, setManualPlace } = useUserLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ lat: number; lng: number; address: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchable = query.trim().length >= 2;

  useEffect(() => {
    if (!searchable) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      setResults(await searchAddress(query));
      setSearching(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, searchable]);

  const saveToProfile = async (place: { lat: number; lng: number; address: string }) => {
    if (!profile) return;
    try {
      await updateUserProfile(profile.uid, { location: place });
      await refreshProfile();
    } catch {
      // the place still applies for this device
    }
  };

  const useDevice = async () => {
    const fix = await locate();
    if (fix) {
      toast.success('Showing what\'s around you');
      onClose();
    }
  };

  const choose = (place: { lat: number; lng: number; address: string }) => {
    setManualPlace(place);
    void saveToProfile(place);
    setQuery('');
    setResults([]);
    toast.success(`Showing listings near ${place.address.split(',')[0]}`);
    onClose();
  };

  const sourceLabel =
    source === 'device' ? `Live location${device ? ` · ±${Math.round(device.accuracy)} m` : ''}`
      : source === 'manual' ? 'Chosen place'
      : source === 'profile' ? 'Saved in your profile'
      : 'Default area';

  return (
    <Sheet open={open} onClose={onClose} title="Your location">
      <div className="ln-loc-current">
        <MapPin size={18} />
        <div>
          <strong>{area}</strong>
          <span>{address && address !== area ? `${address} · ` : ''}{sourceLabel}</span>
        </div>
      </div>

      <button type="button" className="ln-btn ln-btn-primary ln-btn-block" onClick={useDevice} disabled={status === 'locating'}>
        {status === 'locating' ? <Loader2 size={18} className="ln-spin" /> : <Crosshair size={18} />}
        {status === 'locating' ? 'Finding you…' : 'Use my current location'}
      </button>
      {errorMessage && <p className="ln-note ln-note-warn" role="status">{errorMessage}</p>}

      <label className="ln-field-label" htmlFor="ln-place-search">Or search an area</label>
      <div className="ln-input-icon">
        <Search size={17} aria-hidden="true" />
        <input
          id="ln-place-search"
          className="ln-input"
          placeholder="Kalamassery, Edappally, MG Road…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {searchable && searching && <p className="ln-note">Searching…</p>}
      {searchable && results.length > 0 && (
        <ul className="ln-place-list">
          {results.map(r => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => choose(r)}>
                <MapPin size={15} aria-hidden="true" />
                <span>{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ln-field-label" id="ln-radius-label">Search radius</div>
      <div className="ln-seg" role="radiogroup" aria-labelledby="ln-radius-label">
        {RADIUS_PRESETS.map(km => (
          <button
            key={km}
            type="button"
            role="radio"
            aria-checked={radiusKm === km}
            className="ln-seg-btn"
            onClick={() => setRadiusKm(km)}
          >
            {km} km
          </button>
        ))}
      </div>
    </Sheet>
  );
}
