'use client';

import { use, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { getUserProfile, type UserProfile } from '@/lib/firestore';
import { uploadDocumentToCloudinary } from '@/lib/cloudinary';
import { authFetch } from '@/lib/auth-fetch';
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Printer,
  Layers,
  MapPin,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Clock,
  Phone
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PrintOrderConfiguratorPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = use(params);
  const { profile } = useAuth();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const router = useRouter();

  const [provider, setProvider] = useState<UserProfile | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  // File Upload State
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ name: string; size: string; isPdf: boolean; url?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Configuration States
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [copies, setCopies] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number>(1);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Delivery Details
  const [deliveryAddress, setDeliveryAddress] = useState(profile?.location?.address || '');
  const [buyerPhone, setBuyerPhone] = useState(profile?.phone || '');

  // Checkout State
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.location?.address && !deliveryAddress) {
      setDeliveryAddress(profile.location.address);
    }
    if (profile?.phone && !buyerPhone) {
      setBuyerPhone(profile.phone);
    }
  }, [profile, deliveryAddress, buyerPhone]);

  useEffect(() => {
    let cancelled = false;

    async function loadProvider() {
      try {
        const p = await getUserProfile(providerId);
        if (cancelled) return;
        setProvider(p);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingProvider(false);
      }
    }

    void loadProvider();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  // Load Razorpay SDK
  useEffect(() => {
    if (document.getElementById('razorpay-script')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (files.length + selectedFiles.length > 10) {
      toast.error('You can upload a maximum of 10 files per print job.');
      return;
    }

    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);

    const previews = newFiles.map(f => ({
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      isPdf: f.type === 'application/pdf' || f.name.endsWith('.pdf'),
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    setFilePreviews(previews);

    // If initial single page, guess page count from number of files
    if (pageCount === 1) {
      setPageCount(Math.max(1, newFiles.length));
    }
  };

  const removeFile = (idx: number) => {
    const newFiles = files.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setFilePreviews(filePreviews.filter((_, i) => i !== idx));
    setPageCount(Math.max(1, newFiles.length));
  };

  // Pricing calculations
  const rateBW = provider?.printPriceBW ?? 2;
  const rateColor = provider?.printPriceColor ?? 10;
  const pricePerPage = colorMode === 'color' ? rateColor : rateBW;
  const totalAmount = Math.max(1, pricePerPage * Math.max(1, pageCount) * Math.max(1, copies));

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      requireAuth(undefined, 'Please log in to submit your print order');
      return;
    }

    if (files.length === 0) {
      toast.error('Please upload at least one document or image to print.');
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error('Please provide a delivery address for doorstep handover.');
      return;
    }

    setSubmitting(true);
    setUploading(true);

    try {
      // 1. Upload files to Cloudinary concurrently
      toast.loading('Uploading documents securely...', { id: 'upload-toast' });
      const uploadedDocs = await Promise.all(
        files.map(file => uploadDocumentToCloudinary(file, profile?.uid || 'guest', 'print_jobs'))
      );
      toast.dismiss('upload-toast');
      setUploading(false);

      const fileUrls = uploadedDocs.map(d => d.url);
      const fileNames = uploadedDocs.map(d => d.name);

      // 2. Create Razorpay Payment Order
      const res = await authFetch('/api/payment/create-print-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          amount: totalAmount,
          pageCount,
          copies,
          colorMode,
          paperSize,
          sides,
        }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Failed to initialize payment');

      const providerTitle = provider?.printStoreName || provider?.storeName || provider?.displayName || 'Print Hub';

      // 3. Trigger Razorpay Checkout Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.replace(/^"|"$/g, '') || '',
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Lendly Print Service',
        description: `Print Job: ${pageCount} pages × ${copies} copies (${colorMode.toUpperCase()}) - ${providerTitle}`,
        image: 'https://api.dicebear.com/7.x/bottts/svg?seed=printcart',
        order_id: orderData.id,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          try {
            toast.loading('Verifying payment and confirming print job...', { id: 'verify-toast' });

            const verifyRes = await authFetch('/api/payment/verify-print-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                providerId,
                amount: totalAmount,
                fileUrls,
                fileNames,
                pageCount,
                copies,
                colorMode,
                orientation,
                paperSize,
                sides,
                specialInstructions,
                deliveryAddress: deliveryAddress.trim(),
                deliveryLocation: profile?.location || { lat: 0, lng: 0 },
                buyerName: profile?.displayName || 'Customer',
                buyerPhone: buyerPhone.trim(),
              }),
            });

            const verifyData = await verifyRes.json();
            toast.dismiss('verify-toast');

            if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

            toast.success('Print Order Placed! The provider has been notified.');
            router.push(`/print/orders`);
          } catch (err: unknown) {
            console.error('Verification Error:', err);
            const msg = err instanceof Error ? err.message : 'Verification failed';
            toast.error(msg);
          }
        },
        prefill: {
          name: profile?.displayName || '',
          email: profile?.email || '',
          contact: buyerPhone || profile?.phone || '',
        },
        theme: {
          color: '#f97316',
        },
      };

      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void; on: (event: string, cb: (r: { error: { description: string } }) => void) => void } }).Razorpay;
      if (!RazorpayConstructor) {
        throw new Error('Razorpay SDK not loaded. Please check your internet connection.');
      }

      const razorpay = new RazorpayConstructor(options);
      razorpay.on('payment.failed', function (response: { error: { description: string } }) {
        toast.error(`Payment failed: ${response.error.description}`);
      });
      razorpay.open();
    } catch (err: unknown) {
      console.error(err);
      toast.dismiss('upload-toast');
      const msg = err instanceof Error ? err.message : 'Failed to start print order';
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const providerTitle = provider?.printStoreName || provider?.storeName || `${provider?.displayName || 'Local'}'s Print Hub`;

  return (
    <div className="fade-in" style={{ paddingBottom: 120, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Top Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#ffffff', borderBottom: '1px solid var(--border-color)',
        padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Configure Print Job</span>
            </h1>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>Fulfillment by {providerTitle}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <span className="badge badge-warning" style={{ fontSize: 11, fontWeight: 800 }}>
            B&W ₹{rateBW} / Color ₹{rateColor}
          </span>
        </div>
      </div>

      <div className="page-container" style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>
        
        {/* ================= 1. FILE UPLOAD SECTION ================= */}
        <div className="glass-card" style={{ padding: 22, borderRadius: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={18} style={{ color: 'var(--primary-dark)' }} />
              <span>1. Upload Files for Printing</span>
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>PDF, PNG, JPG, WEBP</span>
          </div>

          {/* Drag & Drop Box */}
          <label style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 20px',
            borderRadius: 16,
            border: '2px dashed rgba(249, 115, 22, 0.45)',
            background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.25) 0%, rgba(255, 255, 255, 0.8) 100%)',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s ease',
          }}>
            <input
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={submitting}
            />
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#ffffff', border: '1px solid rgba(249, 115, 22, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ea580c', marginBottom: 10, boxShadow: '0 2px 8px rgba(194, 65, 12, 0.08)'
            }}>
              <Upload size={22} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0b2240', marginBottom: 4 }}>
              Click to select PDF or image files
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Supports documents up to 10MB each (max 10 files)
            </div>
          </label>

          {/* Uploaded Files Preview List */}
          {filePreviews.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
                Selected Files ({filePreviews.length}):
              </div>
              {filePreviews.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: file.isPdf ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      color: file.isPdf ? '#ef4444' : '#3b82f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <FileText size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{file.size}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFile(idx)}
                    className="btn-ghost"
                    style={{ padding: 6, color: '#ef4444', borderRadius: 8 }}
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= 2. PRINT CONFIGURATION OPTIONS ================= */}
        <div className="glass-card" style={{ padding: 22, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} style={{ color: 'var(--primary-dark)' }} />
            <span>2. Print Specifications</span>
          </h3>

          {/* Color Mode Selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 8 }}>
              Color Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                onClick={() => setColorMode('bw')}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: colorMode === 'bw' ? '2.5px solid var(--primary)' : '1px solid var(--border-color)',
                  background: colorMode === 'bw' ? 'rgba(249, 115, 22, 0.08)' : 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#0f172a',
                  color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13
                }}>
                  B
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>Black & White</div>
                  <div style={{ fontSize: 12, color: 'var(--primary-dark)', fontWeight: 700 }}>₹{rateBW} / page</div>
                </div>
              </div>

              <div
                onClick={() => setColorMode('color')}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: colorMode === 'color' ? '2.5px solid var(--primary)' : '1px solid var(--border-color)',
                  background: colorMode === 'color' ? 'rgba(249, 115, 22, 0.08)' : 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f43f5e 0%, #3b82f6 100%)',
                  color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13
                }}>
                  C
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>Vibrant Color</div>
                  <div style={{ fontSize: 12, color: '#ea580c', fontWeight: 700 }}>₹{rateColor} / page</div>
                </div>
              </div>
            </div>
          </div>

          {/* Paper Size Selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 8 }}>
              Paper Size
            </label>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {(['A4', 'A3', 'A5', 'Letter', 'Legal'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPaperSize(size)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: paperSize === size ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: paperSize === size ? 'var(--primary)' : 'var(--surface)',
                    color: paperSize === size ? '#ffffff' : 'var(--foreground)',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {size} {size === 'A4' && '(Standard)'}
                </button>
              ))}
            </div>
          </div>

          {/* Orientation & Sides Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                Orientation
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: orientation === 'portrait' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: orientation === 'portrait' ? 'rgba(249, 115, 22, 0.1)' : 'var(--surface)',
                    color: orientation === 'portrait' ? 'var(--primary-dark)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: orientation === 'landscape' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: orientation === 'landscape' ? 'rgba(249, 115, 22, 0.1)' : 'var(--surface)',
                    color: orientation === 'landscape' ? 'var(--primary-dark)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  Landscape
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                Print Sides
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSides('single')}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: sides === 'single' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: sides === 'single' ? 'rgba(249, 115, 22, 0.1)' : 'var(--surface)',
                    color: sides === 'single' ? 'var(--primary-dark)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  Single Side
                </button>
                <button
                  type="button"
                  onClick={() => setSides('double')}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: sides === 'double' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: sides === 'double' ? 'rgba(249, 115, 22, 0.1)' : 'var(--surface)',
                    color: sides === 'double' ? 'var(--primary-dark)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  Double Side
                </button>
              </div>
            </div>
          </div>

          {/* Page Count & Copies Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                Total Pages in Document
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={pageCount}
                onChange={e => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field"
                style={{ borderRadius: 12, height: 42, fontSize: 14, fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                Number of Copies
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCopies(c => Math.max(1, c - 1))}
                  className="btn-ghost"
                  style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid var(--border-color)', fontSize: 18, fontWeight: 800 }}
                >
                  -
                </button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 900 }}>
                  {copies}
                </div>
                <button
                  type="button"
                  onClick={() => setCopies(c => c + 1)}
                  className="btn-ghost"
                  style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid var(--border-color)', fontSize: 18, fontWeight: 800 }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
              Special Notes / Binding Requests (Optional)
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. Please staple top-left corner, print page 1-3 only..."
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              style={{ borderRadius: 12, fontSize: 13 }}
            />
          </div>
        </div>

        {/* ================= 3. DELIVERY ADDRESS ================= */}
        <div className="glass-card" style={{ padding: 22, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} style={{ color: 'var(--primary-dark)' }} />
            <span>3. Doorstep Delivery Details</span>
          </h3>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
              Delivery Address
            </label>
            <input
              className="input-field"
              placeholder="Enter your street address, room/apartment number..."
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              style={{ borderRadius: 12, fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
              Contact Phone Number
            </label>
            <input
              type="tel"
              className="input-field"
              placeholder="e.g. +91 9876543210"
              value={buyerPhone}
              onChange={e => setBuyerPhone(e.target.value)}
              style={{ borderRadius: 12, fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* ================= FIXED BOTTOM CHECKOUT BAR ================= */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#ffffff',
        borderTop: '1px solid var(--border-color)',
        padding: '12px 20px',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        zIndex: 90
      }}>
        <div style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              {pageCount} pgs × {copies} copy × ₹{pricePerPage} ({colorMode.toUpperCase()})
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)' }}>
              Total: <span style={{ color: 'var(--primary-dark)' }}>₹{totalAmount}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={submitting || files.length === 0}
            className="btn-primary"
            style={{
              padding: '12px 24px',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: files.length === 0 ? 0.6 : 1,
              cursor: files.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Printer size={18} />
                <span>Pay & Order (₹{totalAmount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
