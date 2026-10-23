'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getProduct, type Product } from '@/lib/supabase-db';
import ListingForm from '@/components/listing/ListingForm';

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useAuth();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getProduct(id).then(p => { if (!cancelled) setProduct(p); });
    return () => { cancelled = true; };
  }, [id]);

  const mine = product && profile && product.sellerId === profile.uid;

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Edit listing</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell lf-shell">
        {product === undefined ? (
          <div className="ln-skel" style={{ height: 300, borderRadius: 16 }} />
        ) : !mine ? (
          <div className="ln-empty"><h2>You can only edit your own listings</h2></div>
        ) : (
          <ListingForm kind={product.listingType === 'rent' ? 'rent' : 'sale'} initial={product} />
        )}
      </div>
    </div>
  );
}
