import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cancellation and Refund Policy',
  description: 'Read about Lendly Direct P2P Guarantee, pre-pickup order cancellation, and direct payment refund policies.',
  alternates: {
    canonical: 'https://lendly.app/refunds',
  },
};

export default function RefundsPage() {
  return (
    <div className="fade-in">
      <div className="top-header">
        <Link href="/home" className="btn-ghost" style={{ padding: 8, color: 'var(--foreground)' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Cancellation and Refunds</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container" style={{ maxWidth: 800 }}>
        <div className="glass-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: 12, borderRadius: 14, color: '#ef4444' }}>
              <RefreshCw size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                Cancellation & Refund Policy
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Last updated: August 2026</p>
            </div>
          </div>

          <div style={{ fontSize: 14, color: 'var(--foreground)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>1. Order Cancellation Policy</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Buyers may cancel an order anytime <strong>prior to item pickup or QR code scanning</strong>. Once an order is cancelled before QR verification, the transaction is safely cancelled and refunded directly back to the original payment method (UPI / Card / Netbanking).
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>2. Peer-to-Peer Inspection Guarantee</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Lendly operates a <strong>Direct Peer-to-Peer Verification Guarantee</strong>. You inspect the item in person before confirming the pickup. If the item is defective, misrepresented, or unavailable upon meeting the seller:
              </p>
              <ul style={{ color: 'var(--muted)', marginTop: 6, paddingLeft: 20 }}>
                <li>Do not scan the QR code.</li>
                <li>Tap &quot;Cancel Order&quot; in your Order Details screen.</li>
                <li>A 100% full refund will be initiated to your original payment source.</li>
              </ul>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>3. Refund Processing Timeline</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Refunds processed via UPI are typically credited within 24-48 hours. Card and Netbanking refunds follow standard banking timelines (usually 5-7 business days).
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>4. Dispute Support</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                If you encounter any issues with a completed transaction or seller dispute, please reach out to our resolution team within 48 hours of order placement at <a href="mailto:support@lendly.app" style={{ color: 'var(--primary)', fontWeight: 700 }}>support@lendly.app</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
