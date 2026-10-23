import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Shipping and Delivery Policy',
  description: 'Understand Lendly hyperlocal delivery methods, 10-45 minute neighborhood fulfillment, and QR verification.',
  alternates: {
    canonical: 'https://lendly.app/shipping',
  },
};

export default function ShippingPage() {
  return (
    <div className="fade-in">
      <div className="top-header">
        <Link href="/home" className="btn-ghost" style={{ padding: 8, color: 'var(--foreground)' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Shipping & Delivery Policy</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container" style={{ maxWidth: 800 }}>
        <div className="glass-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: 12, borderRadius: 14, color: '#3b82f6' }}>
              <Truck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                Hyperlocal Shipping & Delivery
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Last updated: August 2026</p>
            </div>
          </div>

          <div style={{ fontSize: 14, color: 'var(--foreground)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>1. Hyperlocal Delivery Model</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Lendly operates as a <strong>hyperlocal marketplace</strong>. Unlike traditional e-commerce platforms that rely on multi-day courier shipping, Lendly items are bought, sold, or rented from sellers located directly within your local city radius (from 1km up to 30km).
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>2. Delivery Methods & Timeframes</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Because transactions occur between local neighbors and verified nearby shops, fulfillment options include:
              </p>
              <ul style={{ color: 'var(--muted)', marginTop: 6, paddingLeft: 20 }}>
                <li><strong>Self-Pickup:</strong> Buyer meets the local seller at a mutually agreed neighborhood location (Instant to same-day).</li>
                <li><strong>Direct Seller Hand Delivery:</strong> The seller or local courier delivers the item directly to your address within 10 to 45 minutes of order confirmation.</li>
              </ul>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>3. QR Verification & Confirmation</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Upon delivery or pickup, the buyer presents a secure <strong>QR Verification Code</strong> provided in the app. Once the seller scans the code, delivery is officially confirmed and the peer-to-peer transaction is completed.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>4. Shipping Charges</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Most local pickups incur <strong>₹0 shipping fees</strong>. If local hand delivery is requested, any applicable local convenience fee (typically ₹10-₹50) is clearly displayed at checkout prior to payment.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>5. Delivery Inquiries</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                If you experience any delays or issues with local pickup or delivery, you can directly chat with the seller via the in-app Messaging tab or contact support at <a href="mailto:support@lendly.app" style={{ color: 'var(--primary)', fontWeight: 700 }}>support@lendly.app</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
