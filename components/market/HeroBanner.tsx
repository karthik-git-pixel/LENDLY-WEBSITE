import Image from 'next/image';
import Link from 'next/link';
import { Clock } from 'lucide-react';

/** "Why buy when you can Lendly?" — Hero banner card with same-day rental badge */
export default function HeroBanner() {
  return (
    <section className="ln-hero" aria-labelledby="ln-hero-title">
      {/* Floating Badge (Top Right) */}
      <div className="ln-hero-badge">
        <div className="ln-hero-badge-icon">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div className="ln-hero-badge-text">
          <span className="ln-hero-badge-title">Same day rental</span>
          <span className="ln-hero-badge-sub">from nearby shops</span>
        </div>
      </div>

      {/* Copy & CTA */}
      <div className="ln-hero-copy">
        <h2 id="ln-hero-title">
          Why buy<br />
          when you can<br />
          <span>Lendly?</span>
        </h2>
        <p>
          Rent nearby. Spend wisely.<br />
          Waste less.
        </p>
        <Link href="/shops" className="ln-hero-cta">
          Browse Shops
        </Link>
      </div>

      {/* Hero Rental Art */}
      <div className="ln-hero-art">
        <div className="ln-hero-ground-shadow" aria-hidden="true" />
        <Image
          src="/images/hero-rentals.png"
          alt="Borrow cameras, camping gear, and goods on Lendly"
          fill
          sizes="(max-width: 640px) 55vw, (max-width: 1024px) 50vw, 560px"
          priority
        />
      </div>
    </section>
  );
}
