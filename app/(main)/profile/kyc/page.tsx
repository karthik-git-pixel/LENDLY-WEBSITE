'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, Clock, XCircle, FileText, Loader2, ArrowRight, Upload, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function KYCPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    personal: { fullName: '', email: '' },
    identity: { panNumber: '', governmentIdNumber: '' },
    address: { address: '', state: '', district: '', pinCode: '' },
    bank: { accountHolder: '', accountNumber: '', ifsc: '' },
    isBusiness: false,
    business: { businessName: '', businessPan: '', gstin: '' }
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        personal: { ...prev.personal, fullName: profile.displayName || '', email: profile.email || '' }
      }));
    }
  }, [profile]);

  if (!profile) return null;

  const status = profile.kycStatus || 'NOT_STARTED';

  const updateForm = (section: keyof typeof formData, field: string, value: string | boolean) => {
    if (section === 'isBusiness') {
      setFormData(prev => ({ ...prev, isBusiness: value as boolean }));
    } else {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof typeof formData] as object),
          [field]: value
        }
      }));
    }
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!formData.personal.fullName || !formData.personal.email) return 'Please fill in all personal details';
    }
    if (currentStep === 2) {
      if (!formData.identity.panNumber) return 'PAN Number is mandatory';
      const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
      if (!panRegex.test(formData.identity.panNumber.toUpperCase())) return 'Invalid PAN format';
    }
    if (currentStep === 3) {
      if (!formData.address.address || !formData.address.state || !formData.address.district || !formData.address.pinCode) return 'Please fill in all address fields';
    }
    if (currentStep === 4) {
      if (!formData.bank.accountHolder || !formData.bank.accountNumber || !formData.bank.ifsc) return 'Please fill in all bank details';
    }
    if (currentStep === 5 && formData.isBusiness) {
      if (!formData.business.businessName || !formData.business.businessPan) return 'Business Name and PAN are mandatory for registered businesses';
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    if (step === 4 && !formData.isBusiness) {
      setStep(6); // Skip business step
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (step === 6 && !formData.isBusiness) {
      setStep(4);
    } else {
      setStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        personal: formData.personal,
        identity: formData.identity,
        address: formData.address,
        bank: formData.bank,
        ...(formData.isBusiness && { business: formData.business })
      };

      const res = await authFetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit KYC');

      await refreshProfile();
      toast.success('KYC application submitted successfully!');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to submit application';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const renderStatusScreen = () => {
    if (status === 'PENDING_VERIFICATION' || status === 'IN_PROGRESS') {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginTop: 20 }}>
          <Clock size={64} style={{ color: 'var(--accent)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Verification Pending</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
            We are reviewing your KYC application. This usually takes 24-48 hours. Payouts will be enabled once verified.
          </p>
        </div>
      );
    }

    if (status === 'VERIFIED') {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginTop: 20 }}>
          <CheckCircle2 size={64} style={{ color: '#10b981', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>KYC Verified</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
            Your identity has been successfully verified. You are ready to receive payouts!
          </p>
        </div>
      );
    }

    if (status === 'REJECTED' || status === 'ACTION_REQUIRED') {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginTop: 20 }}>
          <XCircle size={64} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Verification Failed</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
            {profile.kycRejectionReason || 'Your previous submission was rejected. Please review and update your details.'}
          </p>
          <button onClick={() => refreshProfile().then(() => setStep(1))} className="btn-primary" style={{ padding: '12px 24px', borderRadius: 12 }}>
            Re-Submit KYC
          </button>
        </div>
      );
    }

    return null;
  };

  if (status !== 'NOT_STARTED' && step === 1 && !formData.personal.fullName) {
    // If not started, we show the form. If rejected and they clicked resubmit, it's NOT_STARTED essentially.
    // We already handled non-NOT_STARTED in renderStatusScreen unless they hit "resubmit" which we can handle via a local state override.
  }

  // If status is not NOT_STARTED and we are not forcing re-submission (for now, if rejected they can stay on screen to see it)
  if (status !== 'NOT_STARTED' && status !== 'REJECTED' && status !== 'ACTION_REQUIRED') {
    return (
      <div className="fade-in">
        <div className="top-header" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>KYC Verification</h1>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Seller Onboarding</p>
            </div>
          </div>
        </div>
        <div className="page-container">
          {renderStatusScreen()}
        </div>
      </div>
    );
  }

  if (status === 'REJECTED' || status === 'ACTION_REQUIRED') {
    // We only show the form if they haven't explicitly triggered it, but for simplicity let's just show the rejection screen
    // If we wanted to allow them to edit right away, we'd need a local state `isResubmitting`. Let's add that logic.
  }

  const renderStepIndicator = () => {
    const totalSteps = formData.isBusiness ? 6 : 5;
    const progress = Math.min(100, Math.round(((step - 1) / totalSteps) * 100));
    
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
          <span>Step {Math.min(step, totalSteps)} of {totalSteps}</span>
          <span style={{ color: 'var(--primary)' }}>{progress}% Completed</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="top-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { if (step > 1) handleBack(); else router.back(); }} className="btn-ghost" style={{ padding: 8 }}>
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>KYC Verification</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Secure Seller Onboarding</p>
          </div>
        </div>
      </div>

      <div className="page-container pb-safe">
        {status === 'REJECTED' && step === 1 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: 16, borderRadius: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
            <AlertCircle color="var(--danger)" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>Action Required</div>
              <div style={{ fontSize: 13, color: 'var(--foreground)', marginTop: 4 }}>{profile.kycRejectionReason || 'Please fix the errors in your previous application and resubmit.'}</div>
            </div>
          </div>
        )}

        {renderStepIndicator()}

        <div className="glass-card" style={{ padding: 24, borderRadius: 20 }}>
          {step === 1 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Personal Information</h2>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Full Name (as per PAN)</label>
                <input 
                  type="text" 
                  value={formData.personal.fullName}
                  onChange={(e) => updateForm('personal', 'fullName', e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="input-field"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Registered Mobile (Verified)</label>
                <input 
                  type="text" 
                  value={profile.phone} 
                  disabled 
                  className="input-field" 
                  style={{ opacity: 0.7 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Email Address</label>
                <input 
                  type="email" 
                  value={formData.personal.email}
                  onChange={(e) => updateForm('personal', 'email', e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Identity Details</h2>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>PAN Number *</label>
                <input 
                  type="text" 
                  value={formData.identity.panNumber}
                  onChange={(e) => updateForm('identity', 'panNumber', e.target.value)}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="input-field"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Aadhaar / Govt ID (Optional)</label>
                <input 
                  type="text" 
                  value={formData.identity.governmentIdNumber}
                  onChange={(e) => updateForm('identity', 'governmentIdNumber', e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className="input-field"
                />
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Only required if mandated by the payment provider.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Address Details</h2>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Street Address</label>
                <input 
                  type="text" 
                  value={formData.address.address}
                  onChange={(e) => updateForm('address', 'address', e.target.value)}
                  placeholder="House/Flat No, Street Name"
                  className="input-field"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group">
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>State</label>
                  <input 
                    type="text" 
                    value={formData.address.state}
                    onChange={(e) => updateForm('address', 'state', e.target.value)}
                    placeholder="State"
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>District/City</label>
                  <input 
                    type="text" 
                    value={formData.address.district}
                    onChange={(e) => updateForm('address', 'district', e.target.value)}
                    placeholder="City"
                    className="input-field"
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>PIN Code</label>
                <input 
                  type="text" 
                  value={formData.address.pinCode}
                  onChange={(e) => updateForm('address', 'pinCode', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  maxLength={6}
                  className="input-field"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Bank Verification</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
                This account will be used to receive your sales payouts.
              </p>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Account Holder Name</label>
                <input 
                  type="text" 
                  value={formData.bank.accountHolder}
                  onChange={(e) => updateForm('bank', 'accountHolder', e.target.value)}
                  placeholder="Name on bank account"
                  className="input-field"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Account Number</label>
                <input 
                  type="password" 
                  value={formData.bank.accountNumber}
                  onChange={(e) => updateForm('bank', 'accountNumber', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter Account Number"
                  className="input-field"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>IFSC Code</label>
                <input 
                  type="text" 
                  value={formData.bank.ifsc}
                  onChange={(e) => updateForm('bank', 'ifsc', e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                  className="input-field"
                />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.isBusiness}
                    onChange={(e) => updateForm('isBusiness', '', e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>I represent a Registered Business</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Requires GSTIN and Business PAN</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 5 && formData.isBusiness && (
            <div className="fade-in">
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Business Details</h2>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Registered Business Name *</label>
                <input 
                  type="text" 
                  value={formData.business.businessName}
                  onChange={(e) => updateForm('business', 'businessName', e.target.value)}
                  placeholder="Company/LLP/Firm Name"
                  className="input-field"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Business PAN *</label>
                <input 
                  type="text" 
                  value={formData.business.businessPan}
                  onChange={(e) => updateForm('business', 'businessPan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="input-field"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>GSTIN (Optional)</label>
                <input 
                  type="text" 
                  value={formData.business.gstin}
                  onChange={(e) => updateForm('business', 'gstin', e.target.value.toUpperCase())}
                  placeholder="15 digits GSTIN"
                  maxLength={15}
                  className="input-field"
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Review & Submit</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Please review your details. We use end-to-end encryption to securely store your sensitive data.</p>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Name</span>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formData.personal.fullName}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>PAN Number</span>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formData.identity.panNumber.replace(/.(?=.{4})/g, '*')}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Bank Account</span>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>XXXX{formData.bank.accountNumber.slice(-4)}</div>
                </div>
                {formData.isBusiness && (
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Business</span>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formData.business.businessName}</div>
                  </div>
                )}
              </div>
              
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.5, display: 'flex', gap: 8 }}>
                <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>I confirm that the details provided above are true and accurate. I consent to having this information verified by Lendly partners.</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            {step < 6 ? (
              <button onClick={handleNext} className="btn-primary" style={{ flex: 1, padding: '14px', borderRadius: 14, fontSize: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                Continue <ArrowRight size={18} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '14px', borderRadius: 14, fontSize: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                {saving ? <><Loader2 size={18} className="spinner" /> Submitting...</> : <><CheckCircle2 size={18} /> Submit Application</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
