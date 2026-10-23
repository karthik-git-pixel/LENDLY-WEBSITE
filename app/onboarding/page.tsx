'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createUserProfile } from '@/lib/firestore';
import { getCurrentLocation } from '@/lib/location';
import { uploadImage } from '@/lib/upload';
import { getErrorMessage } from '@/lib/error-utils';
import toast from 'react-hot-toast';
import {
  Store, Camera, ArrowRight, ArrowLeft, Check, Navigation,
  Gift, MapPin, UserCheck, User, Phone, ShoppingBag,
  CheckCircle2, ShieldCheck, ChevronDown
} from 'lucide-react';

const COUNTRIES = [
  { code: '+91', name: 'India', flag: '🇮🇳', length: 10, placeholder: '98123 45678' },
  { code: '+1', name: 'United States / Canada', flag: '🇺🇸', length: 10, placeholder: '202 555 0123' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', length: 10, placeholder: '7911 123456' },
  { code: '+971', name: 'UAE', flag: '🇦🇪', length: 9, placeholder: '50 123 4567' },
  { code: '+61', name: 'Australia', flag: '🇦🇺', length: 9, placeholder: '412 345 678' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', length: 9, placeholder: '50 123 4567' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', length: 8, placeholder: '8123 4567' },
  { code: '+49', name: 'Germany', flag: '🇩🇪', length: 11, placeholder: '151 12345678' },
  { code: '+33', name: 'France', flag: '🇫🇷', length: 9, placeholder: '6 12 34 56 78' },
  { code: '+81', name: 'Japan', flag: '🇯🇵', length: 10, placeholder: '90 1234 5678' },
  { code: '+86', name: 'China', flag: '🇨🇳', length: 11, placeholder: '138 1234 5678' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', length: 10, placeholder: '300 1234567' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', length: 10, placeholder: '1712 345678' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', length: 10, placeholder: '9841 234567' },
];

export default function OnboardingPage() {
  const { user, refreshProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.photoURL || '');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/onboarding');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.displayName && !displayName) {
      setDisplayName(user.displayName);
    }
    if (user?.photoURL && !avatarPreview) {
      setAvatarPreview(user.photoURL);
    }
  }, [user, displayName, avatarPreview]);
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  // Lenders go on to verify their identity and set up a shop
  const [wantsSeller, setWantsSeller] = useState(false);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleGetLocation = async () => {
    setLocLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json`);
        const data = await res.json();
        if (data.display_name) setAddress(data.display_name);
      } catch {}
      toast.success('Location verified!');
    } catch {
      toast.error('Could not get location. Please enter address manually.');
    } finally {
      setLocLoading(false);
    }
  };

  const validateStep0 = () => {
    if (!displayName.trim()) {
      toast.error('Please enter your full name');
      return false;
    }
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits) {
      toast.error('Please enter your phone number');
      return false;
    }

    if (cleanDigits.length !== selectedCountry.length) {
      toast.error('Please input the correct mobile number');
      return false;
    }

    // Block repeated identical digits like 7777777777 or 9999999999
    if (/^(\d)\1+$/.test(cleanDigits)) {
      toast.error('Please input the correct mobile number');
      return false;
    }

    // Block obvious fake sequential numbers like 9876543210 or 1234567890
    const FAKE_SEQUENCES = ['9876543210', '1234567890', '0123456789', '8765432109'];
    if (FAKE_SEQUENCES.includes(cleanDigits)) {
      toast.error('Please input the correct mobile number');
      return false;
    }

    // Specific rules for Indian mobile numbers (+91)
    if (selectedCountry.code === '+91') {
      // Must start with 6, 7, 8, or 9
      if (!/^[6-9]/.test(cleanDigits)) {
        toast.error('Please input the correct mobile number');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (step === 0) {
      if (!validateStep0()) return;
    } else if (step === 1) {
      if (!location && !address.trim()) {
        return toast.error('Please provide your location or address');
      }
    }
    setStep(step + 1);
  };

  const handleFinish = async () => {
    if (!user) return;
    if (!validateStep0()) return;
    if (!location && !address.trim()) return toast.error('Please provide your location or address');

    setLoading(true);
    try {
      let avatarUrl = avatarPreview || '';
      if (avatarFile) {
        avatarUrl = await uploadImage(avatarFile, user.uid, 'avatar');
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = `${countryCode} ${cleanPhone}`;

      await createUserProfile(user.uid, {
        uid: user.uid,
        email: user.email || '',
        displayName: displayName.trim(),
        avatarUrl,
        phone: fullPhone,
        location: {
          lat: location?.lat || 0,
          lng: location?.lng || 0,
          address: address,
        },
      });

      await refreshProfile();
      toast.success('Welcome to Lendly! 🎉');
      router.push(wantsSeller ? '/sell/onboarding' : '/home');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save profile'));
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ['Profile', 'Location', 'Account Type'];

  const steps = [
    // Step 0: Basic Profile Info
    <div key="basic" className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#16a34a' }}>
          Step 1 of 3
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0b2240', letterSpacing: '-0.4px', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <UserCheck size={24} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>Welcome to Lendly</span>
        </h2>
        <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
          Set up your local identity for renting & renting out
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 28px 0' }}>
        <label style={{ cursor: 'pointer', position: 'relative' }}>
          <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          <div style={{
            padding: 3,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #16a34a, #0b2240)',
            boxShadow: '0 8px 20px -4px rgba(22, 163, 74, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {avatarPreview ? (
              <Image src={avatarPreview} alt="" className="avatar-xl" style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover' }} width={92} height={92} unoptimized />
            ) : (
              <div style={{
                width: 92, height: 92, borderRadius: '50%',
                background: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={36} style={{ color: '#94a3b8' }} />
              </div>
            )}
          </div>
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 32, height: 32, borderRadius: '50%',
            background: '#0b2240', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', color: '#16a34a', border: '2px solid #ffffff'
          }}>
            <Camera size={15} />
          </div>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
          Full Name *
        </label>
        <div style={{ position: 'relative' }}>
          <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
            placeholder="Aldrin Joy"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
          Phone Number *
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Country Selector Dropdown */}
          <div style={{ position: 'relative', minWidth: 110 }}>
            <select
              value={countryCode}
              onChange={e => {
                setCountryCode(e.target.value);
                setPhone('');
              }}
              className="input-field"
              style={{
                height: 48,
                borderRadius: 14,
                fontSize: 13.5,
                fontWeight: 600,
                color: '#0b2240',
                paddingLeft: 12,
                paddingRight: 24,
                appearance: 'none',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>

          {/* Phone Number Input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="tel"
              className="input-field"
              style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
              placeholder={selectedCountry?.placeholder || '98123 45678'}
              value={phone}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '');
                const maxLen = selectedCountry?.length || 10;
                if (digits.length <= maxLen) {
                  setPhone(digits);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>,

    // Step 1: Location Setup
    <div key="location" className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#16a34a' }}>
          Step 2 of 3
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0b2240', letterSpacing: '-0.4px', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <MapPin size={24} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>Your Location</span>
        </h2>
        <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
          We use location to connect you with sellers & products in your radius
        </p>
      </div>

      <button
        onClick={handleGetLocation}
        className="btn-primary"
        style={{
          width: '100%', marginBottom: 16, padding: 14, borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 14, fontWeight: 700, boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
          cursor: 'pointer'
        }}
        disabled={locLoading}
      >
        {locLoading ? (
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
        ) : (
          <><Navigation size={18} /> Auto-Detect My Location</>
        )}
      </button>

      {location && (
        <div style={{
          padding: '12px 16px', marginBottom: 18, borderRadius: 14,
          background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#065f46', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>Location Verified ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</span>
        </div>
      )}

      <div>
        <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
          Address / Area Name *
        </label>
        <div style={{ position: 'relative' }}>
          <MapPin size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
            placeholder="e.g. MG Road, Indiranagar, Bangalore"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>
        <p style={{ color: '#64748b', fontSize: 12, marginTop: 6, fontWeight: 500 }}>
          This displays to nearby buyers and sellers for distance estimates
        </p>
      </div>
    </div>,

    // Step 2: Seller Setup & Account Type Choice
    <div key="seller" className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#16a34a' }}>
          Step 3 of 3
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0b2240', letterSpacing: '-0.4px', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Store size={24} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>Rent out on Lendly?</span>
        </h2>
        <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
          You can start renting out any time from your profile.
        </p>
      </div>

      {/* Segmented Option Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div
          onClick={() => setWantsSeller(false)}
          style={{
            padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
            border: !wantsSeller ? '2px solid #16a34a' : '1px solid #e2e8f0',
            background: !wantsSeller ? 'rgba(22, 163, 74, 0.05)' : '#ffffff',
            boxShadow: !wantsSeller ? '0 4px 14px rgba(22, 163, 74, 0.12)' : 'none',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: !wantsSeller ? '#0b2240' : '#f1f5f9',
            color: !wantsSeller ? '#16a34a' : '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <ShoppingBag size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0b2240' }}>Just Renting</div>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
              Browse and rent gear from shops near you
            </div>
          </div>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: !wantsSeller ? '2px solid #16a34a' : '2px solid #cbd5e1',
            background: !wantsSeller ? '#16a34a' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff'
          }}>
            {!wantsSeller && <Check size={14} strokeWidth={3} />}
          </div>
        </div>

        <div
          onClick={() => setWantsSeller(true)}
          style={{
            padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
            border: wantsSeller ? '2px solid #16a34a' : '1px solid #e2e8f0',
            background: wantsSeller ? 'rgba(22, 163, 74, 0.05)' : '#ffffff',
            boxShadow: wantsSeller ? '0 4px 14px rgba(22, 163, 74, 0.12)' : 'none',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: wantsSeller ? '#16a34a' : '#f1f5f9',
            color: wantsSeller ? '#ffffff' : '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Store size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0b2240' }}>I Want to Rent Out My Items</div>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
              Next: verify your ID and set up your shop
            </div>
          </div>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: wantsSeller ? '2px solid #16a34a' : '2px solid #cbd5e1',
            background: wantsSeller ? '#16a34a' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff'
          }}>
            {wantsSeller && <Check size={14} strokeWidth={3} />}
          </div>
        </div>
      </div>

      {wantsSeller && (
        <div className="fade-in" style={{
          padding: '12px 14px', borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0',
          color: '#14532d', fontSize: 13, fontWeight: 500, lineHeight: 1.45, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
          <span>After this you&apos;ll verify your identity (Aadhaar, an ID photo and a selfie), then set up your shop and add rentals.</span>
        </div>
      )}
    </div>,
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(circle, rgba(22, 163, 74,0.12) 0%, rgba(99,102,241,0.06) 50%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0
      }} />

      <div className="glass-card slide-up" style={{
        maxWidth: 480,
        width: '100%',
        padding: '32px 24px',
        borderRadius: 24,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 20px 45px -15px rgba(11, 34, 64, 0.09), 0 0 0 1px rgba(22, 163, 74, 0.08)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Stepper Progress Bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 999,
                background: i <= step
                  ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                  : '#e2e8f0',
                boxShadow: i <= step ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
            {stepTitles.map((title, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: i === step ? 700 : 500,
                color: i <= step ? '#0b2240' : '#94a3b8'
              }}>
                {title}
              </span>
            ))}
          </div>
        </div>

        {steps[step]}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary"
              style={{
                padding: '12px 20px', borderRadius: 14, fontSize: 14, fontWeight: 600,
                color: '#0b2240', border: '1px solid #e2e8f0', background: '#ffffff',
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <button
            onClick={step < steps.length - 1 ? handleNext : handleFinish}
            className="btn-primary"
            style={{
              flex: 1, padding: '14px 20px', borderRadius: 14, fontSize: 14.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)', cursor: 'pointer'
            }}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : step < steps.length - 1 ? (
              <>Continue <ArrowRight size={18} /></>
            ) : (
              <>Get Started <Check size={18} /></>
            )}
          </button>
        </div>


      </div>
    </div>
  );
}
