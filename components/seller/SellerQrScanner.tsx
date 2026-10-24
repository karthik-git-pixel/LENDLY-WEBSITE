'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from '@/components/AppImage';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Keyboard,
  Loader2,
  MessageCircle,
  QrCode,
  ScanLine,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Html5Qrcode } from 'html5-qrcode';
import { openChat } from '@/lib/chat';
import {
  scanHandover,
  type HandoverAction,
  type Order,
} from '@/lib/supabase-db';
import { formatDateTime, formatRange } from '@/lib/time';
import { paymentLabel, rentBreakdown } from '@/lib/orders';
import Sheet from '@/components/ui/Sheet';

interface SellerQrScannerProps {
  onSuccess?: (order: Order) => void;
  sellerId?: string;
}

const ACTION_COPY: Record<HandoverAction, { title: string; subtitle: string; tone: string }> = {
  rental_started: {
    title: 'Rental Started & Handed Over',
    subtitle: 'Pickup verified. Collect payment/deposit if paying at pickup. Customer booking page is now active.',
    tone: 'active',
  },
  rental_returned: {
    title: 'Rental Return Approved',
    subtitle: 'Item return verified and accepted. Return the customer’s refundable deposit.',
    tone: 'good',
  },
  sale_completed: {
    title: 'Sale Handover Completed',
    subtitle: 'Ownership transferred. Order is successfully completed.',
    tone: 'good',
  },
};

