'use client';

import { useState, useEffect } from 'react';
import { Star, ShieldCheck, Quote, CheckCircle2, ThumbsUp, Lock, MessageSquarePlus, Check, X, Repeat2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Image from 'next/image';
import RadiusEngraving from './RadiusEngraving';

const REVIEWS_KEY = 'lendly_user_reviews';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  location: string;
  avatar: string;
  rating: number;
  badge: string;
  text: string;
  itemTraded?: string;
}

const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Rahul Verma',
    role: 'Product Designer',
    location: 'Bangalore (1.2 km away)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rahul&backgroundColor=3b82f6',
    rating: 5,
    badge: 'Verified Buyer',
    itemTraded: 'Bought Acoustic Guitar',
    text: 'Bought an acoustic guitar from a neighbor 1.2km away and completed the deal in 15 mins!',
  },
  {
    id: '2',
    name: 'Rohan Sharma',
    role: 'Photography Enthusiast',
    location: 'Kochi (1.5 km away)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rohan&backgroundColor=fca311',
    rating: 5,
    badge: 'Verified Rental',
    itemTraded: 'Rented Sony A7III Camera',
    text: 'Rented a Sony Alpha camera from a neighbor just 1.5km away for a weekend trip. Super smooth direct UPI payment and saved over ₹3,000 compared to commercial rentals!',
  },
  {
    id: '3',
    name: 'Ananya Nair',
    role: 'Software Developer',
    location: 'Kakkanad (2.8 km away)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ananya&backgroundColor=95e1d3',
    rating: 5,
    badge: 'Verified Purchase',
    itemTraded: 'Sold 4K Monitor',
    text: 'Sold my extra monitor locally in under 2 hours. The buyer walked over, scanned the QR code to confirm pickup, and funds were released instantly!',
  },
  {
    id: '4',
    name: 'Priya Sundaram',
    role: 'Marketing Lead',
    location: 'Chennai (0.8 km away)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Priya&backgroundColor=ec4899',
    rating: 5,
    badge: 'Verified User',
    itemTraded: 'Rented Gaming Console',
    text: 'Rented a Sony PlayStation for a weekend party. Best hyperlocal marketplace app for easy renting!',
  },
  {
    id: '5',
    name: 'Vipin Das',
    role: 'Engineering Student',
    location: 'Edappally (0.9 km away)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Vipin&backgroundColor=fce38a',
    rating: 5,
    badge: 'Verified Rental',
    itemTraded: 'Rented Textbooks',
    text: 'Lendly allowed me to rent reference textbooks directly from seniors nearby. The direct P2P handover gives total peace of mind for both sides.',
  },
  {
    id: '6',
    name: 'Meera Menon',
    role: 'Interior Designer',
    location: 'Fort Kochi (3.2 km away)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Meera&backgroundColor=eaffd0',
    rating: 5,
    badge: 'Verified Seller',
    itemTraded: 'Sold Dining Table',
    text: 'Setting a 30km radius filter makes trading so convenient! Met a lovely local neighbor and avoided high delivery fees altogether.',
  },
];

const TRUST_POINTS = [
  {
    icon: Lock,
    title: '100% Verified P2P Deals',
    body: 'Direct peer-to-peer payments & handovers',
    bg: 'rgba(249, 115, 22, 0.12)',
    fg: '#f97316',
  },
  {
    icon: CheckCircle2,
    title: 'Verified Local Profiles',
    body: 'Trade with real neighbors in your city',
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: '#10b981',
  },
  {
    icon: ThumbsUp,
    title: 'Simple and Secure',
    body: 'Safe and protected transactions',
    bg: 'rgba(59, 130, 246, 0.12)',
    fg: '#3b82f6',
  },
];

