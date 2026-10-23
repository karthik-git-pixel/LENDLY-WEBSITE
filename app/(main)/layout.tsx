'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Home, Compass, Plus, MessageCircle, User } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import AnnouncementBar from '@/components/AnnouncementBar';
import AppSplashScreen from '@/components/AppSplashScreen';
import { useLanguage } from '@/lib/language-context';
import toast from 'react-hot-toast';

// Tabs that require authentication — guests clicking these get redirected to login
const AUTH_REQUIRED_TABS = ['/sell', '/chat', '/profile'];

// On phones the app header only shows on browse screens; other pages have their own back bar
const MOBILE_HEADER_ROUTES = ['/home', '/explore', '/search', '/shops', '/plan'];

// Pages with their own sticky action bar at the bottom
const NO_TAB_BAR_ROUTES = ['/product'];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = !!user && !!profile;

  const tabs = [
    { href: '/home', label: t('home'), icon: Home, match: ['/home', '/search', '/shops', '/plan'] },
    { href: '/explore', label: t('explore'), icon: Compass, match: ['/explore'] },
    { href: '/sell/new', label: 'List', icon: Plus, match: ['/sell'] },
    { href: '/chat', label: t('chat'), icon: MessageCircle, match: ['/chat'] },
    { href: '/profile', label: t('profile'), icon: User, match: ['/profile'] },
  ];

  // Only redirect to onboarding if user is logged in but hasn't completed profile
  useEffect(() => {
    if (!loading && user && !profile) {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  // Signed in but without a profile: hold on the splash while onboarding loads.
  // Everyone else gets the page shell straight away (guest view until auth settles).
  if (!loading && user && !profile) {
    return <AppSplashScreen message="Lendly" subMessage="Find what you need, right around you." />;
  }

  const handleTabClick = (e: React.MouseEvent, href: string) => {
    if (!isAuthenticated && AUTH_REQUIRED_TABS.some(tab => href.startsWith(tab))) {
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

  const showMobileHeader = MOBILE_HEADER_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  const showTabBar = !NO_TAB_BAR_ROUTES.some(r => pathname.startsWith(r + '/'));

  return (
    <div className="ln-has-header" style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <AppHeader hideOnMobile={!showMobileHeader} />
      <div className={showMobileHeader ? undefined : 'desktop-only'}>
        <AnnouncementBar />
      </div>

      {/* Main Content Area */}
      <main key={pathname} className="fade-in">{children}</main>

      {/* Mobile Floating Bottom Navigation Bar (Hidden on Desktop) */}
      {showTabBar && <nav className="bottom-nav mobile-only" aria-label="Primary">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const isActive = match.some(m => pathname === m || pathname.startsWith(m + '/'));
          const isList = href === '/sell/new';

          if (isList) {
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => handleTabClick(e, href)}
                aria-current={isActive ? 'page' : undefined}
                aria-label="List an item"
                className={`bottom-nav-item bottom-nav-sell ${isActive ? 'active' : ''}`}
              >
                <div className="bottom-nav-center-btn">
                  <Plus size={24} strokeWidth={2.8} />
                </div>
                <span className="bottom-nav-label">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={(e) => handleTabClick(e, href)}
              aria-current={isActive ? 'page' : undefined}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="bottom-nav-icon-wrap">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              </div>
              <span className="bottom-nav-label">{label}</span>
            </Link>
          );
        })}
      </nav>}
    </div>
  );
}
