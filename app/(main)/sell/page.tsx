'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, FileText, IndianRupee, Pause, Pencil, Play, Plus, Printer, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import {
  deleteProduct, getOrdersBySeller, getPrintOrdersByProvider, getProductsBySeller, requestWithdrawal, updatePrintOrder,
  updateProduct, updateUserProfile, type Order, type PrintOrder, type Product,
} from '@/lib/supabase-db';
import { getPrintDocumentUrl } from '@/lib/upload';
import { formatPrice } from '@/lib/catalog';
import { formatDate } from '@/lib/time';
import Sheet from '@/components/ui/Sheet';

type Tab = 'rent' | 'sale' | 'print';

const NEXT_PRINT_STEP: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: 'accepted', label: 'Accept' }, { status: 'declined', label: 'Decline' }],
  accepted: [{ status: 'printing', label: 'Start printing' }],
  printing: [{ status: 'out_for_delivery', label: 'Out for delivery' }, { status: 'completed', label: 'Mark collected' }],
  out_for_delivery: [{ status: 'completed', label: 'Mark delivered' }],
};

export default function SellerHubPage() {
  return <Suspense fallback={null}><SellerHub /></Suspense>;
}

function SellerHub() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'sale' ? 'sale' : params.get('tab') === 'print' ? 'print' : 'rent');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prints, setPrints] = useState<PrintOrder[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const uid = profile?.uid;

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/sell');
  }, [loading, user, router]);

  const load = useCallback(() => {
    if (!uid) return;
    Promise.all([getProductsBySeller(uid), getOrdersBySeller(uid), getPrintOrdersByProvider(uid)]).then(([p, o, pr]) => {
      setProducts(p);
      setOrders(o);
      setPrints(pr);
    });
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const listings = useMemo(() => (products || []).filter(p => (tab === 'rent' ? p.listingType === 'rent' : p.listingType !== 'rent')), [products, tab]);
  const tabOrders = orders.filter(o => (tab === 'rent' ? o.orderType === 'rent' : o.orderType !== 'rent'));
  const pending = tabOrders.filter(o => o.status === 'pending').length;
  const upcoming = tabOrders.filter(o => o.status === 'accepted' || o.status === 'active').length;
  const collected = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0);

  const togglePause = async (p: Product) => {
    try {
      await updateProduct(p.id, { status: p.status === 'paused' ? 'available' : 'paused' });
      toast.success(p.status === 'paused' ? 'Listing is live again' : 'Listing paused');
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not update'); }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try { await deleteProduct(p.id); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not delete'); }
  };

  const movePrint = async (o: PrintOrder, status: string) => {
    try { await updatePrintOrder(o.id, { status }); toast.success('Updated'); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not update'); }
  };

  return (
    <div className="ln-page">
      <div className="top-header">
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Seller hub</h1>
        <Link href={`/sell/new${tab === 'print' ? '' : `?type=${tab}`}`} className="ln-btn ln-btn-primary ln-btn-sm"><Plus size={16} aria-hidden="true" /> New listing</Link>
      </div>
      <div className="ln-shell" style={{ paddingTop: 14 }}>
        <div className="sh-stats">
          <div><span>Requests waiting</span><strong>{orders.filter(o => o.status === 'pending').length}</strong></div>
          <div><span>Active listings</span><strong>{(products || []).filter(p => p.status === 'available').length}</strong></div>
          <div><span>Completed value</span><strong>₹{Math.round(collected).toLocaleString('en-IN')}</strong></div>
          <button type="button" onClick={() => setWithdrawOpen(true)}><span><Wallet size={13} aria-hidden="true" /> Online balance</span><strong>₹{Math.round(profile?.earnings || 0).toLocaleString('en-IN')}</strong></button>
        </div>

        <div className="ln-tabs" role="tablist" style={{ marginTop: 16 }}>
          <button type="button" role="tab" className="ln-tab" aria-selected={tab === 'rent'} onClick={() => setTab('rent')}>Rentals</button>
          <button type="button" role="tab" className="ln-tab" aria-selected={tab === 'sale'} onClick={() => setTab('sale')}>Sales</button>
          <button type="button" role="tab" className="ln-tab" aria-selected={tab === 'print'} onClick={() => setTab('print')}><Printer size={15} aria-hidden="true" /> Print jobs</button>
        </div>

        {tab !== 'print' ? (
          <>
            <Link href="/profile/orders?role=seller" className="sh-banner">
              <span><strong>{pending} new {tab === 'rent' ? 'booking' : 'purchase'} request{pending === 1 ? '' : 's'}</strong> · {upcoming} {tab === 'rent' ? 'confirmed or out on rent' : 'reserved'}</span>
              <span className="ln-text-btn">Manage →</span>
            </Link>

            {!products ? (
              <div className="ln-skel" style={{ height: 180, borderRadius: 16, marginTop: 14 }} />
            ) : listings.length === 0 ? (
              <div className="ln-empty">
                <h2>{tab === 'rent' ? 'Nothing for rent yet' : 'Nothing for sale yet'}</h2>
                <p>{tab === 'rent' ? 'Halls, speakers, cameras, bikes — list what neighbours can borrow.' : 'Turn things you no longer need into cash.'}</p>
                <div className="ln-empty-actions"><Link href={`/sell/new?type=${tab}`} className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" /> {tab === 'rent' ? 'Rent something out' : 'Sell something'}</Link></div>
              </div>
            ) : (
              <ul className="od-list">
                {listings.map(p => (
                  <li key={p.id} className="od-card">
                    <div className="od-top">
                      <Link href={`/product/${p.id}`} className="od-img">{p.images?.[0] && <Image src={p.images[0]} alt="" fill sizes="72px" />}</Link>
                      <div className="od-info">
                        <span className={`od-status is-${p.status === 'available' ? 'good' : p.status === 'paused' ? 'pending' : 'done'}`}>{p.status}</span>
                        <h3>{p.title}</h3>
                        <p>{formatPrice(p.price, p.listingType, p.rentDuration)} · {p.views || 0} views · listed {formatDate(p.createdAt)}</p>
                      </div>
                    </div>
                    <div className="od-actions">
                      <Link href={`/product/${p.id}`} className="ln-btn ln-btn-ghost ln-btn-sm"><Eye size={15} aria-hidden="true" /> View</Link>
                      <Link href={`/sell/${p.id}/edit`} className="ln-btn ln-btn-ghost ln-btn-sm"><Pencil size={15} aria-hidden="true" /> Edit</Link>
                      {(p.status === 'available' || p.status === 'paused') && (
                        <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => togglePause(p)}>
                          {p.status === 'paused' ? <><Play size={15} aria-hidden="true" /> Resume</> : <><Pause size={15} aria-hidden="true" /> Pause</>}
                        </button>
                      )}
                      <button type="button" className="ln-btn ln-btn-danger ln-btn-sm" aria-label={`Delete ${p.title}`} onClick={() => remove(p)}><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <PrintTab prints={prints} onMove={movePrint} onSaved={async () => { await refreshProfile(); load(); }} />
        )}
      </div>

      <WithdrawSheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} balance={profile?.earnings || 0} onDone={refreshProfile} />
    </div>
  );
}

function PrintTab({ prints, onMove, onSaved }: { prints: PrintOrder[]; onMove: (o: PrintOrder, s: string) => void; onSaved: () => Promise<void> }) {
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState(Boolean(profile?.isPrintProvider));
  const [bw, setBw] = useState(String(profile?.printPriceBW ?? 2));
  const [color, setColor] = useState(String(profile?.printPriceColor ?? 10));
  const [name, setName] = useState(profile?.printStoreName || profile?.storeName || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        isPrintProvider: enabled,
        printPriceBW: Math.max(0.5, Number(bw) || 2),
        printPriceColor: Math.max(1, Number(color) || 10),
        printStoreName: name.trim() || profile.storeName || profile.displayName,
      });
      await onSaved();
      toast.success('Print shop settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (path: string) => {
    try { window.open(await getPrintDocumentUrl(path), '_blank', 'noopener'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not open the file'); }
  };

  return (
    <>
      <section className="od-card" style={{ marginTop: 14 }}>
        <label className="ln-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /><span><strong>Offer print &amp; xerox</strong> — show up in the Print &amp; Xerox directory</span></label>
        <div className="pd-field-row">
          <label className="pd-field"><span>Shop name</span><input className="ln-input" value={name} onChange={e => setName(e.target.value)} /></label>
        </div>
        <div className="pd-field-row">
          <label className="pd-field"><span>B&amp;W per page (₹)</span><input className="ln-input" type="number" min={0.5} step={0.5} value={bw} onChange={e => setBw(e.target.value)} /></label>
          <label className="pd-field"><span>Colour per page (₹)</span><input className="ln-input" type="number" min={1} value={color} onChange={e => setColor(e.target.value)} /></label>
        </div>
        <button type="button" className="ln-btn ln-btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save print settings'}</button>
      </section>

      {prints.length === 0 ? (
        <div className="ln-empty"><Printer size={28} aria-hidden="true" /><h2>No print jobs yet</h2></div>
      ) : (
        <ul className="od-list">
          {prints.map(o => (
            <li key={o.id} className="od-card">
              <div className="od-top">
                <div className="od-info">
                  <span className={`od-status is-${o.status === 'completed' ? 'done' : o.status === 'pending' ? 'pending' : ['cancelled', 'declined'].includes(o.status) ? 'bad' : 'good'}`}>{o.status.replace(/_/g, ' ')}</span>
                  <h3>{o.buyerName || 'Customer'} · {o.pageCount} pg × {o.copies}</h3>
                  <p>{o.colorMode === 'color' ? 'Colour' : 'B&W'} · {o.paperSize} · {o.sides === 'double' ? 'Double-sided' : 'Single-sided'} · {formatDate(o.createdAt)}</p>
                </div>
                <strong className="od-amount"><IndianRupee size={14} aria-hidden="true" />{Math.round(o.totalAmount)}</strong>
              </div>
              {o.deliveryAddress && <p className="od-line">Deliver to: {o.deliveryAddress}{o.buyerPhone ? ` · ${o.buyerPhone}` : ''}</p>}
              {o.specialInstructions && <p className="od-note">“{o.specialInstructions}”</p>}
              <div className="od-actions">
                {o.filePaths.map((path, i) => (
                  <button key={path} type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => openFile(path)}>
                    <FileText size={14} aria-hidden="true" /> {o.fileNames?.[i] || `File ${i + 1}`}
                  </button>
                ))}
                {(NEXT_PRINT_STEP[o.status] || []).map(step => (
                  <button key={step.status} type="button" className={`ln-btn ln-btn-sm ${step.status === 'declined' ? 'ln-btn-danger' : 'ln-btn-primary'}`} onClick={() => onMove(o, step.status)}>{step.label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function WithdrawSheet({ open, onClose, balance, onDone }: { open: boolean; onClose: () => void; balance: number; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await requestWithdrawal(Number(amount), method, destination);
      await onDone();
      toast.success('Withdrawal requested — paid out within 24–48 hours');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Withdraw online earnings"
      footer={<button type="button" className="ln-btn ln-btn-primary ln-btn-block" disabled={busy} onClick={submit}>{busy ? 'Requesting…' : 'Request payout'}</button>}>
      <p className="ln-note">Balance from online payments: <strong>₹{Math.round(balance).toLocaleString('en-IN')}</strong>. Pay-at-pickup money goes straight to you.</p>
      <label className="pd-field"><span>Amount (min ₹50)</span><input className="ln-input" type="number" min={50} value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <div className="ln-seg" style={{ marginTop: 12 }}>
        <button type="button" className="ln-seg-btn" aria-pressed={method === 'upi'} onClick={() => setMethod('upi')}>UPI</button>
        <button type="button" className="ln-seg-btn" aria-pressed={method === 'bank_transfer'} onClick={() => setMethod('bank_transfer')}>Bank transfer</button>
      </div>
      <label className="pd-field"><span>{method === 'upi' ? 'UPI ID' : 'Account number & IFSC'}</span><input className="ln-input" value={destination} onChange={e => setDestination(e.target.value)} /></label>
    </Sheet>
  );
}
