'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, ArrowLeft, BadgeCheck, CheckCircle2, Clock, FileText, Glasses, Loader2, Lock, ScanFace, ShieldCheck, Sun, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { getMyKycSubmission, type KycSubmission, type UserProfile } from '@/lib/supabase-db';
import { uploadKycDocument, type KycDocumentKind } from '@/lib/upload';
import {
  ID_TYPES, INDIAN_STATES, KYC_STRICT, checkAddress, checkDocuments, checkIdentity, checkPersonal, formatAadhaar, idTypeInfo,
  isValidAadhaar, kycSubmitted, maskAadhaar, normalizeMobile, shopReady, type IdType, type KycPayload,
} from '@/lib/kyc';
import { formatDate } from '@/lib/time';
import DocumentUpload, { isPdfDoc, useDocPreview, type DocValue } from '@/components/kyc/DocumentUpload';
import SelfieCapture from '@/components/kyc/SelfieCapture';

const STEPS = ['Your details', 'Address', 'ID proof', 'Selfie', 'Review'];

type Docs = { idFront: DocValue; idBack: DocValue; selfie: DocValue };

const dobFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function formatDob(dob: string): string {
  const d = new Date(`${dob}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : dobFmt.format(d);
}

const maskTail = (value: string) => (value ? `••••${value.slice(-4)}` : '');

export default function VerifyPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [submission, setSubmission] = useState<KycSubmission | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const uid = profile?.uid;

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/sell/verify');
  }, [loading, user, router]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getMyKycSubmission(uid).then(s => { if (!cancelled) setSubmission(s); });
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Verify your identity</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="ln-shell kv-shell">
        {!profile || submission === undefined ? (
          <div className="ln-skel" style={{ height: 420, borderRadius: 20, marginTop: 14 }} />
        ) : editing || !kycSubmitted(profile) ? (
          <VerifyForm profile={profile} accountEmail={user?.email || profile.email} previous={submission} />
        ) : (
          <StatusCard profile={profile} submission={submission} onEdit={() => setEditing(true)} />
        )}
      </div>
    </div>
  );
}

function StatusCard({ profile, submission, onEdit }: { profile: UserProfile; submission: KycSubmission | null; onEdit: () => void }) {
  const verified = profile.kycStatus === 'VERIFIED';
  const next = shopReady(profile)
    ? { href: '/sell', label: 'Go to seller hub' }
    : { href: '/sell/shop?onboarding=1', label: 'Next: set up your shop' };
  const data = submission?.data;

  return (
    <section className="kv-card kv-status">
      <div className={`kv-status-icon ${verified ? 'is-good' : 'is-pending'}`}>
        {verified ? <BadgeCheck size={30} aria-hidden="true" /> : <Clock size={30} aria-hidden="true" />}
      </div>
      <h2>{verified ? 'You’re verified' : 'Verification submitted'}</h2>
      <p>
        {verified
          ? 'Renters see the Verified badge on your shop and listings.'
          : 'We’re checking your ID — usually within 24 hours. Set up your shop and add rentals meanwhile; the Verified badge appears once we approve.'}
      </p>
      {data && (
        <dl className="kv-review">
          <div><dt>Name</dt><dd>{data.personal?.fullName || profile.displayName}</dd></div>
          <div><dt>Aadhaar</dt><dd>{maskAadhaar(data.identity?.aadhaarLast4)}</dd></div>
          <div><dt>ID document</dt><dd>{data.identity?.idType ? idTypeInfo(data.identity.idType).label : '—'}</dd></div>
          {submission?.submittedAt && <div><dt>Submitted</dt><dd>{formatDate(submission.submittedAt)}</dd></div>}
        </dl>
      )}
      <div className="kv-status-actions">
        <Link href={next.href} className="ln-btn ln-btn-primary ln-btn-block">{next.label}</Link>
        {!verified && <button type="button" className="ln-btn ln-btn-ghost ln-btn-block" onClick={onEdit}>Update my details</button>}
      </div>
    </section>
  );
}

function VerifyForm({ profile, accountEmail, previous }: { profile: UserProfile; accountEmail: string; previous: KycSubmission | null }) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const prev = previous?.data;
  const needsFix = profile.kycStatus === 'REJECTED' || profile.kycStatus === 'ACTION_REQUIRED';

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState(accountEmail);
  const [personal, setPersonal] = useState({
    fullName: prev?.personal?.fullName || profile.displayName || '',
    phone: normalizeMobile(prev?.personal?.phone || profile.phone || '').slice(-10),
    dob: prev?.personal?.dob || '',
  });
  const [address, setAddress] = useState({
    line: prev?.address?.line || '',
    city: prev?.address?.city || '',
    state: prev?.address?.state && INDIAN_STATES.includes(prev.address.state) ? prev.address.state : '',
    pinCode: prev?.address?.pinCode || '',
  });
  const [aadhaar, setAadhaar] = useState('');
  const [idType, setIdType] = useState<IdType>(() => {
    const t = prev?.identity?.idType;
    return ID_TYPES.some(x => x.id === t) ? (t as IdType) : 'aadhaar';
  });
  const [idNumber, setIdNumber] = useState('');
  const [pan, setPan] = useState('');
  // Files from an earlier submission can be kept; new picks upload on submit
  const [docs, setDocs] = useState<Docs>(() => ({
    idFront: prev?.documents?.idFront ? { path: prev.documents.idFront } : null,
    idBack: prev?.documents?.idBack ? { path: prev.documents.idBack } : null,
    selfie: prev?.documents?.selfie ? { path: prev.documents.selfie } : null,
  }));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const id = idTypeInfo(idType);
  const aadhaarDigits = aadhaar.replace(/\D/g, '');
  const personalFull = { ...personal, email: email.trim() };
  const identity: KycPayload['identity'] = {
    aadhaarNumber: aadhaarDigits,
    idType,
    idNumber: idType === 'aadhaar' ? undefined : idNumber.trim(),
    panNumber: pan.trim() || undefined,
  };

  const stepProblem = (i: number): string | null => {
    switch (i) {
      case 0: return checkPersonal(personalFull);
      case 1: return checkAddress(address);
      case 2: return checkIdentity(identity) ?? checkDocuments({ ...docs, selfie: true }, idType);
      case 3: return docs.selfie ? null : 'Take a selfie to continue';
      default: return consent ? null : 'Tick the box to confirm your consent';
    }
  };

  const goTo = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    const problem = stepProblem(step);
    if (problem) {
      toast.error(problem);
      return;
    }
    goTo(step + 1);
  };

  const changeIdType = (t: IdType) => {
    if (t === idType) return;
    setIdType(t);
    // Photos of a different document don't count
    setDocs(d => ({ ...d, idFront: null, idBack: null }));
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i++) {
      const problem = stepProblem(i);
      if (problem) {
        goTo(i);
        toast.error(problem);
        return;
      }
    }
    try {
      setBusy('Uploading documents…');
      const store = async (key: keyof Docs, kind: KycDocumentKind): Promise<string | undefined> => {
        const value = docs[key];
        if (!value || !('file' in value)) return value?.path;
        const path = await uploadKycDocument(value.file, profile.uid, kind);
        // Remember the stored copy so a retry doesn't upload it again
        setDocs(d => ({ ...d, [key]: { path, preview: value.preview } }));
        return path;
      };
      const [idFront, idBack, selfie] = await Promise.all([
        store('idFront', 'id-front'),
        id.back ? store('idBack', 'id-back') : Promise.resolve(undefined),
        store('selfie', 'selfie'),
      ]);

      setBusy('Submitting…');
      const payload: KycPayload = {
        personal: personalFull,
        address,
        identity,
        documents: { idFront: idFront || '', idBack, selfie: selfie || '' },
        consent,
      };
      const res = await authFetch('/api/kyc/submit', { method: 'POST', body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Couldn’t submit your verification');

      await refreshProfile();
      toast.success('Submitted! We’ll review your ID shortly.');
      router.push(shopReady(profile) ? '/sell' : '/sell/shop?onboarding=1');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t submit your verification');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {needsFix && (
        <div className="kv-alert" role="alert">
          <XCircle size={18} aria-hidden="true" />
          <div>
            <strong>Your last verification needs attention</strong>
            <span>{profile.kycRejectionReason || previous?.rejectionReason || 'Check your details and documents, then submit again.'}</span>
          </div>
        </div>
      )}

      {!KYC_STRICT && (
        <p className="ln-note ln-note-warn kv-proto">
          <strong>Prototype mode:</strong> details aren&apos;t checked, so any test data works — just fill every field and add photos.
        </p>
      )}

      <div className="kv-progress" aria-hidden="true">
        {STEPS.map((s, i) => <span key={s} className={i <= step ? 'is-done' : ''} />)}
      </div>
      <p className="kv-step-label">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>

      {step === 0 && (
        <section className="kv-card">
          <h2>Your details</h2>
          <p>Use your name exactly as it&apos;s printed on your ID.</p>
          <label className="pd-field">
            <span>Full name</span>
            <input className="ln-input" value={personal.fullName} autoComplete="name" maxLength={80} placeholder="e.g. Asha Menon"
              onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} />
          </label>
          {accountEmail ? (
            <div className="pd-field">
              <span>Email</span>
              <div className="kv-locked"><Lock size={15} aria-hidden="true" /><strong>{accountEmail}</strong><em>from your Lendly account</em></div>
            </div>
          ) : (
            <label className="pd-field">
              <span>Email</span>
              <input className="ln-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
          )}
          <label className="pd-field">
            <span>Mobile number</span>
            <div className="kv-phone">
              <span>+91</span>
              <input className="ln-input" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210"
                value={personal.phone} onChange={e => setPersonal(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
            </div>
          </label>
          <label className="pd-field">
            <span>Date of birth</span>
            <input className="ln-input" type="date" value={personal.dob} onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))} />
          </label>
          {KYC_STRICT && <p className="kv-hint">You need to be 18 or older to rent out on Lendly.</p>}
        </section>
      )}

      {step === 1 && (
        <section className="kv-card">
          <h2>Your address</h2>
          <p>As printed on your ID, or where you live now.</p>
          <label className="pd-field">
            <span>House / flat and street</span>
            <input className="ln-input" autoComplete="street-address" maxLength={160} placeholder="e.g. 12B, Rose Villa, MG Road"
              value={address.line} onChange={e => setAddress(a => ({ ...a, line: e.target.value }))} />
          </label>
          <div className="pd-field-row">
            <label className="pd-field">
              <span>City / town</span>
              <input className="ln-input" autoComplete="address-level2" maxLength={60} value={address.city}
                onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
            </label>
            <label className="pd-field">
              <span>PIN code</span>
              <input className="ln-input" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="682016" value={address.pinCode}
                onChange={e => setAddress(a => ({ ...a, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
            </label>
          </div>
          <label className="pd-field">
            <span>State</span>
            <select className="ln-input" autoComplete="address-level1" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}>
              <option value="">Choose your state</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="kv-card">
          <h2>ID proof</h2>
          <p>Your Aadhaar number, plus clear photos of a government ID.</p>
          <label className="pd-field">
            <span>Aadhaar number</span>
            <input className="ln-input kv-mono" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={14} placeholder="1234 5678 9012"
              value={aadhaar} onChange={e => setAadhaar(formatAadhaar(e.target.value))} />
          </label>
          {KYC_STRICT && aadhaarDigits.length === 12 ? (
            isValidAadhaar(aadhaarDigits)
              ? <p className="kv-hint is-ok"><CheckCircle2 size={14} aria-hidden="true" /> Looks good</p>
              : <p className="kv-hint is-bad"><AlertCircle size={14} aria-hidden="true" /> That number doesn&apos;t pass Aadhaar&apos;s check — look at it again</p>
          ) : (
            <p className="kv-hint"><Lock size={13} aria-hidden="true" /> Encrypted — only the last 4 digits are ever shown.</p>
          )}

          <div className="pd-field">
            <span>Which ID are you uploading?</span>
            <div className="ln-chip-wrap">
              {ID_TYPES.map(t => (
                <button key={t.id} type="button" className="ln-chip" aria-pressed={idType === t.id} onClick={() => changeIdType(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          {idType !== 'aadhaar' && (
            <label className="pd-field">
              <span>{id.label} number</span>
              <input className="ln-input kv-mono" autoComplete="off" spellCheck={false} maxLength={20} value={idNumber}
                onChange={e => setIdNumber(e.target.value.toUpperCase())} />
            </label>
          )}
          <div className="kv-docs">
            <DocumentUpload label={id.front} value={docs.idFront} onChange={v => setDocs(d => ({ ...d, idFront: v }))} />
            {id.back && <DocumentUpload label={id.back} value={docs.idBack} onChange={v => setDocs(d => ({ ...d, idBack: v }))} />}
          </div>
          <p className="kv-hint">All four corners in frame, no glare, every word readable.</p>

          <label className="pd-field">
            <span>PAN <em>(optional — needed later for online payouts)</em></span>
            <input className="ln-input kv-mono" autoComplete="off" spellCheck={false} maxLength={10} placeholder="ABCDE1234F" value={pan}
              onChange={e => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="kv-card">
          <h2>Take a selfie</h2>
          <p>A quick photo of you, so we can match it to your ID.</p>
          <SelfieCapture value={docs.selfie} onChange={v => setDocs(d => ({ ...d, selfie: v }))} />
          <ul className="kv-tips">
            <li><Sun size={15} aria-hidden="true" /> Face a window or a bright light</li>
            <li><ScanFace size={15} aria-hidden="true" /> Fit your face in the oval and look straight ahead</li>
            <li><Glasses size={15} aria-hidden="true" /> No sunglasses, mask or cap</li>
          </ul>
        </section>
      )}

      {step === 4 && (
        <section className="kv-card">
          <h2>Review and submit</h2>
          <p>Make sure everything matches your ID.</p>
          <ReviewBlock title="Your details" onEdit={() => goTo(0)} rows={[
            ['Name', personal.fullName],
            ['Email', personalFull.email],
            ['Mobile', personal.phone ? `+91 ${personal.phone}` : ''],
            ['Date of birth', formatDob(personal.dob)],
          ]} />
          <ReviewBlock title="Address" onEdit={() => goTo(1)} rows={[
            ['Address', [address.line, address.city, address.state].filter(Boolean).join(', ') + (address.pinCode ? ` – ${address.pinCode}` : '')],
          ]} />
          <ReviewBlock title="ID proof" onEdit={() => goTo(2)} rows={[
            ['Aadhaar', maskAadhaar(aadhaarDigits.slice(-4) || null)],
            ['Document', id.label],
            ...(idType !== 'aadhaar' ? [[`${id.label} no.`, maskTail(idNumber)] as [string, string]] : []),
            ...(pan ? [['PAN', maskTail(pan)] as [string, string]] : []),
          ]} />
          <div className="kv-thumbs">
            <DocThumb label={id.front} value={docs.idFront} />
            {id.back && <DocThumb label={id.back} value={docs.idBack} />}
            <DocThumb label="Selfie" value={docs.selfie} />
          </div>
          <label className="ln-check kv-consent">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>
              I confirm these details and documents are mine and true, and I consent to Lendly using my Aadhaar number,
              ID and selfie only to verify my identity.
            </span>
          </label>
          <p className="kv-secure">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Stored privately and encrypted. Renters never see your ID — only a Verified badge on your shop.</span>
          </p>
        </section>
      )}

      <div className="lf-submit">
        {step > 0 && (
          <button type="button" className="ln-btn ln-btn-ghost" onClick={() => goTo(step - 1)} disabled={Boolean(busy)}>Back</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="ln-btn ln-btn-primary" style={{ flex: 1 }} onClick={next}>Continue</button>
        ) : (
          <button type="button" className="ln-btn ln-btn-primary" style={{ flex: 1 }} onClick={submit} disabled={Boolean(busy)}>
            {busy ? <><Loader2 size={18} className="ln-spin" aria-hidden="true" /> {busy}</> : 'Submit for verification'}
          </button>
        )}
      </div>
    </>
  );
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="kv-review-block">
      <div className="kv-review-head">
        <h3>{title}</h3>
        <button type="button" className="ln-text-btn" onClick={onEdit}>Edit</button>
      </div>
      <dl className="kv-review">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
      </dl>
    </div>
  );
}

function DocThumb({ label, value }: { label: string; value: DocValue }) {
  const preview = useDocPreview(value);
  return (
    <figure className="kv-thumb">
      {isPdfDoc(value)
        ? <FileText size={22} aria-hidden="true" />
        : preview ? <Image src={preview} alt="" fill sizes="96px" unoptimized /> : null}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
