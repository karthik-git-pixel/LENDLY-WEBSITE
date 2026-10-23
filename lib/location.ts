export interface Coordinates {
  lat: number;
  lng: number;
}

// Sensible default location fallback if geolocation is unavailable or denied (Kochi)
export const DEFAULT_LOCATION: Coordinates = { lat: 9.9312, lng: 76.2673 };
export const DEFAULT_AREA = 'Kochi';

export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unsupported';

export class GeoError extends Error {
  constructor(public kind: GeoErrorKind, message: string) {
    super(message);
  }
}

export interface DeviceFix extends Coordinates {
  accuracy: number;
  timestamp: number;
}

function toFix(pos: GeolocationPosition): DeviceFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

function toGeoError(err: GeolocationPositionError): GeoError {
  if (err.code === err.PERMISSION_DENIED) return new GeoError('denied', 'Location permission was denied');
  if (err.code === err.TIMEOUT) return new GeoError('timeout', 'Finding your location took too long');
  return new GeoError('unavailable', 'Your location is unavailable right now');
}

function readPosition(options: PositionOptions): Promise<DeviceFix> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(pos => resolve(toFix(pos)), err => reject(toGeoError(err)), options);
  });
}

/** Keeps listening for a sharper fix and reports each improvement, then stops */
function refinePosition(first: DeviceFix, onBetter: (fix: DeviceFix) => void, ms = 10000, goodEnoughM = 60) {
  let best = first.accuracy;
  const stop = () => {
    clearTimeout(timer);
    navigator.geolocation.clearWatch(id);
  };
  const id = navigator.geolocation.watchPosition(
    pos => {
      const fix = toFix(pos);
      if (fix.accuracy < best) {
        best = fix.accuracy;
        onBetter(fix);
      }
      if (best <= goodEnoughM) stop();
    },
    stop,
    { enableHighAccuracy: true, timeout: ms, maximumAge: 0 }
  );
  const timer = setTimeout(stop, ms);
}

/**
 * A fresh fix from the device. Returns the first usable fix quickly (a
 * Wi-Fi / cell fix is fine), then keeps sharpening it with GPS in the
 * background through `onRefine`.
 */
export async function locateDevice(onRefine?: (fix: DeviceFix) => void): Promise<DeviceFix> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    throw new GeoError('unsupported', 'This browser cannot share its location');
  }
  if (!window.isSecureContext) {
    throw new GeoError('insecure', 'Location only works over HTTPS (or on localhost)');
  }
  let fix: DeviceFix;
  try {
    fix = await readPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 1000 });
  } catch (err) {
    if (err instanceof GeoError && err.kind === 'denied') throw err;
    fix = await readPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  if (onRefine && fix.accuracy > 60) refinePosition(fix, onRefine);
  return fix;
}

/**
 * Best-effort current position that never rejects — device fix if
 * possible, otherwise the default city.
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  try {
    const fix = await locateDevice();
    return { lat: fix.lat, lng: fix.lng };
  } catch {
    return DEFAULT_LOCATION;
  }
}

export interface Place {
  /** Short neighbourhood name, e.g. "Kalamassery" */
  area: string;
  /** Longer human-readable address */
  address: string;
}

const placeCache = new Map<string, Place>();

/**
 * Reverse geocode lat/lng via OpenStreetMap Nominatim
 */
export async function reverseGeocodePlace(lat: number, lng: number): Promise<Place> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = placeCache.get(key);
  if (hit) return hit;
  const fallback = { area: 'Current location', address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const a = data?.address || {};
    const area = a.suburb || a.neighbourhood || a.quarter || a.village || a.town || a.city_district || a.city || a.county;
    const city = a.city || a.town || a.county || a.state_district;
    const place: Place = {
      area: area || fallback.area,
      address: [area, city && city !== area ? city : null].filter(Boolean).join(', ') ||
        (data?.display_name ? String(data.display_name).split(', ').slice(0, 3).join(', ') : fallback.address),
    };
    placeCache.set(key, place);
    return place;
  } catch {
    return fallback;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return (await reverseGeocodePlace(lat, lng)).address;
}

/**
 * Search address by text query
 */
export async function searchAddress(queryStr: string): Promise<{ lat: number; lng: number; address: string }[]> {
  if (!queryStr || queryStr.trim().length < 2) return [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&accept-language=en&q=${encodeURIComponent(queryStr.trim())}&limit=6`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name.split(', ').slice(0, 3).join(', '),
    }));
  } catch {
    return [];
  }
}

/**
 * Haversine distance between two points in km
 */
export function getDistanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(a.lat)) * Math.cos(deg2rad(b.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Filter items by distance from user, within maxKm radius
 * Promoted items bypass the distance filter and always sort to the top (#1 position)
 */
export function filterByDistance<T extends { location?: Coordinates; isPromoted?: boolean }>(
  items: T[],
  userLocation: Coordinates,
  maxKm: number = 5
): (T & { distance: number })[] {
  return withDistance(items, userLocation)
    // PROMOTED ITEMS ALWAYS BYPASS DISTANCE LIMIT
    .filter(item => Boolean(item.isPromoted) || item.distance <= maxKm)
    // PROMOTED ITEMS ALWAYS PINNED AT THE TOP FIRST
    .sort((a, b) => {
      if (a.isPromoted && !b.isPromoted) return -1;
      if (!a.isPromoted && b.isPromoted) return 1;
      return a.distance - b.distance;
    });
}

/** Adds a `distance` (km) to every item, without filtering */
export function withDistance<T extends { location?: Coordinates }>(items: T[], userLocation: Coordinates): (T & { distance: number })[] {
  return items.map(item => {
    const validLoc = item.location && typeof item.location.lat === 'number' && typeof item.location.lng === 'number' && (item.location.lat !== 0 || item.location.lng !== 0)
      ? item.location
      : userLocation;
    const dist = getDistanceKm(userLocation, validLoc);
    return { ...item, distance: isNaN(dist) ? 0 : dist };
  });
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** First segment of a stored address — "Edappally, Kochi" → "Edappally" */
export function areaName(address: string | null | undefined): string {
  return (address || '').split(',')[0].trim();
}

export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
