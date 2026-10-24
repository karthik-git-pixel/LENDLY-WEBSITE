'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import SellerQrScanner from '@/components/seller/SellerQrScanner';

export default function ScanPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/scan');
  }, [loading, user, router]);

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Customer QR Handover</h1>
        <Link href="/sell?tab=orders" className="ln-btn ln-btn-ghost ln-btn-sm">
          <LayoutDashboard size={15} aria-hidden="true" /> Hub
        </Link>
      </div>
      <div className="ln-shell qr-wrap" style={{ paddingTop: 16 }}>
        <p className="ln-note" style={{ marginBottom: 14 }}>
          Scan the customer’s booking QR code or type their 10-character code to inspect customer details, confirm pickup, or approve return.
        </p>

        <SellerQrScanner sellerId={profile?.uid} />

        <div style={{ marginTop: 20 }}>
          <Link href="/sell?tab=orders" className="ln-btn ln-btn-ghost ln-btn-block">
            Open Seller Dashboard & Manage Bookings →
          </Link>
        </div>
      </div>
    </div>
  );
}