export default function SellerQrScanner({ onSuccess, sellerId }: SellerQrScannerProps) {
  const router = useRouter();
  const [openScanModal, setOpenScanModal] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [result, setResult] = useState<{ action: HandoverAction; lateFee: number; order: Order } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      await s.stop().catch(() => undefined);
    }
    setCameraActive(false);
  }, []);

  const handleVerify = useCallback(
    async (rawCode: string) => {
      let cleanCode = rawCode.trim();
      // If full URL was scanned, extract order/code
      if (cleanCode.includes('/qr/')) {
        const parts = cleanCode.split('/qr/');
        cleanCode = parts[parts.length - 1];
      }
      if (!cleanCode || handlingRef.current) return;

      handlingRef.current = true;
      setBusy(true);

      try {
        const res = await scanHandover(cleanCode);
        setResult(res);
        setCode('');
        await stopCamera();
        toast.success(ACTION_COPY[res.action].title);
        if (onSuccess) onSuccess(res.order);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not verify code');
      } finally {
        setBusy(false);
        handlingRef.current = false;
      }
    },
    [onSuccess, stopCamera]
  );

  const startCamera = async () => {
    setCameraActive(true);
    setResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(r => setTimeout(r, 80));
      const s = new Html5Qrcode('seller-qr-reader');
      scannerRef.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        text => {
          void handleVerify(text);
        },
        () => undefined
      );
    } catch {
      toast.error('Camera unavailable — please enter the code manually');
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const chatWithCustomer = async (buyerId: string, productId: string) => {
    try {
      const chatId = await openChat(buyerId, productId);
      router.push(`/chat/${chatId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open chat');
    }
  };

  return (
    <>
      {/* Seller Hub Scanner Card */}
      <section className="sh-scanner-box">
        <div className="sh-scanner-icon">
          <ScanLine size={24} aria-hidden="true" />
        </div>
        <div className="sh-scanner-info">
          <h3>Customer Handover &amp; QR Scanner</h3>
          <p>Scan the customer’s booking QR code at pickup to hand over, or scan again when they return the item.</p>
        </div>
        <div className="sh-scanner-actions">
          <button
            type="button"
            className="ln-btn ln-btn-primary ln-btn-sm"
            onClick={() => {
              setOpenScanModal(true);
              void startCamera();
            }}
          >
            <Camera size={16} aria-hidden="true" /> Scan with camera
          </button>
          <button
            type="button"
            className="ln-btn ln-btn-ghost ln-btn-sm"
            onClick={() => setOpenScanModal(true)}
          >
            <Keyboard size={16} aria-hidden="true" /> Enter code
          </button>
        </div>
      </section>

      {/* Full Handover Scanner & Verification Modal */}
      <Sheet open={openScanModal} onClose={() => { void stopCamera(); setOpenScanModal(false); }}>
        <div className="sh-scan-modal-inner">
          <div className="sh-scan-modal-head">
            <div>
              <h2>Customer Handover Verification</h2>
              <p className="ln-sub">Verify customer booking QR code at pickup and return</p>
            </div>
            <button
              type="button"
              className="ln-icon-btn"
              onClick={() => {
                void stopCamera();
                setOpenScanModal(false);
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {result ? (
            /* Scanned Details Card */
            <div className="sh-scanned-success-card">
              <div className="sh-scanned-status-banner">
                <CheckCircle2 size={32} className="text-emerald-600" />
                <div>
                  <h3>{ACTION_COPY[result.action].title}</h3>
                  <p>{ACTION_COPY[result.action].subtitle}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="sh-customer-card">
                <div className="sh-customer-avatar">
                  {result.order.buyer?.avatarUrl ? (
                    <Image src={result.order.buyer.avatarUrl} alt="" fill sizes="48px" />
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <div className="sh-customer-meta">
                  <span className="sh-customer-badge">
                    <ShieldCheck size={12} /> Customer Verified
                  </span>
                  <h4>{result.order.buyer?.displayName || 'Customer'}</h4>
                  <p>Customer ID: {result.order.buyerId.slice(0, 8)}</p>
                </div>
                <button
                  type="button"
                  className="ln-btn ln-btn-ghost ln-btn-sm"
                  onClick={() => chatWithCustomer(result.order.buyerId, result.order.productId)}
                >
                  <MessageCircle size={15} /> Chat
                </button>
              </div>

              {/* Item & Booking Details */}
              <div className="sh-scanned-item-card">
                <div className="sh-scanned-item-row">
                  {result.order.productImage && (
                    <div className="sh-scanned-item-img">
                      <Image src={result.order.productImage} alt="" fill sizes="60px" />
                    </div>
                  )}
                  <div>
                    <h5>{result.order.productTitle}</h5>
                    <p className="ln-sub">
                      ₹{Math.round(result.order.amount).toLocaleString('en-IN')} · {paymentLabel(result.order)}
                    </p>
                  </div>
                </div>

                {result.order.orderType === 'rent' && result.order.startAt && (
                  <div className="sh-scanned-dates">
                    <Clock size={14} />
                    <span>{formatRange(result.order.startAt, result.order.endAt)} · {rentBreakdown(result.order)}</span>
                  </div>
                )}

                <div className="sh-scanned-checklist">
                  <div>
                    <span>Deposit:</span>
                    <strong>
                      {result.order.depositAmount > 0
                        ? `₹${Math.round(result.order.depositAmount).toLocaleString('en-IN')} (Refundable)`
                        : 'No deposit required'}
                    </strong>
                  </div>
                  {result.lateFee > 0 && (
                    <div className="text-amber-700">
                      <span>Late Fee Applied:</span>
                      <strong>₹{result.lateFee}</strong>
                    </div>
                  )}
                  <div>
                    <span>Customer Status:</span>
                    <strong className="text-emerald-700">Updated in real-time on customer’s page ✓</strong>
                  </div>
                </div>
              </div>

              <div className="sh-scanned-actions">
                <button
                  type="button"
                  className="ln-btn ln-btn-primary ln-btn-block"
                  onClick={() => {
                    setResult(null);
                    void startCamera();
                  }}
                >
                  <Camera size={16} /> Scan another QR
                </button>
                <button
                  type="button"
                  className="ln-btn ln-btn-ghost ln-btn-block"
                  onClick={() => {
                    void stopCamera();
                    setOpenScanModal(false);
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Scanner & Code Input View */
            <div className="sh-scan-view">
              {cameraActive ? (
                <div className="sh-camera-box">
                  <div id="seller-qr-reader" style={{ width: '100%', maxWidth: 320 }} />
                  <button
                    type="button"
                    className="ln-btn ln-btn-ghost ln-btn-sm"
                    onClick={() => void stopCamera()}
                  >
                    <Keyboard size={15} /> Type code instead
                  </button>
                </div>
              ) : (
                <div className="sh-camera-prompt">
                  <button
                    type="button"
                    className="ln-btn ln-btn-primary ln-btn-block"
                    onClick={startCamera}
                  >
                    <Camera size={18} /> Turn on camera scanner
                  </button>
                </div>
              )}

              <form
                className="sh-code-form"
                onSubmit={e => {
                  e.preventDefault();
                  void handleVerify(code);
                }}
              >
                <label htmlFor="seller-code-input" className="ln-field-label">
                  Or enter customer handover code
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="seller-code-input"
                    className="ln-input"
                    placeholder="e.g. LND-C4AE6B80BE"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                  />
                  <button
                    type="submit"
                    className="ln-btn ln-btn-primary"
                    disabled={busy || !code.trim()}
                  >
                    {busy ? <Loader2 size={16} className="ln-spin" /> : 'Verify'}
                  </button>
                </div>
                <p className="ln-note" style={{ marginTop: 8 }}>
                  Customer displays this code on their &quot;Your booking&quot; screen.
                </p>
              </form>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
