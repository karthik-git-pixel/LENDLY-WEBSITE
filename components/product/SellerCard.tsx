'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Bell, BellOff, MessageCircle, Star } from 'lucide-react';
import type { UserProfile } from '@/lib/supabase-db';
import { getOpenState } from '@/lib/store-hours';
import { avatarFor } from '@/components/AppHeader';

interface SellerCardProps {
  seller: UserProfile;
  following: boolean;
  onFollow: () => void;
  onChat: () => void;
  canInteract: boolean;
}

export default function SellerCard({ seller, following, onFollow, onChat, canInteract }: SellerCardProps) {
  const name = seller.storeName || seller.displayName || 'Lendly member';
  const open = getOpenState(seller.storeHours);
  const rated = (seller.reviewCount || 0) > 0;

  return (
    <section className="pd-card pd-seller" aria-label="Seller">
      <Link href={`/seller/${seller.uid}`} className="pd-seller-main">
        <Image src={avatarFor(name, seller.avatarUrl)} alt="" width={52} height={52} unoptimized className="pd-seller-avatar" />
        <span className="pd-seller-text">
          <strong>
            {name}
            {seller.kycStatus === 'VERIFIED' && <BadgeCheck size={16} className="ln-verified" aria-label="Verified seller" />}
          </strong>
          <span>
            {rated ? (
              <><Star size={12} fill="currentColor" aria-hidden="true" /> {Number(seller.rating).toFixed(1)} ({seller.reviewCount})</>
            ) : 'New on Lendly'}
            {seller.storeCategory ? ` · ${seller.storeCategory}` : ''}
          </span>
          {open && <em className={open.open ? 'is-open' : ''}>{open.label}</em>}
        </span>
      </Link>
      {canInteract && (
        <div className="pd-seller-actions">
          <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={onChat}>
            <MessageCircle size={16} aria-hidden="true" /> Chat
          </button>
          <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={onFollow} aria-pressed={following}>
            {following ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
            {following ? 'Following' : 'Follow'}
          </button>
        </div>
      )}
    </section>
  );
}
