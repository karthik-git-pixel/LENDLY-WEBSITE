'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Loader2, Minus, Plus } from 'lucide-react';
import type { Coordinates } from '@/lib/location';
import { formatDistance } from '@/lib/location';
import type { Product, UserProfile } from '@/lib/supabase-db';
import { rentUnitInfo } from '@/lib/catalog';
import 'leaflet/dist/leaflet.css';

export type MapProduct = Product & { distance: number };
export type MapShop = UserProfile & { distance: number };

export interface UserMarker extends Coordinates {
  /** Metres; draws the "you're somewhere in here" ring */
  accuracy?: number;
  label?: string;
}

interface MapViewProps {
  center: Coordinates;
  user?: UserMarker | null;
  products?: MapProduct[];
  shops?: MapShop[];
  radiusKm?: number;
  height?: number | string;
  onProductClick?: (id: string) => void;
  onShopClick?: (id: string) => void;
  /** Shows the locate button; resolves with the new position */
  onLocate?: () => Promise<Coordinates | null>;
  locating?: boolean;
  /** Fly here whenever it changes */
  focus?: (Coordinates & { zoom?: number }) | null;
  selectedProductId?: string | null;
  /** A single highlighted spot (the listing on its own page) */
  pin?: Coordinates | null;
  /** Lets the pin be dragged (location picker) */
  onPinMove?: (c: Coordinates) => void;
  className?: string;
}

// OpenStreetMap's own tiles need no key (light use, with attribution). CARTO's
// free basemaps now answer every request with an "API key required" tile. For
// heavier traffic, point NEXT_PUBLIC_MAP_TILE_URL at a keyed tile provider.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const shortPrice = (p: number) =>
  p >= 100000 ? `₹${(p / 100000).toFixed(p % 100000 ? 1 : 0)}L` : p >= 1000 ? `₹${(p / 1000).toFixed(p % 1000 ? 1 : 0)}k` : `₹${Math.round(p)}`;

function zoomFor(radiusKm?: number): number {
  if (!radiusKm) return 14;
  if (radiusKm <= 1) return 15;
  if (radiusKm <= 2.5) return 14;
  if (radiusKm <= 6) return 13;
  if (radiusKm <= 12) return 12;
  return 11;
}

const userIcon = L.divIcon({
  className: 'lm-user',
  html: '<span class="lm-user-pulse"></span><span class="lm-user-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const pinIcon = L.divIcon({
  className: 'lm-pin',
  html: '<span class="lm-pin-head"></span>',
  iconSize: [30, 40],
  iconAnchor: [15, 38],
});

function productIcon(items: MapProduct[], selected: boolean): L.DivIcon {
  const first = items[0];
  const cheapest = items.reduce((min, p) => (p.price < min.price ? p : min), first);
  const rent = items.every(p => p.listingType === 'rent');
  const unit = rent ? `/${rentUnitInfo(cheapest.rentDuration).short}` : '';
  const img = first.images?.[0] ? `<img src="${esc(first.images[0])}" alt="" loading="lazy" />` : '';
  const count = items.length > 1 ? `<span class="lm-count">${items.length}</span>` : '';
  return L.divIcon({
    className: `lm-item ${rent ? 'is-rent' : 'is-sale'} ${selected ? 'is-selected' : ''}`,
    html: `<span class="lm-price">${items.length > 1 ? 'from ' : ''}${esc(shortPrice(cheapest.price))}${esc(unit)}</span><span class="lm-photo">${img}</span>${count}`,
    iconSize: [56, 64],
    iconAnchor: [28, 62],
    popupAnchor: [0, -58],
  });
}

function shopIcon(shop: MapShop): L.DivIcon {
  const name = shop.storeName || shop.displayName || 'Shop';
  const img = shop.avatarUrl
    ? `<img src="${esc(shop.avatarUrl)}" alt="" loading="lazy" />`
    : `<b>${esc(name.slice(0, 1).toUpperCase())}</b>`;
  return L.divIcon({
    className: 'lm-shop',
    html: `<span class="lm-shop-logo">${img}</span><span class="lm-shop-name">${esc(name)}</span>`,
    iconSize: [120, 54],
    iconAnchor: [60, 50],
    popupAnchor: [0, -46],
  });
}

/**
 * Moves the camera when `focus` changes, and when the map's `center` moves
 * (e.g. the device fix arrives after the first paint); leaves it alone otherwise.
 */
function Camera({ focus, center, initialZoom }: { focus?: (Coordinates & { zoom?: number }) | null; center: Coordinates; initialZoom: number }) {
  const map = useMap();
  const lat = focus?.lat;
  const lng = focus?.lng;
  const zoom = focus?.zoom;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), initialZoom), { duration: 0.8 });
  }, [lat, lng, zoom, map, initialZoom]);

  const cLat = center.lat;
  const cLng = center.lng;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.flyTo([cLat, cLng], map.getZoom(), { duration: 0.8 });
  }, [cLat, cLng, map]);

  // Tabs, sheets and responsive layouts resize the box after Leaflet measured it
  useEffect(() => {
    const el = map.getContainer();
    const fit = () => map.invalidateSize();
    const t = setTimeout(fit, 0);
    if (typeof ResizeObserver === 'undefined') return () => clearTimeout(t);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [map]);
  return null;
}

