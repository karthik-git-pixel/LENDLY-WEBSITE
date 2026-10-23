'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { getOrder, updateOrder, getOrdersBySeller, type Order } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, QrCode, Camera, Keyboard, Package, Clock, ShoppingBag } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { serverTimestamp } from 'firebase/firestore';

function AnimatedCheckmark() {
  return (
    <div style={{ width: 96, height: 96, margin: '0 auto 16px', position: 'relative' }}>
      <svg viewBox="0 0 96 96" width="96" height="96">
        <circle
          cx="48" cy="48" r="44"
          fill="none"
          stroke="#10b981"
          strokeWidth="4"
          strokeDasharray="276.46"
          strokeDashoffset="276.46"
          style={{
            animation: 'circle-draw 0.6s ease-out forwards',
          }}
        />
        <path
          d="M28 50 L42 64 L68 34"
          fill="none"
          stroke="#10b981"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          strokeDashoffset="60"
          style={{
            animation: 'check-draw 0.4s 0.5s ease-out forwards',
          }}
        />
      </svg>
      <style>{`
        @keyframes circle-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes check-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

function RentalCountdownTimer({ order }: { order: Order }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [percentElapsed, setPercentElapsed] = useState(0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function getStartMs(): number {
      const raw = order.rentalStartedAt;
      if (!raw) return Date.now();
      if (typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof raw.toDate === 'function') {
        return raw.toDate().getTime();
      }
      if (raw instanceof Date) return raw.getTime();
      if (typeof raw === 'string') return new Date(raw).getTime();
      return Date.now();
    }

    const rentalDays = order.rentalDays || 1;
    const startMs = getStartMs();
    const totalDurationMs = rentalDays * 24 * 60 * 60 * 1000;
    const endMs = startMs + totalDurationMs;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = endMs - now;
      const elapsed = now - startMs;

      if (remaining <= 0) {
        setExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setPercentElapsed(100);
        clearInterval(interval);
        return;
      }

      const pct = Math.min(100, (elapsed / totalDurationMs) * 100);
      setPercentElapsed(pct);

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (percentElapsed / 100) * circumference;

  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      {/* Circular Progress Ring */}
      <div style={{ width: 140, height: 140, margin: '0 auto 20px', position: 'relative' }}>
        <svg viewBox="0 0 120 120" width="140" height="140">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-color)" strokeWidth="6" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={expired ? 'var(--danger)' : 'var(--primary)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Clock size={18} style={{ color: expired ? 'var(--danger)' : 'var(--primary)', marginBottom: 4 }} />
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: expired ? 'var(--danger)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px'
          }}>
            {expired ? 'Overdue' : 'Remaining'}
          </div>
        </div>
      </div>

      {/* Digital Clock Display */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {[
          { val: timeLeft.days, label: 'Days' },
          { val: timeLeft.hours, label: 'Hrs' },
          { val: timeLeft.minutes, label: 'Min' },
          { val: timeLeft.seconds, label: 'Sec' },
        ].map((t, i) => (
          <div key={i} style={{
            background: expired ? 'rgba(229,62,62,0.08)' : 'var(--surface-hover)',
            border: `1px solid ${expired ? 'rgba(229,62,62,0.3)' : 'var(--border-color)'}`,
            borderRadius: 14, padding: '10px 14px', minWidth: 60, textAlign: 'center'
          }}>
            <div style={{
              fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: expired ? 'var(--danger)' : 'var(--foreground)', lineHeight: 1
            }}>
              {pad(t.val)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase' }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {/* Status Text */}
      <div style={{
        fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: expired ? 'rgba(229,62,62,0.1)' : 'rgba(249,115,22,0.1)',
        color: expired ? 'var(--danger)' : 'var(--primary)'
      }}>
        {expired ? 'Rental period has ended — please return the item' : `Rental duration: ${order.rentalDays || 1} day(s)`}
      </div>
    </div>
  );
}

export default function ScanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<Order | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pendingOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    pendingOrdersRef.current = pendingOrders;
  }, [pendingOrders]);

  useEffect(() => {
    let cancelled = false;
    async function loadPending() {
      if (!user) return;
      try {
        const sellerOrders = await getOrdersBySeller(user.uid);
        if (!cancelled) setPendingOrders(sellerOrders.filter(o => o.status === 'pending'));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingPending(false);
      }
    }
    void loadPending();
    return () => { cancelled = true; };
  }, [user]);



  const handleVerify = async (codeToVerify?: string) => {
    if (!user) {
      toast.error('You must be logged in to verify orders');
      return;
    }
    
    const targetCode = codeToVerify || code;
    if (!targetCode.trim()) return toast.error('Enter or scan a valid QR code / order ID');

    setLoading(true);
    try {
      if (targetCode.startsWith('RCART-PAY-')) {
        const userId = targetCode.replace('RCART-PAY-', '').trim();
        toast.success('Payment QR Code detected! Redirecting to payment page...');
        if (scannerRef.current) {
          try { scannerRef.current.stop().catch(console.error); } catch {}
          setScannerActive(false);
        }
        router.push(`/pay/${userId}`);
        return;
      }

      let endpoint = '';
      if (targetCode.startsWith('pickup:')) endpoint = '/api/qr/verify-pickup';
      else if (targetCode.startsWith('return:')) endpoint = '/api/qr/verify-return';
      else if (targetCode.startsWith('RCART-')) endpoint = '/api/qr/verify-order';
      else {
        toast.error('Invalid QR code format. Please scan a valid order QR.');
        setLoading(false);
        return;
      }

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: targetCode })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setVerifiedOrder(data.order);
      if (data.message) toast.success(data.message);
      
      setCode('');
      if (scannerRef.current) {
        try { scannerRef.current.clear(); } catch {}
        setScannerActive(false);
      }

      // Automatically redirect after showing success message
      setTimeout(() => {
        router.push('/profile/orders');
      }, 4000);
    } catch (e) {
      console.error(e);
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startCameraScanner = () => {
    if (scannerActive) return;
    setScannerActive(true);
    setVerifiedOrder(null);
    setTimeout(() => {
      try {
        if (!document.getElementById('qr-reader')) return;
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setCode(decodedText);
            if (scannerRef.current) {
              scannerRef.current.stop().catch(console.error);
            }
            void handleVerify(decodedText);
          },
          (errorMessage) => {
            // ignore
          }
        ).catch((err) => {
          console.error(err);
          toast.error('Could not auto-start camera. Please check permissions.');
          setScannerActive(false);
        });
      } catch (err) {
        console.error(err);
      }
    }, 200);
  };

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch(err => console.error(err));
      } catch (e) {}
    }
    setScannerActive(false);
  };

  useEffect(() => {
    startCameraScanner();
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop().catch(() => {}); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fade-in">
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Scan Seller QR</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container" style={{ textAlign: 'center' }}>
        {/* Header Icon */}
        <div style={{ margin: '16px auto', color: 'var(--primary)', display: 'inline-block' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 24, background: 'rgba(249,115,22,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
          }}>
            <QrCode size={40} />
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Verify Exchange</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
          Scan the buyer&apos;s order QR code to confirm pickup or return of the product.
        </p>

        {/* Toggle Mode Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          {!scannerActive ? (
            <button onClick={startCameraScanner} className="btn-primary" style={{ padding: '12px 24px', borderRadius: 999 }}>
              <Camera size={18} /> Start Camera Scanner
            </button>
          ) : (
            <button onClick={stopCameraScanner} className="btn-secondary" style={{ padding: '12px 24px', borderRadius: 999 }}>
              <Keyboard size={18} /> Switch to Manual Entry
            </button>
          )}
        </div>

        {/* Interactive Camera Container */}
        {scannerActive && (
          <div className="glass-card slide-up" style={{ padding: 20, marginBottom: 24, overflow: 'hidden' }}>
            <div id="qr-reader" style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }} />
          </div>
        )}

        {/* Manual Code Input Card */}
        {!scannerActive && !verifiedOrder && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
            <label className="input-label" style={{ textAlign: 'left', marginBottom: 8 }}>
              Enter Order ID or QR Code Value:
            </label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input
                className="input-field"
                placeholder="Scan seller's QR code token..."
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                style={{ fontSize: 15, fontFamily: 'monospace' }}
              />
              <button
                onClick={() => handleVerify()}
                className="btn-primary"
                style={{ padding: '12px 22px', flexShrink: 0 }}
                disabled={loading}
              >
                {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Verify'}
              </button>
            </div>
          </div>
        )}

        {/* Verification Success Display */}
        {verifiedOrder && (
          <div className="glass-card slide-up" style={{
            padding: 28, marginBottom: 24,
            border: `2px solid ${verifiedOrder.type === 'rental' ? 'var(--primary)' : 'var(--success)'}`,
            background: verifiedOrder.type === 'rental' ? 'rgba(249,115,22,0.03)' : '#f0fdf4'
          }}>
            {/* Animated Green Checkmark */}
            <AnimatedCheckmark />

            <h3 style={{
              fontSize: 20, fontWeight: 800, margin: '0 0 4px',
              color: verifiedOrder.type === 'rental' ? 'var(--primary)' : 'var(--success)'
            }}>
              {verifiedOrder.type === 'rental' 
                ? (verifiedOrder.status === 'completed' ? 'Rental Returned Successfully!' : 'Rental Handoff Confirmed!') 
                : 'Purchase Exchange Confirmed!'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
              {verifiedOrder.type === 'rental'
                ? (verifiedOrder.status === 'completed' ? 'The item has been returned and the transaction is now complete.' : 'Rental timer has started. The item must be returned before the timer expires.')
                : 'The item ownership has been transferred. Thank you!'}
            </p>

            {/* Order Details Summary */}
            <div style={{
              background: 'white', padding: 16, borderRadius: 16, textAlign: 'left',
              border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Product</span>
                <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{verifiedOrder.productTitle}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Amount</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{verifiedOrder.amount.toLocaleString()}</span>
              </div>
              {verifiedOrder.lateFee !== undefined && verifiedOrder.lateFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, color: 'var(--danger)' }}>
                  <span style={{ fontWeight: 600 }}>Late Fee Charged</span>
                  <span style={{ fontWeight: 800 }}>+ ₹{verifiedOrder.lateFee.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Type</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  background: verifiedOrder.type === 'rental' ? 'rgba(249,115,22,0.15)' : 'rgba(16,185,129,0.15)',
                  color: verifiedOrder.type === 'rental' ? 'var(--primary)' : 'var(--success)'
                }}>
                  {verifiedOrder.type === 'rental' ? 'Rental' : 'Purchase'}
                </span>
              </div>
              {verifiedOrder.type === 'rental' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Duration</span>
                  <span style={{ fontWeight: 700 }}>{verifiedOrder.rentalDays || 1} day(s)</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10 }}>
                <span style={{ color: 'var(--muted)' }}>Order ID</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{verifiedOrder.id}</span>
              </div>
            </div>

            {/* Rental Countdown Timer (only for rentals, and not completed) */}
            {verifiedOrder.type === 'rental' && verifiedOrder.status !== 'completed' && (
              <div style={{
                background: 'white', borderRadius: 20, padding: 20,
                border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 800, color: 'var(--foreground)', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} /> Rental Countdown Timer
                </div>
                <RentalCountdownTimer order={verifiedOrder} />
              </div>
            )}

            {/* Purchase Complete: Back to Home */}
            {verifiedOrder.type !== 'rental' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                <ShoppingBag size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                  Ownership transferred successfully
                </span>
              </div>
            )}

            <button onClick={() => router.push('/home')} className="btn-primary" style={{ marginTop: 20, padding: '12px 32px', borderRadius: 999 }}>
              Back to Home
            </button>
          </div>
        )}

        {/* Removed pending orders list since this is for buyers now */}
      </div>
    </div>
  );
}