export default function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(INITIAL_TESTIMONIALS);
  const [showForm, setShowForm] = useState(false);

  // User review form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [roleLoc, setRoleLoc] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      // Fall back to the pre-rebrand key so existing reviews survive
      const saved = localStorage.getItem(REVIEWS_KEY) ?? localStorage.getItem('radiuscart_user_reviews');
      if (saved) {
        const parsed = JSON.parse(saved) as Testimonial[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTimeout(() => {
            setTestimonials(prev => {
              const seenIds = new Set(prev.map(t => t.id));
              const newItems = parsed.filter(t => !seenIds.has(t.id));
              return newItems.length > 0 ? [...newItems, ...prev] : prev;
            });
          }, 0);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Please enter your name');
    if (!text.trim()) return toast.error('Please enter your review message');

    setSubmitting(true);
    const newRev: Testimonial = {
      id: 'rev_' + Date.now(),
      name: name.trim(),
      role: roleLoc.trim() || 'Verified Local Member',
      location: 'Just now',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=fca311`,
      rating,
      badge: 'Community Review',
      text: text.trim(),
    };

    const updated = [newRev, ...testimonials];
    setTestimonials(updated);

    try {
      const userRevs = updated.filter(t => t.id.startsWith('rev_'));
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(userRevs));
    } catch {}

    toast.success('Thank you for reviewing Lendly! ⭐');
    setName('');
    setRoleLoc('');
    setText('');
    setRating(5);
    setShowForm(false);
    setSubmitting(false);
  };

  // Duplicate array for seamless infinite marquee loop
  const marqueeItems = [...testimonials, ...testimonials];

  return (
    <section style={{ marginTop: 40, marginBottom: 24 }}>
      {/* Header Banner */}
      <div className="rc-testimonial-banner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="rc-trust-chip">
                <ShieldCheck size={14} style={{ color: '#10b981' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '0.3px' }}>
                  TRUSTED HYPERLOCAL COMMUNITY
                </span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.6px' }}>
                Loved by <span className="rc-gradient-text">Local Neighbors</span>
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0 0' }}>
                Real experiences from buyers & sellers trading within their neighborhood radius
              </p>
            </div>

            {/* Right Column: Hero Illustration & Trust Highlights + Add Review Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* Hero Community Illustration Perfectly Aligned Above Rating */}
              <div style={{ position: 'relative', width: 150, height: 75, alignSelf: 'flex-end' }}>
                <Image
                  src="/hero-illustration.png"
                  alt="Community Illustration"
                  width={150}
                  height={75}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  priority
                />
              </div>

              {/* Trust Highlights & Add Review Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="rc-rating-card">
                  <div style={{ display: 'flex', color: '#f97316' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill="#fca311" color="#fca311" />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)' }}>
                    4.9 <span style={{ fontWeight: 500, color: 'var(--muted)' }}>({testimonials.length + 1200}+ reviews)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForm(!showForm)}
                  className="btn-primary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
                  }}
                >
                  {showForm ? <X size={16} /> : <MessageSquarePlus size={16} />}
                  {showForm ? 'Close Form' : 'Write a Review'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Review Inline Form */}
        {showForm && (
          <form onSubmit={handleSubmitReview} className="fade-in" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px dashed rgba(249, 115, 22, 0.3)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', marginBottom: 12 }}>
              Add Your Review & Rating
            </h3>

            {/* Interactive Star Rating Selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Your Rating *
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <Star
                    key={starVal}
                    size={24}
                    style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
                    fill={(hoverRating || rating) >= starVal ? '#f97316' : 'none'}
                    color={(hoverRating || rating) >= starVal ? '#f97316' : '#cbd5e1'}
                    onMouseEnter={() => setHoverRating(starVal)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(starVal)}
                  />
                ))}
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: '#f97316' }}>
                  {rating}.0 Stars
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Aldrin Joy"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ height: 42, borderRadius: 12, fontSize: 13 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Role / Location
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Local Buyer • Kochi"
                  value={roleLoc}
                  onChange={e => setRoleLoc(e.target.value)}
                  style={{ height: 42, borderRadius: 12, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Your Review *
              </label>
              <textarea
                className="input-field"
                placeholder="Share your experience buying, selling, or renting on Lendly..."
                value={text}
                onChange={e => setText(e.target.value)}
                rows={3}
                style={{ paddingTop: 10, borderRadius: 12, fontSize: 13 }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Check size={16} /> Submit My Review
            </button>
          </form>
        )}
      </div>

      {/* Continuous Left-to-Right Scrolling Marquee Row */}
      <div className="testimonials-marquee-wrap">
        <div className="testimonials-marquee-track">
          {marqueeItems.map((t, idx) => (
            <article key={`${t.id}-${idx}`} className="rc-testimonial">
              {/* Engraved Lendly watermark pressed into the card */}
              <RadiusEngraving />

              <div>
                {/* Stars + verification badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 2 }} aria-label={`${t.rating} out of 5 stars`}>
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} size={13} fill="#fca311" color="#fca311" />
                    ))}
                  </div>
                  <span className="rc-testimonial-badge">
                    <CheckCircle2 size={10} />
                    {t.badge}
                  </span>
                </div>

                {/* What they actually traded */}
                {t.itemTraded && (
                  <div className="rc-testimonial-trade">
                    <Repeat2 size={11} strokeWidth={2.6} />
                    {t.itemTraded}
                  </div>
                )}

                <p className="rc-testimonial-quote">
                  <Quote
                    size={14}
                    strokeWidth={2.4}
                    style={{ color: '#f97316', marginRight: 5, verticalAlign: '-2px' }}
                  />
                  {t.text}
                </p>
              </div>

              {/* Reviewer */}
              <div className="rc-testimonial-foot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="rc-testimonial-avatar"
                  src={t.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=fca311&color=fff`}
                  alt={t.name}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=fca311&color=fff`;
                  }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.role} • {t.location}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Trust Guarantee Cards */}
      <div className="rc-trust-grid">
        {TRUST_POINTS.map(({ icon: Icon, title, body, bg, fg }) => (
          <div
            key={title}
            className="rc-trust-card"
            style={{ '--trust-bg': bg, '--trust-fg': fg } as React.CSSProperties}
          >
            <RadiusEngraving />
            <div className="rc-trust-icon">
              <Icon size={19} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>{title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

