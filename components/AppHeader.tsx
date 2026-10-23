'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/AppImage';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown, Heart, LogOut, Map as MapIcon, MapPin, MessageCircle, Package, Plus,
  ScanLine, Store, User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useUserLocation } from '@/lib/location-context';
import Logo, { Wordmark } from './Logo';
import LocationSheet from './LocationSheet';
import NotificationPopover from './NotificationPopover';

export function avatarFor(name: string | undefined, url?: string | null): string {
  return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Lendly')}&background=0f172a&color=fff&bold=true`;
}

export default function AppHeader({ hideOnMobile = false }: { hideOnMobile?: boolean }) {
  const { user, profile, signOut } = useAuth();
  const { area, source, status } = useUserLocation();
  const pathname = usePathname();
  const router = useRouter();
  const [locationOpen, setLocationOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = Boolean(user && profile);
  const loginHref = `/login?redirect=${encodeURIComponent(pathname || '/home')}`;
  const areaLabel = status === 'locating' && source === 'default' ? 'Locating…' : area;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  return (
    <>
      <header className={`ln-header ${hideOnMobile ? 'desktop-only' : ''}`}>
        <div className="ln-header-inner">
          <Link href="/home" className="ln-brand" aria-label="Lendly home">
            <Logo size={34} />
            <span className="ln-brand-word"><Wordmark size={22} /></span>
          </Link>

          <button
            type="button"
            className="ln-loc"
            onClick={() => setLocationOpen(true)}
            aria-label={`Location: ${areaLabel}. Change location`}
          >
            <MapPin size={17} className="ln-loc-pin" aria-hidden="true" />
            <span className="ln-loc-text">{areaLabel}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>

          <div className="ln-header-actions">
            <Link href="/search?tab=shops" className="ln-icon-btn desktop-only" aria-label="Map view" title="Map view">
              <MapIcon size={20} />
            </Link>
            {isAuthenticated && (
              <Link href="/chat" className="ln-icon-btn" aria-label="Chats" title="Chats">
                <MessageCircle size={20} />
              </Link>
            )}
            {isAuthenticated && <NotificationPopover />}

            <Link
              href={isAuthenticated ? '/sell/new' : `/login?redirect=${encodeURIComponent('/sell/new')}`}
              className="ln-list-btn desktop-only"
            >
              <Plus size={17} strokeWidth={2.6} /> List
            </Link>

            {isAuthenticated ? (
              <div className="ln-menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="ln-avatar-btn"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <Image src={avatarFor(profile?.displayName, profile?.avatarUrl)} alt="" width={36} height={36} unoptimized />
                </button>
                {menuOpen && (
                  <div className="ln-menu" role="menu">
                    <div className="ln-menu-head">
                      <strong>{profile?.displayName || 'Your account'}</strong>
                      <span>{user?.email}</span>
                    </div>
                    <button role="menuitem" type="button" onClick={() => go('/profile')}><User size={16} /> Profile</button>
                    <button role="menuitem" type="button" onClick={() => go('/profile/orders')}><Package size={16} /> Orders &amp; bookings</button>
                    <button role="menuitem" type="button" onClick={() => go('/sell')}><Store size={16} /> Seller hub</button>
                    <button role="menuitem" type="button" onClick={() => go('/scan')}><ScanLine size={16} /> Scan handover QR</button>
                    <button role="menuitem" type="button" onClick={() => go('/profile/saved')}><Heart size={16} /> Saved items</button>
                    <button
                      role="menuitem"
                      type="button"
                      className="is-danger"
                      onClick={async () => { setMenuOpen(false); await signOut(); router.push('/home'); }}
                    >
                      <LogOut size={16} /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={loginHref} className="ln-login-btn">Log in</Link>
            )}
          </div>
        </div>
      </header>
      <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} />
    </>
  );
}
