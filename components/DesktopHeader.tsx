'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { 
  Home, 
  Compass, 
  PlusCircle, 
  MessageCircle, 
  User, 
  MapPin, 
  Bell, 
  Search, 
  LogOut, 
  Store,
  ChevronDown,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import LocationModal from './LocationModal';
import Logo, { Wordmark } from './Logo';
import NotificationPopover from './NotificationPopover';
import { useLanguage } from '@/lib/language-context';
import toast from 'react-hot-toast';

export default function DesktopHeader() {
  const { user, profile, signOut } = useAuth();
  const { language, t } = useLanguage();
  const pathname = usePathname();
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const isAuthenticated = !!user && !!profile;

  const navItems = [
    { href: '/home', label: t('home'), icon: Home, authRequired: false },
    { href: '/explore', label: t('explore'), icon: Compass, authRequired: false },
    { href: '/chat', label: t('chat'), icon: MessageCircle, authRequired: true },
  ];

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const trimmed = val.trim();
    if (pathname === '/home' || pathname === '/explore') {
      router.replace(`${pathname}${trimmed ? `?search=${encodeURIComponent(trimmed)}` : ''}`);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/home${searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : ''}`);
  };

  const handleAuthNavClick = (e: React.MouseEvent, href: string) => {
    if (!isAuthenticated) {
      e.preventDefault();
      toast('Please log in to continue', {
        icon: '🔒',
        style: {
          background: 'var(--surface)',
          color: 'var(--foreground)',
          border: '1px solid var(--border-color)',
        },
      });
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
    }
  };

  return (
    <>
    <header className="desktop-navbar desktop-only">
      <div className="desktop-navbar-inner">
        {/* Brand & Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/home" aria-label="Lendly home" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <Logo size={44} />
            <div>
              <Wordmark size={26} />
              <div className="lp-brand-tagline" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginTop: 3, whiteSpace: 'nowrap' }}>
                Find what you need, right around you.
              </div>
            </div>
          </Link>

          {/* Location Badge */}
          <div 
            onClick={() => {
              if (!isAuthenticated) {
                toast('Please log in to set your location', { icon: '🔒' });
                router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
                return;
              }
              setShowLocationModal(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999,
              background: 'var(--surface-hover)', border: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            title="Click to change location"
          >
            <MapPin size={15} style={{ color: 'var(--primary)' }} />
            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.location?.address?.split(',')[0] || 'Set Location'}
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, maxWidth: 420 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, color: 'var(--muted)' }} />
            <input
              type="text"
              className="input-field lp-search"
              placeholder="Search cameras, cycles, books nearby..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                paddingLeft: 42, paddingRight: 16, height: 42, borderRadius: 999, fontSize: 13
              }}
            />
          </div>
        </form>

        {/* Navigation Links & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <nav className="desktop-nav-links">
            {navItems.map(({ href, label, icon: Icon, authRequired }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={authRequired ? (e) => handleAuthNavClick(e, href) : undefined}
                  aria-label={label}
                  className={`desktop-nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* CTA: Sell Item */}
          <Link
            href="/sell"
            onClick={(e) => handleAuthNavClick(e, '/sell')}
            style={{ textDecoration: 'none' }}
          >
            <button className="btn-primary" style={{ borderRadius: 999, padding: '10px 20px', fontSize: 14 }}>
              <PlusCircle size={18} />
              <span>{t('sell')}</span>
            </button>
          </Link>

          {/* Notifications — only show for authenticated users */}
          {isAuthenticated && (
            <NotificationPopover buttonSize={42} iconSize={19} />
          )}

          {/* User Menu or Login/Signup Buttons */}
          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)',
                  border: '1px solid var(--border-color)', padding: '4px 10px 4px 4px', borderRadius: 999,
                  cursor: 'pointer', outline: 'none'
                }}
              >
                <img
                  src={profile?.avatarUrl || (profile?.displayName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=0b2240&color=fff` : `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid || 'user'}`)}
                  alt={profile?.displayName || 'User'}
                  style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                  {profile?.displayName?.split(' ')[0] || 'Account'}
                </span>
                <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
              </button>

              {showProfileMenu && (
                <div 
                  className="fade-in"
                  style={{
                    position: 'absolute', right: 0, top: '120%', width: 220, background: 'var(--surface)',
                    border: '1px solid var(--border-color)', borderRadius: 20, boxShadow: 'var(--shadow-lg)',
                    padding: 8, zIndex: 1000
                  }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{profile?.displayName || 'User'}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0 0' }}>{user?.email}</p>
                  </div>
                  <div style={{ padding: '6px 0' }}>
                    <Link
                      href="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
                        fontSize: 13, fontWeight: 600, color: 'var(--foreground)', textDecoration: 'none'
                      }}
                    >
                      <User size={16} /> My Profile
                    </Link>
                    <Link
                      href="/seller/dashboard"
                      onClick={() => setShowProfileMenu(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
                        fontSize: 13, fontWeight: 600, color: 'var(--foreground)', textDecoration: 'none'
                      }}
                    >
                      <Store size={16} /> Seller Dashboard
                    </Link>
                    <button
                      onClick={() => { setShowProfileMenu(false); signOut(); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--danger)',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
                      }}
                    >
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Guest: Login / Sign Up Buttons */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ textDecoration: 'none' }}>
                <button
                  className="btn-ghost"
                  style={{
                    padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                    border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 6,
                    color: 'var(--foreground)', background: 'var(--surface)'
                  }}
                >
                  <LogIn size={16} />
                  Login
                </button>
              </Link>
              <Link href={`/register?redirect=${encodeURIComponent(pathname)}`} style={{ textDecoration: 'none' }}>
                <button
                  className="btn-primary"
                  style={{
                    padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <UserPlus size={16} />
                  Sign Up
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
    <LocationModal isOpen={showLocationModal} onClose={() => setShowLocationModal(false)} />
    </>
  );
}

