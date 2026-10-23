'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './auth-context';
import { updateUserProfile, hasPoint } from './supabase-db';
import {
  DEFAULT_AREA,
  DEFAULT_LOCATION,
  GeoError,
  locateDevice,
  reverseGeocodePlace,
  type Coordinates,
  type DeviceFix,
  type GeoErrorKind,
} from './location';

export type LocationSource = 'device' | 'manual' | 'profile' | 'default';
export type LocationStatus = 'idle' | 'locating' | 'ready' | GeoErrorKind;

export interface ManualPlace extends Coordinates {
  address: string;
}

interface LocationContextValue {
  /** Where distances are measured from */
  coords: Coordinates;
  source: LocationSource;
  /** Short area label for the header, e.g. "Kalamassery" */
  area: string;
  address: string;
  /** The latest device fix, if the browser shared one */
  device: DeviceFix | null;
  status: LocationStatus;
  /** Explains why the device location isn't being used */
  errorMessage: string | null;
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  /** Ask the device for a fresh fix and (by default) switch back to it */
  locate: (opts?: { switchToDevice?: boolean }) => Promise<DeviceFix | null>;
  /** Use a searched place instead of the device location */
  setManualPlace: (place: ManualPlace) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const FIX_KEY = 'lendly_last_fix';
const MANUAL_KEY = 'lendly_manual_place';
const RADIUS_KEY = 'lendly_radius_km';
export const DEFAULT_RADIUS_KM = 5;

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — fine, it's only a cache
  }
}

const ERROR_COPY: Record<GeoErrorKind, string> = {
  denied: 'Location is blocked for this site. Allow it in your browser settings to see what\'s nearest.',
  unavailable: 'Couldn\'t get a location fix. Check that location services are on.',
  timeout: 'Finding your location took too long. Try again.',
  insecure: 'Your browser only shares location over HTTPS. Open the app via https:// or localhost.',
  unsupported: 'This browser can\'t share its location.',
};

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [device, setDevice] = useState<DeviceFix | null>(null);
  const [devicePlace, setDevicePlace] = useState<{ area: string; address: string } | null>(null);
  const [manual, setManual] = useState<ManualPlace | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [radiusKm, setRadiusState] = useState(DEFAULT_RADIUS_KM);
  const savedToProfile = useRef(false);
  const inFlight = useRef<Promise<DeviceFix | null> | null>(null);

  const locate = useCallback(async ({ switchToDevice = true }: { switchToDevice?: boolean } = {}): Promise<DeviceFix | null> => {
    if (switchToDevice) {
      setManual(null);
      writeJSON(MANUAL_KEY, null);
    }
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setStatus('locating');
      try {
        const fix = await locateDevice();
        setDevice(fix);
        setStatus('ready');
        const place = await reverseGeocodePlace(fix.lat, fix.lng);
        setDevicePlace(place);
        writeJSON(FIX_KEY, { ...fix, ...place });
        return fix;
      } catch (err) {
        setStatus(err instanceof GeoError ? err.kind : 'unavailable');
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  // Restore cached state, then detect the device location straight away
  useEffect(() => {
    const storedRadius = Number(readJSON<number>(RADIUS_KEY));
    if (storedRadius > 0) setRadiusState(storedRadius);

    const storedManual = readJSON<ManualPlace>(MANUAL_KEY);
    const hasManual = Boolean(storedManual && hasPoint(storedManual));
    if (hasManual) setManual(storedManual);

    const cached = readJSON<DeviceFix & { area: string; address: string }>(FIX_KEY);
    if (cached && hasPoint(cached) && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      setDevice(cached);
      setDevicePlace({ area: cached.area, address: cached.address });
      setStatus('ready');
    }
    // A chosen place stays in charge; the device fix still shows on the map
    void locate({ switchToDevice: !hasManual });
  }, [locate]);

  // A member without a saved location gets their detected one
  useEffect(() => {
    if (!profile || !device || !devicePlace || savedToProfile.current) return;
    if (hasPoint(profile.location)) return;
    savedToProfile.current = true;
    void updateUserProfile(profile.uid, {
      location: { lat: device.lat, lng: device.lng, address: devicePlace.address },
    }).catch(() => { savedToProfile.current = false; });
  }, [profile, device, devicePlace]);

  const setManualPlace = useCallback((place: ManualPlace) => {
    setManual(place);
    writeJSON(MANUAL_KEY, place);
  }, []);

  const setRadiusKm = useCallback((km: number) => {
    setRadiusState(km);
    writeJSON(RADIUS_KEY, km);
  }, []);

  const value = useMemo<LocationContextValue>(() => {
    let coords: Coordinates = DEFAULT_LOCATION;
    let source: LocationSource = 'default';
    let area = DEFAULT_AREA;
    let address = DEFAULT_AREA;

    if (manual) {
      coords = { lat: manual.lat, lng: manual.lng };
      source = 'manual';
      area = manual.address.split(',')[0].trim() || manual.address;
      address = manual.address;
    } else if (device) {
      coords = { lat: device.lat, lng: device.lng };
      source = 'device';
      area = devicePlace?.area || 'Current location';
      address = devicePlace?.address || '';
    } else if (profile && hasPoint(profile.location)) {
      coords = { lat: profile.location.lat, lng: profile.location.lng };
      source = 'profile';
      area = profile.location.address.split(',')[0].trim() || 'Saved location';
      address = profile.location.address;
    }

    const errorMessage = status !== 'idle' && status !== 'locating' && status !== 'ready' && source !== 'manual'
      ? ERROR_COPY[status]
      : null;

    return {
      coords, source, area, address, device, status, errorMessage,
      radiusKm, setRadiusKm, locate, setManualPlace,
    };
  }, [manual, device, devicePlace, profile, status, radiusKm, setRadiusKm, locate, setManualPlace]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useUserLocation must be used inside <LocationProvider>');
  return ctx;
}
