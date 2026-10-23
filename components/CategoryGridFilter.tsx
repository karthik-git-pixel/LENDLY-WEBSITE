'use client';

import React, { useCallback, useState } from 'react';
import {
  Car,
  Building2,
  Smartphone,
  Monitor,
  MoreHorizontal,
  Bike,
  Shirt,
  Armchair,
  Dog,
  BookOpen,
  Wrench,
  Briefcase,
  Truck,
  LayoutGrid,
} from 'lucide-react';
import DrawIcon from './DrawIcon';

export interface CategoryData {
  id: string;
  name: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
}

interface CategoryGridFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

// Primary rail — the six shown before the drawer is opened
const MAIN_CATEGORIES: CategoryData[] = [
  { id: 'All', name: 'All', icon: <LayoutGrid size={24} strokeWidth={2.1} />, bg: '#e2e8f0', color: '#334155' },
  { id: 'Cars', name: 'Cars', icon: <Car size={24} strokeWidth={2.1} />, bg: '#e0f2fe', color: '#0284c7' },
  { id: 'Properties', name: 'Properties', icon: <Building2 size={24} strokeWidth={2.1} />, bg: '#dcfce7', color: '#16a34a' },
  { id: 'Mobiles', name: 'Mobiles', icon: <Smartphone size={24} strokeWidth={2.1} />, bg: '#f3e8ff', color: '#9333ea' },
  { id: 'Electronics', name: 'Electronics', icon: <Monitor size={24} strokeWidth={2.1} />, bg: '#ffedd5', color: '#ea580c' },
  { id: 'More', name: 'More', icon: <MoreHorizontal size={24} strokeWidth={2.1} />, bg: '#f1f5f9', color: '#64748b' },
];

// Revealed by the "More" toggle
const EXTENDED_CATEGORIES: CategoryData[] = [
  { id: 'Bikes', name: 'Bikes', icon: <Bike size={22} strokeWidth={2.1} />, bg: '#cffafe', color: '#0891b2' },
  { id: 'Fashion', name: 'Fashion', icon: <Shirt size={22} strokeWidth={2.1} />, bg: '#fef08a', color: '#ca8a04' },
  { id: 'Furniture', name: 'Furniture', icon: <Armchair size={22} strokeWidth={2.1} />, bg: '#fed7aa', color: '#c2410c' },
  { id: 'Commercial', name: 'Commercial', icon: <Truck size={22} strokeWidth={2.1} />, bg: '#fef3c7', color: '#d97706' },
  { id: 'Pets', name: 'Pets', icon: <Dog size={22} strokeWidth={2.1} />, bg: '#fce7f3', color: '#db2777' },
  { id: 'Books', name: 'Books', icon: <BookOpen size={22} strokeWidth={2.1} />, bg: '#e0e7ff', color: '#4f46e5' },
  { id: 'Services', name: 'Services', icon: <Wrench size={22} strokeWidth={2.1} />, bg: '#f3e8ff', color: '#7c3aed' },
  { id: 'Jobs', name: 'Jobs', icon: <Briefcase size={22} strokeWidth={2.1} />, bg: '#ffedd5', color: '#ea580c' },
];

export default function CategoryGridFilter({
  selectedCategory,
  onSelectCategory,
}: CategoryGridFilterProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Bumping a category's counter replays its draw animation
  const [replays, setReplays] = useState<Record<string, number>>({});
  const replay = useCallback((id: string) => {
    setReplays((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, []);

  const isActive = (catId: string) =>
    (catId === 'All' && (!selectedCategory || selectedCategory.toLowerCase() === 'all')) ||
    (catId !== 'More' && selectedCategory.toLowerCase() === catId.toLowerCase());

  const handleCategoryClick = (catId: string) => {
    replay(catId);
    if (catId === 'More') {
      setShowAllCategories((v) => !v);
      return;
    }
    onSelectCategory(catId);
  };

  const activeName =
    MAIN_CATEGORIES.concat(EXTENDED_CATEGORIES).find((c) => isActive(c.id))?.name ?? 'All';

  const renderTile = (cat: CategoryData, index: number, orbSize: 24 | 22) => {
    const selected = isActive(cat.id);
    const isMore = cat.id === 'More';

    return (
      <button
        key={cat.id}
        type="button"
        className="flex-1 shrink-0 min-w-[64px] flex flex-col items-center gap-[7px] p-0 border-none bg-transparent cursor-pointer rc-cat-tile"
        onClick={() => handleCategoryClick(cat.id)}
        onMouseEnter={() => replay(cat.id)}
        onFocus={() => replay(cat.id)}
        aria-pressed={isMore ? showAllCategories : selected}
        aria-expanded={isMore ? showAllCategories : undefined}
        aria-label={isMore ? 'Show more categories' : `Filter by ${cat.name}`}
        data-open={isMore && showAllCategories ? 'true' : undefined}
      >
        <span
          className="rc-cat-orb"
          style={
            {
              '--orb-bg': cat.bg,
              '--orb-fg': cat.color,
            } as React.CSSProperties
          }
        >
          <DrawIcon
            className="rc-draw"
            // Stagger the first pass so the rail draws itself left to right
            delay={index * 110}
            duration={orbSize === 24 ? 640 : 560}
            trigger={replays[cat.id] || 0}
          >
            {cat.icon}
          </DrawIcon>
        </span>

        <span className="rc-cat-label">{cat.name}</span>
        <span className="rc-cat-dot" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h2 className="m-0 text-sm font-extrabold text-[#0b2240] tracking-tight">Browse Categories</h2>
        <span className="text-[11.5px] font-semibold text-slate-500">
          Showing <strong style={{ color: '#ea580c' }}>{activeName}</strong>
        </span>
      </div>

      <div className="flex items-start gap-2.5 px-2 pt-5 pb-3 -mt-2 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]" style={{ scrollbarWidth: 'none' }} role="group" aria-label="Category filters">
        {MAIN_CATEGORIES.map((cat, i) => renderTile(cat, i, 24))}
      </div>

      {showAllCategories && (
        <div className="flex items-start gap-2.5 px-2 pt-5 pb-3 -mt-2 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]" style={{ scrollbarWidth: 'none' }} role="group" aria-label="More categories">
          {EXTENDED_CATEGORIES.map((cat, i) => renderTile(cat, i, 22))}
        </div>
      )}
    </div>
  );
}
