'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, KeyRound, Tag } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import ListingForm from '@/components/listing/ListingForm';

export default function NewListingPage() {
  return (
    <Suspense fallback={null}>
      <NewListing />
    </Suspense>
  );
}

function NewListing() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile, loading } = useAuth();
  const type = params.get('type');
  const kind = type === 'rent' || type === 'sale' ? type : null;

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?redirect=${encodeURIComponent('/sell/new')}`);
  }, [loading, user, router]);

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => (kind ? router.replace('/sell/new') : router.back())}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>{kind === 'rent' ? 'Rent out an item' : kind === 'sale' ? 'Sell an item' : 'List on Lendly'}</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell lf-shell">
        {!kind ? (
          <div className="lf-choose">
            <p className="ln-note">What would you like to do?</p>
            <Link href="/sell/new?type=rent" className="lf-choice">
              <span className="lf-choice-icon"><KeyRound size={26} aria-hidden="true" /></span>
              <span><strong>Rent it out</strong><em>Earn again and again — halls, sound systems, cameras, vehicles, furniture…</em></span>
            </Link>
            <Link href="/sell/new?type=sale" className="lf-choice">
              <span className="lf-choice-icon"><Tag size={26} aria-hidden="true" /></span>
              <span><strong>Sell it</strong><em>One-time sale to a neighbour. They pay when they pick it up.</em></span>
            </Link>
          </div>
        ) : profile ? (
          <ListingForm key={kind} kind={kind} />
        ) : null}
      </div>
    </div>
  );
}
