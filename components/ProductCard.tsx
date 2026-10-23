'use client';

import Image from '@/components/AppImage';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight, Flame, Heart, MapPin } from 'lucide-react';
import { formatDistance } from '@/lib/location';
import type { Product } from '@/lib/firestore';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=60';

interface ProductCardProps {
  product: Product & { distance: number };
  sellerName: string;
  isSaved?: boolean;
  /** 0-based position — the top three get a rank medal */
  rank?: number;
  onToggleSave?: (id: string) => void | Promise<void>;
}

export default function ProductCard({
  product,
  sellerName,
  isSaved = false,
  rank,
  onToggleSave,
}: ProductCardProps) {
  const router = useRouter();
  const [popping, setPopping] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const isRent = product.listingType === 'rent';
  const showRank = typeof rank === 'number' && rank < 3;

  const open = () => router.push(`/product/${product.id}`);

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onToggleSave) return;
    setPopping(true);
    window.setTimeout(() => setPopping(false), 450);
    try {
      await onToggleSave(product.id);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={product.title}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="rc-card rc-pcard"
    >
      {/* Full-bleed imagery with the listing facts floated over it */}
      <div className="rc-card-media rc-pcard-media">
        {!imgLoaded && (
          <span
            className="skeleton"
            style={{ position: 'absolute', inset: 0, borderRadius: 0, zIndex: 1 }}
            aria-hidden="true"
          />
        )}

        <Image
          src={product.images?.[0] || FALLBACK_IMAGE}
          alt={product.title}
          fill
          unoptimized
          onLoad={() => setImgLoaded(true)}
          className={`rc-img-fade ${imgLoaded ? 'is-loaded' : ''}`}
          // `fill` already positions the image absolutely — setting `position`
          // here is rejected by next/image, and zIndex works without it.
          style={{ objectFit: 'cover', zIndex: 2 }}
        />

        <span className={`rc-pcard-type ${isRent ? 'is-rent' : ''}`}>
          {isRent ? 'For rent' : 'For sale'}
        </span>

        {onToggleSave && (
          <button
            type="button"
            onClick={handleSave}
            aria-label={isSaved ? 'Remove from saved' : 'Save item'}
            aria-pressed={isSaved}
            className={`rc-heart rc-pcard-heart ${isSaved ? 'is-saved' : ''} ${popping ? 'rc-heart-pop' : ''}`}
          >
            <Heart
              size={15}
              fill={isSaved ? '#ef4444' : 'none'}
              color={isSaved ? '#ef4444' : '#0b2240'}
              strokeWidth={2.2}
            />
          </button>
        )}

        <div className="rc-pcard-overlay">
          <span className="rc-pcard-glass">
            <MapPin size={11} strokeWidth={2.6} />
            {formatDistance(product.distance)}
          </span>
          {showRank && (
            <span className="rc-pcard-glass rc-pcard-rank">
              <Flame size={11} strokeWidth={2.6} />#{(rank as number) + 1}
            </span>
          )}
        </div>
      </div>

      <div className="rc-pcard-body">
        <div className="rc-pcard-title">{product.title}</div>
        <div className="rc-pcard-seller">by {sellerName}</div>

        <div className="rc-pcard-foot">
          <div className="rc-price" style={{ fontSize: 15.5 }}>
            ₹{product.price.toLocaleString()}
            {isRent && <span className="rc-pcard-per">/day</span>}
          </div>
          <span className="rc-pcard-go" aria-hidden="true">
            <ArrowUpRight size={15} strokeWidth={2.6} />
          </span>
        </div>
      </div>
    </div>
  );
}
