'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Check, Lock, PackagePlus, ShieldCheck, Store } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getProductsBySeller } from '@/lib/supabase-db';
import { kycSubmitted, shopReady } from '@/lib/kyc';

/** Becoming a lender: verify your identity → set up your shop → add a rental */
export default function LenderOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [rentals, setRentals] = useState<number | null>(null);
  const uid = profile?.uid;

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/sell/onboarding');
  }, [loading, user, router]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getProductsBySeller(uid).then(list => { if (!cancelled) setRentals(list.filter(p => p.listingType === 'rent').length); });
    return () => { cancelled = true; };
  }, [uid]);

  if (!profile) {
    return <div className="ln-page"><div className="ln-shell lo-shell"><div className="ln-skel" style={{ height: 360, borderRadius: 20 }} /></div></div>;
  }

  const status = profile.kycStatus || 'NOT_STARTED';
  const needsFix = status === 'REJECTED' || status === 'ACTION_REQUIRED';
  const done = [kycSubmitted(profile), shopReady(profile), (rentals ?? 0) > 0];
  const current = done.indexOf(false);

  const steps = [
    {
      icon: ShieldCheck,
      title: 'Verify your identity',
      body: needsFix && profile.kycRejectionReason
        ? `Our team asked for a fix: “${profile.kycRejectionReason}”`
        : 'Your name, Aadhaar, photos of a government ID and a quick selfie. Encrypted and never shown to renters.',
      note: status === 'VERIFIED' ? { tone: 'good', text: 'Verified' }
        : status === 'PENDING_VERIFICATION' ? { tone: 'pending', text: 'Submitted · under review' }
        : needsFix ? { tone: 'bad', text: 'Needs attention' }
        : null,
      href: '/sell/verify',
      cta: needsFix ? 'Fix and resubmit' : done[0] ? 'View status' : 'Start verification',
    },
    {
      icon: Store,
      title: 'Set up your shop',
      body: 'Name, banner, logo, what you rent out, your pickup spot and opening hours.',
      note: null,
      href: '/sell/shop?onboarding=1',
      cta: done[1] ? 'Edit shop' : 'Set up shop',
    },
    {
      icon: PackagePlus,
      title: 'Add your first rental',
      body: 'Photos, a price per day or hour and a deposit. It goes live for renters nearby straight away.',
      note: rentals ? { tone: 'good', text: `${rentals} rental${rentals === 1 ? '' : 's'} live` } : null,
      href: '/sell/new',
      cta: done[2] ? 'Add another' : 'Add a rental',
    },
  ];

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Rent out on Lendly</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell lo-shell">
        <div className="lo-hero">
          <h2>{current === -1 ? 'Your shop is live' : 'Open your rental shop in 3 steps'}</h2>
          <p>{current === -1 ? 'Renters nearby can find and book your items.' : 'Earn from things you own — renters nearby book, pick up and return them.'}</p>
        </div>

        <ol className="lo-steps">
          {steps.map((s, i) => {
            const state = done[i] ? 'is-done' : i === current ? 'is-current' : 'is-locked';
            const locked = state === 'is-locked';
            return (
              <li key={s.title} className={`lo-step ${state}`}>
                <span className="lo-num" aria-hidden="true">{done[i] ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
                <div>
                  <h3><s.icon size={17} aria-hidden="true" /> {s.title}</h3>
                  <p>{s.body}</p>
                  {s.note && <span className={`od-status is-${s.note.tone}`}>{s.note.text}</span>}
                  {locked ? (
                    <span className="ln-btn ln-btn-ghost ln-btn-sm lo-cta" aria-disabled="true"><Lock size={14} aria-hidden="true" /> Finish step {current + 1} first</span>
                  ) : (
                    <Link href={s.href} className={`ln-btn ln-btn-sm lo-cta ${i === current ? 'ln-btn-primary' : 'ln-btn-ghost'}`}>{s.cta}</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {current === -1 ? (
          <Link href="/sell" className="ln-btn ln-btn-primary ln-btn-block" style={{ marginTop: 16 }}>Go to seller hub</Link>
        ) : (
          <p className="lo-trust">
            <BadgeCheck size={18} aria-hidden="true" />
            <span>Once our team approves your ID (usually within 24 hours), renters see a <strong>Verified</strong> badge on your shop.</span>
          </p>
        )}
      </div>
    </div>
  );
}
