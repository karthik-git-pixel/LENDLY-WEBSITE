'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle2, Keyboard, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/lib/auth-context';
import { getOrdersBySeller, scanHandover, type HandoverAction, type Order } from '@/lib/supabase-db';
import { formatDateTime, formatRange } from '@/lib/time';

const RESULT_COPY: Record<HandoverAction, { title: string; body: string }> = {
  sale_completed: { title: 'Sale complete', body: 'Ownership handed over. Collect payment if it was pay-at-pickup.' },
  rental_started: { title: 'Rental started', body: 'Collect the rent and deposit now. Scan the same code again when it comes back.' },
  rental_returned: { title: 'Return confirmed', body: 'Check the item and return the deposit.' },
};

export default function ScanPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState<{ action: HandoverAction; lateFee: number; order: Order } | null>(null);
  const [handovers, setHandovers] = useState<Order[]>([]);
  const scanner = useRef<Html5Qrcode | null>(null);
  const handling = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/scan');
  }, [loading, user, router]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    getOrdersBySeller(profile.uid).then(list => {
      if (!cancelled) setHandovers(list.filter(o => o.status === 'accepted' || o.status === 'active' || o.status === 'pending'));
    });
    return () => { cancelled = true; };
  }, [profile, result]);

  const stopCamera = useCallback(async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s) await s.stop().catch(() => undefined);
    setCameraOn(false);
  }, []);

  const verify = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value || handling.current) return;
    handling.current = true;
    setBusy(true);
    try {
      const res = await scanHandover(value);
      setResult(res);
      setCode('');
      await stopCamera();
      toast.success(RESULT_COPY[res.action].title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not verify that code');
    } finally {
      setBusy(false);
      handling.current = false;
    }
  }, [stopCamera]);

  const startCamera = async () => {
    setResult(null);
    setCameraOn(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(r => setTimeout(r, 50));
      const s = new Html5Qrcode('qr-reader');
      scanner.current = s;
      await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 } }, text => { void verify(text); }, () => undefined);
    } catch {
      toast.error('Camera unavailable — type the code instead');
      setCameraOn(false);
    }
  };

  useEffect(() => () => { void stopCamera(); }, [stopCamera]);

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Scan handover QR</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell qr-wrap">
        <p className="ln-note">Ask the buyer to open their booking and show the QR code. Scan it to hand over — and scan it again when a rental comes back.</p>

        {result ? (
          <div className="qr-card is-done">
            <CheckCircle2 size={48} aria-hidden="true" />
            <h2>{RESULT_COPY[result.action].title}</h2>
            <p className="ln-note">{RESULT_COPY[result.action].body}</p>
            <p><strong>{result.order.productTitle}</strong> · ₹{Math.round(result.order.amount).toLocaleString('en-IN')}</p>
            {result.action === 'rental_started' && result.order.endAt && <p className="ln-note">Due back {formatDateTime(result.order.endAt)}</p>}
            {result.lateFee > 0 && <p className="ln-note ln-note-warn">Late by a few hours — late fee ₹{result.lateFee}</p>}
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => setResult(null)}>Scan another</button>
          </div>
        ) : (
          <>
            {cameraOn ? (
              <div className="qr-card">
                <div id="qr-reader" style={{ width: '100%', maxWidth: 360 }} />
                <button type="button" className="ln-btn ln-btn-ghost" onClick={() => void stopCamera()}><Keyboard size={16} aria-hidden="true" /> Type the code instead</button>
              </div>
            ) : (
              <button type="button" className="ln-btn ln-btn-primary ln-btn-block" onClick={startCamera} style={{ marginTop: 14 }}>
                <Camera size={18} aria-hidden="true" /> Open camera scanner
              </button>
            )}
            <form className="qr-manual" onSubmit={e => { e.preventDefault(); void verify(code); }}>
              <label className="ln-field-label" htmlFor="handover-code">Or enter the code</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="handover-code" className="ln-input" placeholder="LND-XXXXXXXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" />
                <button type="submit" className="ln-btn ln-btn-primary" disabled={busy || !code.trim()}>
                  {busy ? <Loader2 size={16} className="ln-spin" /> : 'Verify'}
                </button>
              </div>
            </form>
          </>
        )}

        {handovers.length > 0 && (
          <section className="ln-section">
            <h2 className="ln-section-title">Your upcoming handovers</h2>
            <ul className="od-list">
              {handovers.map(o => (
                <li key={o.id} className="od-card">
                  <strong>{o.productTitle}</strong>
                  <p className="od-line">
                    {o.buyer?.displayName || 'Buyer'} · {o.status === 'active' ? 'to be returned' : o.status === 'pending' ? 'awaiting your reply' : 'pickup'}
                    {o.startAt ? ` · ${formatRange(o.startAt, o.endAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <Link href="/profile/orders?role=seller" className="ln-text-btn">Manage all requests</Link>
          </section>
        )}
      </div>
    </div>
  );
}
