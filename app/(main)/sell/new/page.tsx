'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getProduct, type Product } from '@/lib/supabase-db';
import { kycSubmitted, shopReady } from '@/lib/kyc';
import ListingForm from '@/components/listing/ListingForm';

// Lendly lists rentals only. This is the one place a visitor has to sign in:
// browsing, searching and the map all work without an account. Lenders
// verify their identity and set up their shop before the first listing.
export default function NewListingPage() {
  return (
    <Suspense fallback={null}>
      <NewListing />
    </Suspense>
  );
}

function NewListing() {
  const router = useRouter();
  const from = useSearchParams().get('from');
  const { user, profile, loading } = useAuth();
  const [template, setTemplate] = useState<Product | null | undefined>(from ? undefined : null);
  const ready = Boolean(profile && kycSubmitted(profile) && shopReady(profile));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?redirect=${encodeURIComponent('/sell/new')}`);
    else if (profile && !ready) router.replace('/sell/onboarding');
  }, [loading, user, profile, ready, router]);

  // "Duplicate" starts from one of your own listings
  useEffect(() => {
    if (!from || !profile) return;
    let cancelled = false;
    getProduct(from).then(p => { if (!cancelled) setTemplate(p && p.sellerId === profile.uid ? p : null); });
    return () => { cancelled = true; };
  }, [from, profile]);

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>{template ? 'Copy a rental' : 'Rent out an item'}</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell lf-shell">
        {!ready || template === undefined
          ? <div className="ln-skel" style={{ height: 240, borderRadius: 16, marginTop: 16 }} />
          : <ListingForm kind="rent" template={template ?? undefined} />}
      </div>
    </div>
  );
}