function Controls({ onLocate, locating }: { onLocate?: () => Promise<Coordinates | null>; locating?: boolean }) {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  const locate = async () => {
    if (!onLocate) return;
    setBusy(true);
    try {
      const at = await onLocate();
      if (at) map.flyTo([at.lat, at.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    } finally {
      setBusy(false);
    }
  };
  const spinning = busy || locating;
  return (
    <div className="lm-controls" onDoubleClick={e => e.stopPropagation()}>
      {onLocate && (
        <button type="button" className="lm-btn" onClick={locate} aria-label="Show my location" title="Show my location">
          {spinning ? <Loader2 size={18} className="ln-spin" /> : <Crosshair size={18} />}
        </button>
      )}
      <div className="lm-zoom">
        <button type="button" className="lm-btn" aria-label="Zoom in" onClick={() => map.zoomIn()}><Plus size={18} /></button>
        <button type="button" className="lm-btn" aria-label="Zoom out" onClick={() => map.zoomOut()}><Minus size={18} /></button>
      </div>
    </div>
  );
}

function DraggablePin({ position, onMove }: { position: Coordinates; onMove?: (c: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      onMove?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={pinIcon}
      draggable={Boolean(onMove)}
      eventHandlers={onMove ? {
        dragend: e => {
          const ll = (e.target as L.Marker).getLatLng();
          onMove({ lat: ll.lat, lng: ll.lng });
        },
      } : undefined}
      keyboard={false}
    />
  );
}

export default function MapView({
  center,
  user,
  products = [],
  shops = [],
  radiusKm,
  height = 520,
  onProductClick,
  onShopClick,
  onLocate,
  locating,
  focus,
  selectedProductId,
  pin,
  onPinMove,
  className,
}: MapViewProps) {
  const initialZoom = zoomFor(radiusKm);

  // Listings at the same spot share one marker
  const groups = useMemo(() => {
    const byKey = new Map<string, MapProduct[]>();
    for (const p of products) {
      if (!p.location || (!p.location.lat && !p.location.lng)) continue;
      const key = `${p.location.lat.toFixed(4)}_${p.location.lng.toFixed(4)}`;
      const list = byKey.get(key);
      if (list) list.push(p); else byKey.set(key, [p]);
    }
    return [...byKey.entries()].map(([key, items]) => ({ key, items, lat: items[0].location.lat, lng: items[0].location.lng }));
  }, [products]);

  // Icons are rebuilt only when their data changes, so markers don't flicker
  // (or drop an open popup) on every unrelated render
  const shopIcons = useMemo(() => new Map(shops.map(shop => [shop.uid, shopIcon(shop)])), [shops]);
  const groupIcons = useMemo(
    () => new Map(groups.map(g => [g.key, [productIcon(g.items, false), productIcon(g.items, true)] as const])),
    [groups]
  );

  return (
    <div className={`lm-map ${className || ''}`} style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        scrollWheelZoom
        attributionControl
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={19} />
        <Camera focus={focus} center={center} initialZoom={initialZoom} />
        <Controls onLocate={onLocate} locating={locating} />

        {radiusKm && (
          <Circle
            center={[user?.lat ?? center.lat, user?.lng ?? center.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#16a34a', weight: 1.5, dashArray: '6 6', fillColor: '#16a34a', fillOpacity: 0.05 }}
          />
        )}

        {user && (
          <>
            {user.accuracy && user.accuracy < 3000 && (
              <Circle
                center={[user.lat, user.lng]}
                radius={user.accuracy}
                pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12 }}
              />
            )}
            <Marker position={[user.lat, user.lng]} icon={userIcon} zIndexOffset={1000}>
              <Popup>
                <div className="lm-popup">
                  <strong>You are here</strong>
                  {user.label && <span>{user.label}</span>}
                  {user.accuracy ? <span>Accurate to about {Math.round(user.accuracy)} m</span> : null}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {pin && <DraggablePin position={pin} onMove={onPinMove} />}

        {shops.map(shop => {
          const where = shop.storeLocation;
          if (!where || (!where.lat && !where.lng)) return null;
          return (
            <Marker key={shop.uid} position={[where.lat, where.lng]} icon={shopIcons.get(shop.uid)!}>
              <Popup>
                <div className="lm-popup">
                  <strong>{shop.storeName || shop.displayName}</strong>
                  <span>{shop.storeCategory || 'Local shop'} · {formatDistance(shop.distance)}</span>
                  {onShopClick && <button type="button" className="lm-popup-btn" onClick={() => onShopClick(shop.uid)}>Visit shop</button>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {groups.map(group => {
          const selected = group.items.some(i => i.id === selectedProductId);
          return (
          <Marker
            key={group.key}
            position={[group.lat, group.lng]}
            icon={groupIcons.get(group.key)![selected ? 1 : 0]}
            zIndexOffset={selected ? 800 : 0}
          >
            <Popup>
              <div className="lm-popup lm-popup-list">
                {group.items.slice(0, 6).map(item => (
                  <button key={item.id} type="button" className="lm-popup-item" onClick={() => onProductClick?.(item.id)}>
                    {item.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.images[0]} alt="" />
                    )}
                    <span>
                      <strong>{item.title}</strong>
                      <em>
                        ₹{Math.round(item.price).toLocaleString('en-IN')}
                        {item.listingType === 'rent' ? `/${rentUnitInfo(item.rentDuration).short}` : ''}
                        {' · '}{formatDistance(item.distance)}
                      </em>
                    </span>
                  </button>
                ))}
                {group.items.length > 6 && <span>+{group.items.length - 6} more here</span>}
              </div>
            </Popup>
          </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
