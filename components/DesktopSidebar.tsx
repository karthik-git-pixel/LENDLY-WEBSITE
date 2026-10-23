'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Image from '@/components/AppImage';
import { 
  SlidersHorizontal, 
  MapPin, 
  Tag, 
  ShieldCheck, 
  LayoutGrid,
  ChevronRight,
  ArrowUpDown,
  Heart,
  Store,
  ShoppingBag,
  Laptop,
  BookOpen,
  Shirt,
  Armchair,
  Dumbbell,
  PenTool,
  Utensils,
  Wrench,
  Package,
  LogIn,
  type LucideIcon
} from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import Logo from './Logo';

interface CategoryItem {
  key: string;
  name: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const CATEGORIES: CategoryItem[] = [
  { key: 'all', name: 'All', icon: LayoutGrid, color: '#16a34a', bg: 'rgba(22, 163, 74, 0.14)' },
  { key: 'electronics', name: 'Electronics', icon: Laptop, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { key: 'books', name: 'Books', icon: BookOpen, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  { key: 'clothing', name: 'Clothing', icon: Shirt, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { key: 'furniture', name: 'Furniture', icon: Armchair, color: '#15803d', bg: 'rgba(21, 128, 61, 0.12)' },
  { key: 'sports', name: 'Sports', icon: Dumbbell, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { key: 'tools', name: 'Tools', icon: PenTool, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  { key: 'food', name: 'Food', icon: Utensils, color: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)' },
  { key: 'services', name: 'Services', icon: Wrench, color: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)' },
  { key: 'others', name: 'Other', icon: Package, color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' }
];

const PRESET_DISTANCES = [2, 5, 15, 30];

interface DesktopSidebarProps {
  selectedCategory?: string;
  onSelectCategory?: (cat: string) => void;
  radius?: number;
  onRadiusChange?: (r: number) => void;
  sortBy?: string;
  onSortByChange?: (sort: string) => void;
  listingType?: 'all' | 'sale' | 'rent';
  onListingTypeChange?: (type: 'all' | 'sale' | 'rent') => void;
  minPrice?: string;
  maxPrice?: string;
  onMinPriceChange?: (val: string) => void;
  onMaxPriceChange?: (val: string) => void;
}

export default function DesktopSidebar({
  selectedCategory = 'All',
  onSelectCategory,
  radius = 30,
  onRadiusChange,
  sortBy = 'distance_asc',
  onSortByChange,
  listingType = 'all',
  onListingTypeChange,
  minPrice = '',
  maxPrice = '',
  onMinPriceChange,
  onMaxPriceChange
}: DesktopSidebarProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [internalRadius, setInternalRadius] = useState(radius);

  const isAuthenticated = !!user && !!profile;
  const currentRadius = radius || internalRadius;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setInternalRadius(val);
    if (onRadiusChange) {
      onRadiusChange(val);
    }
  };

  const handlePresetClick = (r: number) => {
    setInternalRadius(r);
    if (onRadiusChange) {
      onRadiusChange(r);
    }
  };

  return (
    <aside className="desktop-sidebar-container desktop-only">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* ================= 1. LENDLY ID CARD ================= */}
        {isAuthenticated ? (
          <div className="lp-idcard">
            <div className="lp-idcard-top">
              <span className="lp-idcard-brand">
                <Logo size={24} variant="inverse" /> Lendly ID
              </span>
              <span className="lp-idcard-verified">
                <ShieldCheck size={12} strokeWidth={2.4} /> Verified
              </span>
            </div>

            <div className="lp-idcard-user">
              <div className="lp-idcard-avatar">
                <Image
                  src={profile?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'User')}&background=f97316&color=fff`}
                  alt=""
                  fill
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="lp-idcard-name">{profile?.displayName || 'Local Member'}</div>
                <div className="lp-idcard-role">
                  {profile?.isSeller ? (
                    <><Store size={12} strokeWidth={2.2} /> Verified Seller</>
                  ) : (
                    <><ShoppingBag size={12} strokeWidth={2.2} /> Verified Member</>
                  )}
                </div>
              </div>
            </div>

            <div className="lp-idcard-foot">
              <Link href="/profile/saved">
                <Heart size={13} fill="currentColor" strokeWidth={2} /> Saved Items
              </Link>
              <Link href="/profile">
                Profile <ChevronRight size={13} strokeWidth={2.8} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="lp-idcard">
            <div className="lp-idcard-top">
              <span className="lp-idcard-brand">
                <Logo size={24} variant="inverse" /> Guest pass
              </span>
            </div>
            <p className="lp-idcard-copy">
              Sign in to save listings, chat directly with local neighbours, and buy or rent nearby.
            </p>
            <Link href="/login" className="btn-primary lp-idcard-cta">
              <LogIn size={14} strokeWidth={2.4} /> Sign In
            </Link>
          </div>
        )}

        {/* ================= 2. SORT & REFINE CARD ================= */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
            borderRadius: 22,
            padding: '16px 16px 14px 16px',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            boxShadow: '0 4px 20px -2px rgba(11, 34, 64, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(22, 163, 74, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={14} style={{ color: '#15803d' }} strokeWidth={2.4} />
            </div>
            <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0b2240', margin: 0, letterSpacing: '-0.2px' }}>
              Sort & Refine
            </h3>
          </div>

          {/* Sort Listings Dropdown */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>
              Sort Listings By
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={sortBy}
                onChange={e => onSortByChange && onSortByChange(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 11,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '0 32px 0 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="distance_asc">Nearest First (Default)</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest Listings First</option>
              </select>
              <ArrowUpDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
            </div>
          </div>

          {/* Segmented Listing Type Toggle */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>
              Listing Type
            </label>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'sale', label: 'Buy' },
                { id: 'rent', label: 'Rent' },
              ].map(t => {
                const isActive = listingType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onListingTypeChange && onListingTypeChange(t.id as 'all' | 'sale' | 'rent')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: 9,
                      border: 'none',
                      background: isActive ? '#0b2240' : 'transparent',
                      color: isActive ? '#ffffff' : '#64748b',
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 6px rgba(11, 34, 64, 0.2)' : 'none'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>
              Price Range (₹)
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="number"
                  placeholder="Min ₹"
                  value={minPrice}
                  onChange={e => onMinPriceChange && onMinPriceChange(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '0 8px 0 20px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                />
                <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>₹</span>
              </div>

              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>to</span>

              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={maxPrice}
                  onChange={e => onMaxPriceChange && onMaxPriceChange(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '0 8px 0 20px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                />
                <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>₹</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. RADIUS DISTANCE CARD ================= */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
            borderRadius: 22,
            padding: '16px 16px 14px 16px',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            boxShadow: '0 4px 20px -2px rgba(11, 34, 64, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(22, 163, 74, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={14} style={{ color: '#15803d' }} strokeWidth={2.4} />
              </div>
              <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0b2240', margin: 0, letterSpacing: '-0.2px' }}>
                Radius Distance
              </h3>
            </div>

            {/* Distance Badge */}
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 900,
                color: '#166534',
                background: 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)',
                padding: '3px 9px',
                borderRadius: 999,
                border: '1px solid rgba(22, 163, 74, 0.35)',
                boxShadow: '0 1px 4px rgba(22, 163, 74, 0.15)'
              }}
            >
              {currentRadius} km
            </span>
          </div>

          {/* Custom Range Slider */}
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={currentRadius}
            onChange={handleSliderChange}
            style={{
              width: '100%',
              height: 6,
              accentColor: '#16a34a',
              cursor: 'pointer',
              marginBottom: 10
            }}
          />

          {/* Quick Preset Distance Chips */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'space-between' }}>
            {PRESET_DISTANCES.map(r => {
              const isSelected = currentRadius === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handlePresetClick(r)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: 8,
                    border: `1px solid ${isSelected ? '#16a34a' : '#e2e8f0'}`,
                    background: isSelected ? 'rgba(22, 163, 74, 0.12)' : '#f8fafc',
                    color: isSelected ? '#166534' : '#64748b',
                    fontSize: 11,
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {r} km
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= 4. CATEGORIES CARD ================= */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
            borderRadius: 22,
            padding: '16px 16px 14px 16px',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            boxShadow: '0 4px 20px -2px rgba(11, 34, 64, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(22, 163, 74, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={14} style={{ color: '#15803d' }} strokeWidth={2.4} />
            </div>
            <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0b2240', margin: 0, letterSpacing: '-0.2px' }}>
              Categories
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase() || (cat.name === 'All' && selectedCategory.toLowerCase() === 'all');
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => onSelectCategory && onSelectCategory(cat.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: isSelected ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'transparent',
                    color: isSelected ? '#ffffff' : '#334155',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: 12.5,
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(21, 128, 61, 0.28)' : 'none'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: isSelected ? 'rgba(255, 255, 255, 0.22)' : cat.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComponent
                        size={14}
                        style={{ color: isSelected ? '#ffffff' : cat.color }}
                        strokeWidth={2.2}
                      />
                    </span>
                    <span>{t(cat.key)}</span>
                  </span>

                  <ChevronRight
                    size={13}
                    style={{
                      opacity: isSelected ? 1 : 0.35,
                      color: isSelected ? '#ffffff' : '#64748b',
                      transform: isSelected ? 'translateX(1px)' : 'none'
                    }}
                    strokeWidth={2.6}
                  />
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </aside>
  );
}
