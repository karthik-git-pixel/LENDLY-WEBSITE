'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { MapPin, Bell, Search, X, SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import LocationModal from './LocationModal';
import Logo, { Wordmark } from './Logo';
import NotificationPopover from './NotificationPopover';
import AnnouncementBar from './AnnouncementBar';

interface MobileHeaderProps {
  radius?: number;
  onRadiusChange?: (r: number) => void;
}

const RADIUS_OPTIONS = [2, 5, 10, 30];

export default function MobileHeader({ radius = 30, onRadiusChange }: MobileHeaderProps) {
  const { user, profile } = useAuth();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('search') || '';
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  // Keep the field in step with the URL (back/forward, or a link carrying
  // ?search=) by adjusting state during render rather than in an effect.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const isAuthenticated = !!user && !!profile;

  // Short area name, falling back to the brand's default region label
  const locationText = profile?.location?.address?.split(',')[0]?.trim() || 'MDR';

  // Lift the header off the page once it starts overlapping content
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (value: string) => {
    const trimmed = value.trim();
    const target = pathname === '/home' || pathname === '/explore' ? pathname : '/home';
    router.push(trimmed ? `${target}?search=${encodeURIComponent(trimmed)}` : target);
  };

  const avatarSrc =
    profile?.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'Guest')}&background=0b2240&color=fff`;

  return (
    <>
      <div
        className="mobile-only"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: scrolled ? 'rgba(255, 255, 255, 0.88)' : '#ffffff',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'rgba(226, 232, 240, 0.9)' : 'transparent'}`,
          boxShadow: scrolled ? '0 6px 20px -8px rgba(11, 34, 64, 0.16)' : 'none',
          transition: 'background 260ms ease, box-shadow 260ms ease, border-color 260ms ease',
        }}
      >
        {/* Row 1 — brand, location, actions */}
        <div
          style={{
            padding: '10px 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Link href="/home" aria-label="Lendly home" style={{ display: 'flex', textDecoration: 'none' }}>
              <Logo size={42} />
            </Link>

            <div style={{ minWidth: 0 }}>
              <Link href="/home" style={{ textDecoration: 'none', display: 'block' }}>
                <Wordmark size={24} />
              </Link>

              {/* Location + radius pill */}
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                title="Change location or radius"
                className="rc-tap"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginTop: 3,
                  padding: '2px 8px 2px 4px',
                  marginLeft: -4,
                  borderRadius: 999,
                  border: 'none',
                  background: 'transparent',
                  color: '#ea580c',
                }}
              >
                <MapPin size={13} style={{ color: '#f97316', flexShrink: 0 }} strokeWidth={2.4} />
                <span
                  style={{
                    maxWidth: 96,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {locationText}
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ color: '#f97316', fontWeight: 800 }}>{radius}km</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {isAuthenticated ? (
              <NotificationPopover buttonSize={40} iconSize={19} />
            ) : (
              <button
                onClick={() => router.push(`/login?redirect=${encodeURIComponent(pathname)}`)}
                aria-label="Notifications"
                className="rc-tap"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #f1f5f9',
                  boxShadow: 'var(--elev-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  color: '#0b2240',
                }}
              >
                <Bell size={19} strokeWidth={2} />
                <span
                  style={{
                    position: 'absolute',
                    top: 9,
                    right: 9,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#f97316',
                    border: '1.5px solid #ffffff',
                  }}
                />
              </button>
            )}

            <Link
              href={isAuthenticated ? '/profile' : `/login?redirect=${encodeURIComponent(pathname)}`}
              title={isAuthenticated ? profile?.displayName || 'My Profile' : 'Login'}
              className="rc-tap"
              style={{ display: 'flex', textDecoration: 'none' }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: '2px solid #f97316',
                  boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
                  display: 'block',
                  overflow: 'hidden',
                  background: '#f1f5f9',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarSrc}
                  alt={isAuthenticated ? profile?.displayName || 'Profile' : 'Guest'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </span>
            </Link>
          </div>
        </div>

        {/* Row 2 — search, the mobile entry point that was previously missing */}
        <div style={{ padding: '0 16px 10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(query);
              (document.activeElement as HTMLElement | null)?.blur();
            }}
            style={{ position: 'relative', flex: 1, minWidth: 0 }}
          >
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input-field lp-search"
              type="search"
              enterKeyHint="search"
              aria-label="Search listings nearby"
              placeholder="Search listings nearby..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                height: 42,
                paddingLeft: 42,
                paddingRight: query ? 38 : 14,
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 500,
              }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  submitSearch('');
                }}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            )}
          </form>

          {onRadiusChange && (
            <button
              type="button"
              aria-label="Change search radius"
              aria-expanded={showRadius}
              onClick={() => setShowRadius((v) => !v)}
              className="rc-tap"
              style={{
                width: 42,
                height: 42,
                flexShrink: 0,
                borderRadius: 14,
                border: `1px solid ${showRadius ? '#f97316' : 'var(--border-color)'}`,
                background: showRadius ? 'rgba(249, 115, 22, 0.12)' : 'var(--surface)',
                color: showRadius ? '#ea580c' : '#0b2240',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--elev-1)',
                transition: 'all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <SlidersHorizontal size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* Radius quick-picker */}
        {showRadius && onRadiusChange && (
          <div
            className="fade-in"
            style={{
              padding: '0 16px 12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflowX: 'auto',
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>
              Radius
            </span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onRadiusChange(r);
                  setShowRadius(false);
                }}
                className={`chip ${radius === r ? 'active' : ''}`}
                style={{ padding: '5px 13px', fontSize: 11.5 }}
              >
                {r} km
              </button>
            ))}
          </div>
        )}

        {/* Announcement News Ticker underneath Search Bar */}
        <AnnouncementBar />
      </div>

      <LocationModal isOpen={showLocationModal} onClose={() => setShowLocationModal(false)} />
    </>
  );
}
