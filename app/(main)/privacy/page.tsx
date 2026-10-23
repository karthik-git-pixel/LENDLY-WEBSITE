import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how Lendly protects your personal data, location privacy, and payment security.',
  alternates: {
    canonical: 'https://lendly.app/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="fade-in">
      <div className="top-header">
        <Link href="/home" className="btn-ghost" style={{ padding: 8, color: 'var(--foreground)' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Privacy Policy</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container" style={{ maxWidth: 800 }}>
        <div className="glass-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: 12, borderRadius: 14, color: '#10b981' }}>
              <Shield size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                Privacy Policy
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Last updated: August 2026</p>
            </div>
          </div>

          <div style={{ fontSize: 14, color: 'var(--foreground)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>1. Information We Collect</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Lendly collects personal information necessary to deliver hyperlocal marketplace services. This includes your name, email address, phone number, location coordinates (to calculate distance radiuses), profile photos, and transaction records.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>2. How We Use Your Information</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Your information is used strictly to:
              </p>
              <ul style={{ color: 'var(--muted)', marginTop: 6, paddingLeft: 20 }}>
                <li>Enable local item discovery within specified kilometer radiuses.</li>
                <li>Process secure payment transactions via Razorpay (UPI, Cards, Netbanking).</li>
                <li>Facilitate direct communication between buyers and sellers.</li>
                <li>Verify QR codes for safe local item pickup and rental delivery.</li>
              </ul>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>3. Data Security & Payment Safety</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                We use industry-standard encryption, SSL protocols, and secure Firebase infrastructure to protect your personal data. All payment details are securely processed directly by PCI-DSS compliant payment gateways (Razorpay). Lendly does not store sensitive credit card or UPI security credentials on its servers.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>4. Sharing of Information</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                We do not sell or rent your personal information to third parties. Public listing details (product title, general neighborhood location, seller name) are visible to local users to facilitate transactions.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>5. Your Rights & Data Rights</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                You have the right to request access to, correction of, or deletion of your personal data at any time by contacting our privacy officer at <a href="mailto:privacy@lendly.app" style={{ color: 'var(--primary)', fontWeight: 700 }}>privacy@lendly.app</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
