'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Clock, FileText, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { ageFrom } from '@/lib/kyc';
import { formatDateTime } from '@/lib/time';

interface DocLink {
  url: string | null;
  isPdf: boolean;
}

interface Application {
  uid: string;
  email: string;
  displayName: string;
  submittedAt: string;
  personal: { fullName: string; phone: string; dob: string };
  address: string;
  identity: { idType: string; aadhaarMasked: string; idNumberMasked: string | null; panMasked: string | null };
  documents: { selfie: DocLink | null; idFront: DocLink | null; idBack: DocLink | null };
  bank: { accountHolder: string; accountNumberMasked: string; ifsc: string } | null;
  business: { businessName: string; businessPanMasked: string; gstin: string } | null;
}

export default function AdminKYCPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?redirect=/admin/kyc');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    authFetch('/api/admin/kyc')
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setError(res.ok ? null : data.error || 'Couldn’t load verifications');
        setApplications(res.ok ? data.applications || [] : []);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Couldn’t load verifications');
        setApplications([]);
      });
    return () => { cancelled = true; };
  }, [uid]);

  const review = async (target: string, approve: boolean) => {
    if (!approve && !reason.trim()) {
      toast.error('Say what needs fixing — the lender sees this note');
      return;
    }
    setBusy(target);
    try {
      const res = await authFetch('/api/admin/kyc', {
        method: 'POST',
        body: JSON.stringify({ targetUid: target, action: approve ? 'APPROVE' : 'REJECT', reason: approve ? undefined : reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t save the decision');
      toast.success(approve ? 'Approved — their shop now shows the Verified badge' : 'Sent back with your note');
      setRejecting(null);
      setReason('');
      setApplications(prev => prev?.filter(a => a.uid !== target) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save the decision');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Lender verifications</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell ak-shell">
        {applications === null ? (
          <div className="ln-skel" style={{ height: 320, borderRadius: 20 }} />
        ) : error ? (
          <div className="ln-empty"><Shield size={28} aria-hidden="true" /><h2>Admins only</h2><p>{error}</p></div>
        ) : applications.length === 0 ? (
          <div className="ln-empty"><Shield size={28} aria-hidden="true" /><h2>All caught up</h2><p>No verifications are waiting for review.</p></div>
        ) : (
          <ul className="ak-list">
            {applications.map(app => {
              const age = app.personal.dob ? ageFrom(app.personal.dob) : null;
              return (
                <li key={app.uid} className="ak-card">
                  <div className="ak-head">
                    <div>
                      <h2>{app.personal.fullName}</h2>
                      <p>{app.email}{app.personal.phone ? ` · +91 ${app.personal.phone}` : ''}</p>
                    </div>
                    <span className="od-status is-pending"><Clock size={12} aria-hidden="true" /> {formatDateTime(app.submittedAt)}</span>
                  </div>

                  <div className="ak-docs">
                    <DocTile label="Selfie" doc={app.documents.selfie} />
                    <DocTile label="ID front" doc={app.documents.idFront} />
                    <DocTile label="ID back" doc={app.documents.idBack} />
                  </div>

                  <dl className="ak-grid">
                    <div><dt>ID document</dt><dd>{app.identity.idType}</dd></div>
                    <div><dt>Aadhaar</dt><dd>{app.identity.aadhaarMasked}</dd></div>
                    {app.identity.idNumberMasked && <div><dt>ID number</dt><dd>{app.identity.idNumberMasked}</dd></div>}
                    {app.identity.panMasked && <div><dt>PAN</dt><dd>{app.identity.panMasked}</dd></div>}
                    <div><dt>Date of birth</dt><dd>{app.personal.dob ? `${app.personal.dob}${age !== null ? ` · ${age} yrs` : ''}` : '—'}</dd></div>
                    <div className="is-wide"><dt>Address</dt><dd>{app.address || '—'}</dd></div>
                    {app.bank && (
                      <div className="is-wide"><dt>Bank (older form)</dt><dd>{app.bank.accountHolder} · {app.bank.accountNumberMasked} · {app.bank.ifsc}</dd></div>
                    )}
                    {app.business && (
                      <div className="is-wide"><dt>Business (older form)</dt><dd>{app.business.businessName} · PAN {app.business.businessPanMasked}{app.business.gstin ? ` · GSTIN ${app.business.gstin}` : ''}</dd></div>
                    )}
                  </dl>

                  {rejecting === app.uid ? (
                    <div className="ak-reject">
                      <label className="pd-field">
                        <span>What needs fixing? The lender sees this.</span>
                        <input className="ln-input" value={reason} maxLength={240} onChange={e => setReason(e.target.value)}
                          placeholder="e.g. The ID photo is blurry — retake it in good light" />
                      </label>
                      <div className="ak-actions">
                        <button type="button" className="ln-btn ln-btn-ghost" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</button>
                        <button type="button" className="ln-btn ln-btn-danger" disabled={busy === app.uid} onClick={() => review(app.uid, false)}>Send back</button>
                      </div>
                    </div>
                  ) : (
                    <div className="ak-actions">
                      <button type="button" className="ln-btn ln-btn-primary" disabled={busy === app.uid} onClick={() => review(app.uid, true)}>
                        <Check size={16} aria-hidden="true" /> Approve
                      </button>
                      <button type="button" className="ln-btn ln-btn-danger" onClick={() => { setRejecting(app.uid); setReason(''); }}>
                        <X size={16} aria-hidden="true" /> Reject
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DocTile({ label, doc }: { label: string; doc: DocLink | null }) {
  if (!doc?.url) {
    return <div className="ak-doc is-empty"><span>{label}</span><em>{doc ? 'Couldn’t load' : 'Not provided'}</em></div>;
  }
  return (
    <a className="ak-doc" href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} full size`}>
      {doc.isPdf
        ? <FileText size={26} aria-hidden="true" />
        : <Image src={doc.url} alt={label} fill sizes="(max-width: 640px) 33vw, 300px" unoptimized />}
      <span>{label}</span>
    </a>
  );
}
