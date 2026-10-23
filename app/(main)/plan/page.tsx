'use client';

import { useMemo, useState } from 'react';
import Image from '@/components/AppImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useNearbyMarket, type NearbyItem } from '@/lib/use-nearby';
import { createOrder } from '@/lib/supabase-db';
import { EVENT_NEEDS, EVENT_SUB_ICONS, rentUnitInfo } from '@/lib/catalog';
import { addUnits, combineDateTime, toDateInput } from '@/lib/booking';
import { formatDistance } from '@/lib/location';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Units of an item's pricing needed to cover the event */
function unitsFor(item: NearbyItem, hours: number): number {
  return Math.max(item.minUnits || 1, Math.ceil(hours / rentUnitInfo(item.rentDuration).hours));
}

export default function PlanEventPage() {
  const router = useRouter();
  const { requireAuth } = useRequireAuth();
  const market = useNearbyMarket();
  const [today] = useState(() => toDateInput(new Date(Date.now() + 86400000)));
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [hours, setHours] = useState(8);
  const [guests, setGuests] = useState(100);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const options = useMemo(() => {
    const rentals = market.nearbyItems.filter(i => i.listingType === 'rent');
    return EVENT_NEEDS.map(need => ({
      need,
      items: rentals
        .filter(i => need.subcategories.includes(i.subcategory || ''))
        .filter(i => need.id !== 'venue' || !i.capacity || i.capacity >= guests)
        .sort((a, b) => a.price * unitsFor(a, hours) - b.price * unitsFor(b, hours))
        .slice(0, 6),
    })).filter(o => o.items.length > 0);
  }, [market.nearbyItems, guests, hours]);

  const chosen = options.flatMap(o => o.items.filter(i => picked[o.need.id] === i.id));
  const total = chosen.reduce((sum, i) => sum + i.price * unitsFor(i, hours), 0);
  const deposits = chosen.reduce((sum, i) => sum + (i.securityDeposit || 0), 0);

  const requestAll = async () => {
    if (!requireAuth(undefined, 'Log in to send booking requests')) return;
    if (chosen.length === 0) return toast.error('Pick at least one item');
    setSending(true);
    const start = combineDateTime(date, time);
    let ok = 0;
    for (const item of chosen) {
      try {
        await createOrder({ productId: item.id, start, end: addUnits(start, item.rentDuration, unitsFor(item, hours)), notes: `Event for ${guests} guests (planned with Lendly)` });
        ok++;
      } catch (err) {
        toast.error(`${item.title}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    setSending(false);
    if (ok) {
      toast.success(`${ok} booking request${ok > 1 ? 's' : ''} sent`);
      router.push('/profile/orders');
    }
  };

  return (
    <div className="ln-page">
      <div className="ln-shell" style={{ paddingTop: 16 }}>
        <section className="ln-hero" style={{ gridTemplateColumns: '1fr', minHeight: 0 }}>
          <div className="ln-hero-copy" style={{ paddingRight: 20 }}>
            <h2><Sparkles size={22} aria-hidden="true" /> Plan your event</h2>
            <p>Pick a venue, sound and lights from shops near you — one quote, one tap to request them all.</p>
          </div>
        </section>

        <div className="pd-field-row" style={{ marginTop: 6 }}>
          <label className="pd-field"><span>Date</span><input type="date" className="ln-input" min={toDateInput(new Date())} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label>
          <label className="pd-field"><span>Starts at</span><input type="time" className="ln-input" value={time} onChange={e => setTime(e.target.value)} /></label>
          <label className="pd-field"><span>Hours</span><input type="number" className="ln-input" min={1} max={72} value={hours} onChange={e => setHours(Math.max(1, Number(e.target.value) || 1))} /></label>
          <label className="pd-field"><span>Guests</span><input type="number" className="ln-input" min={1} value={guests} onChange={e => setGuests(Math.max(1, Number(e.target.value) || 1))} /></label>
        </div>

        {market.loading ? (
          <div className="ln-skel" style={{ height: 200, borderRadius: 16, marginTop: 20 }} />
        ) : options.length === 0 ? (
          <div className="ln-empty"><h2>No event rentals nearby yet</h2><div className="ln-empty-actions"><Link href="/sell/new?type=rent" className="ln-btn ln-btn-primary">Rent out event gear</Link></div></div>
        ) : (
          options.map(({ need, items }) => {
            const Icon = EVENT_SUB_ICONS[need.subcategories[0]];
            return (
              <section key={need.id} className="ln-section">
                <div className="ln-section-head">
                  <h2 className="ln-section-title">{Icon && <Icon size={18} aria-hidden="true" style={{ verticalAlign: -3, marginRight: 6 }} />}{need.label}</h2>
                  <span style={{ fontSize: 12.5, color: 'var(--ln-sub)' }}>{need.hint}</span>
                </div>
                <div className="ln-hscroll">
                  {items.map(item => {
                    const on = picked[need.id] === item.id;
                    return (
                      <button key={item.id} type="button" className={`sp-item ${on ? 'is-picked' : ''}`} style={{ width: 210, textAlign: 'left', cursor: 'pointer', borderColor: on ? 'var(--primary)' : undefined, boxShadow: on ? '0 0 0 3px rgba(22,163,74,.18)' : undefined }}
                        aria-pressed={on} onClick={() => setPicked(prev => ({ ...prev, [need.id]: on ? '' : item.id }))}>
                        <span className="sp-item-img">
                          {item.images?.[0] && <Image src={item.images[0]} alt="" fill sizes="210px" />}
                          {on && <span className="ln-tag ln-tag-rent"><CheckCircle2 size={11} aria-hidden="true" /> ADDED</span>}
                        </span>
                        <span className="sp-item-body">
                          <h3>{item.title}</h3>
                          <span className="sp-item-price">{inr(item.price * unitsFor(item, hours))} <small>for your event</small></span>
                          <span style={{ fontSize: 12, color: 'var(--ln-sub)' }}>{item.seller?.storeName || 'Local shop'} · {formatDistance(item.distance)}{item.capacity ? ` · ${item.capacity} guests` : ''}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <div className="pd-box" style={{ marginTop: 24, position: 'sticky', bottom: 90 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 22 }}>{inr(total)}</strong>
              <div style={{ fontSize: 12.5, color: 'var(--ln-sub)' }}>{chosen.length} item{chosen.length === 1 ? '' : 's'}{deposits ? ` · ${inr(deposits)} refundable deposits` : ''} · pay at pickup</div>
            </div>
            <button type="button" className="ln-btn ln-btn-primary" disabled={sending || chosen.length === 0} onClick={requestAll}>
              {sending ? <Loader2 size={16} className="ln-spin" /> : null} Request all bookings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
