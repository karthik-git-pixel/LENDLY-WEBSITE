import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Read the official Terms of Service and user agreement for Lendly hyperlocal marketplace.',
  alternates: {
    canonical: 'https://lendly.app/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="fade-in">
      <div className="top-header">
        <Link href="/home" className="btn-ghost" style={{ padding: 8, color: 'var(--foreground)' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Terms and Conditions</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container" style={{ maxWidth: 800 }}>
        <div className="glass-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'rgba(22, 163, 74, 0.15)', padding: 12, borderRadius: 14, color: 'var(--primary)' }}>
              <FileText size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                Terms of Service
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Last updated: August 2026</p>
            </div>
          </div>

          <div style={{ fontSize: 14, color: 'var(--foreground)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>1. Introduction</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Welcome to Lendly (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By accessing or using our hyperlocal marketplace platform and services, you agree to be bound by these Terms and Conditions. Lendly facilitates local buying, selling, and renting between verified users within defined distance radiuses.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>2. Account Registration & Safety</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Users must register an account with accurate phone, email, and location information. You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old or under adult supervision to list or transact on Lendly.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>3. Buying, Selling & Rental Transactions</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Sellers represent that they own or possess full rights to list products for sale or rental. Buyers agree to inspect items upon pickup or local delivery. Rentals are subject to agreed rental periods, and late returns may incur extra daily rental charges.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>4. Peer-to-Peer Payment Terms</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Transactions on Lendly operate via direct peer-to-peer payments. Payments made via UPI, Debit/Credit Cards, or direct handovers are confirmed directly between the buyer and seller upon mutual inspection and QR handover verification.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>5. Prohibited Items & Conduct</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Users may not list illegal goods, hazardous materials, weapons, counterfeit products, or fraudulent services. Lendly reserves the right to suspend accounts or report violations to law enforcement.
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>6. Contact & Disputes</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                For any disputes or inquiries regarding these Terms, please contact our support team at <a href="mailto:support@lendly.app" style={{ color: 'var(--primary)', fontWeight: 700 }}>support@lendly.app</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
