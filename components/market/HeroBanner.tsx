import Image from 'next/image';
import Link from 'next/link';

/** "Why buy when you can Lendly?" — the home page's one hero card */
export default function HeroBanner() {
  return (
    <section className="ln-hero" aria-labelledby="ln-hero-title">
      <div className="ln-hero-copy">
        <h2 id="ln-hero-title">Why buy when you can <span>Lendly?</span></h2>
        <p>Rent nearby. Spend wisely. Waste less.</p>
        <Link href="/home?type=rent" className="ln-hero-cta">Explore rentals</Link>
      </div>
      <div className="ln-hero-art">
        <Image
          src="/images/lendly-bag.jpg"
          alt="Lendly paper shopping bag"
          fill
          sizes="(max-width: 640px) 45vw, 320px"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
