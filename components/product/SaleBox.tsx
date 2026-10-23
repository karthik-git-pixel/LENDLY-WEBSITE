'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { createOrder, type Product } from '@/lib/supabase-db';
import { payOnline } from '@/lib/checkout';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface SaleBoxProps {
  product: Product;
  onlineEnabled: boolean;
}

/** The purchase interface: reserve and pay at pickup, or pay online */
export default function SaleBox({ product, onlineEnabled }: SaleBoxProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { requireAuth } = useRequireAuth();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'pickup' | 'online' | null>(null);
  const saving = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const submit = async (online: boolean) => {
    if (!requireAuth(undefined, 'Log in to buy this')) return;
    setBusy(online ? 'online' : 'pickup');
    try {
      let orderId: string;
      if (online) {
        orderId = await payOnline({
          kind: 'order',
          payload: { productId: product.id, notes },
          description: product.title,
          prefill: { name: profile?.displayName, email: profile?.email, contact: profile?.phone },
        });
        toast.success('Paid — the seller has your order');
      } else {
        const order = await createOrder({ productId: product.id, notes });
        orderId = order.id;
        toast.success('Request sent to the seller');
      }
      router.push(`/qr/${orderId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not place the order';
      if (message !== 'Payment cancelled') toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="pd-box" id="book" aria-label="Buy this item">
      <div className="pd-price">
        <span className="pd-price-amount">{inr(product.price)}</span>
        {saving > 0 && (
          <>
            <s className="pd-price-was">{inr(product.originalPrice!)}</s>
            <span className="pd-price-save">{saving}% off</span>
          </>
        )}
      </div>
      <ul className="pd-terms">
        {product.condition && <li>Condition: <strong>{product.condition}</strong></li>}
        <li><ShieldCheck size={15} aria-hidden="true" /> Inspect it before you pay</li>
      </ul>

      <label className="pd-field">
        <span>Message for the seller <em>(optional)</em></span>
        <textarea
          className="ln-input"
          rows={2}
          maxLength={500}
          placeholder="When can you meet? Any questions about the item?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </label>

      <div className="pd-actions">
        <button type="button" className="ln-btn ln-btn-primary ln-btn-block" disabled={Boolean(busy)} onClick={() => submit(false)}>
          {busy === 'pickup' ? <Loader2 size={18} className="ln-spin" /> : null}
          Reserve · pay at pickup
        </button>
        {onlineEnabled && (
          <button type="button" className="ln-btn ln-btn-dark ln-btn-block" disabled={Boolean(busy)} onClick={() => submit(true)}>
            {busy === 'online' ? <Loader2 size={18} className="ln-spin" /> : null}
            Buy now · pay {inr(product.price)} online
          </button>
        )}
      </div>
      <p className="pd-fine">The seller confirms your request, then hands the item over after scanning your QR code.</p>
    </section>
  );
}
