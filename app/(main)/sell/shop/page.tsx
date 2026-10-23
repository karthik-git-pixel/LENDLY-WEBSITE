'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from '@/components/AppImage';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Camera, Eye, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useUserLocation } from '@/lib/location-context';
import { hasPoint, updateUserProfile, type GeoPoint, type UserProfile } from '@/lib/supabase-db';
import { uploadImage } from '@/lib/upload';
import { CATEGORIES, shopMainCategory } from '@/lib/catalog';
import { getOpenState } from '@/lib/store-hours';
import { kycSubmitted } from '@/lib/kyc';
import LocationPicker, { hasAddressDetails } from '@/components/listing/LocationPicker';
import { avatarFor } from '@/components/AppHeader';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_SPECIALITIES = 4;

export default function ShopSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ShopSettings />
    </Suspense>
  );
}

function ShopSettings() {
  const router = useRouter();
  const onboarding = useSearchParams().get('onboarding') === '1';
  const { user, profile, loading } = useAuth();
  const allowed = Boolean(profile && kycSubmitted(profile));

  // Shops come after identity verification
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login?redirect=/sell/shop');
    else if (profile && !kycSubmitted(profile)) router.replace('/sell/onboarding');
  }, [loading, user, profile, router]);

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" aria-label="Back" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>{onboarding ? 'Set up your shop' : 'Shop settings'}</h1>
        {profile && !onboarding
          ? <Link href={`/seller/${profile.uid}`} className="ln-icon-btn" aria-label="View your shop" title="View your shop"><Eye size={19} /></Link>
          : <span style={{ width: 44 }} />}
      </div>
      <div className="ln-shell ss-shell">
        {profile && allowed
          ? <ShopForm profile={profile} onboarding={onboarding} />
          : <div className="ln-skel" style={{ height: 420, borderRadius: 20, marginTop: 12 }} />}
      </div>
    </div>
  );
}

function ShopForm({ profile, onboarding }: { profile: UserProfile; onboarding: boolean }) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { coords, address: hereAddress } = useUserLocation();

  const startCategory = shopMainCategory(profile.storeCategory);
  const [name, setName] = useState(profile.storeName || '');
  const [categoryId, setCategoryId] = useState(startCategory?.id || '');
  const [specialities, setSpecialities] = useState<string[]>(() => {
    const parts = (profile.storeCategory || '').split(',').map(s => s.trim());
    return startCategory ? startCategory.subcategories.filter(s => parts.includes(s)) : [];
  });
  const [description, setDescription] = useState(profile.storeDescription || '');
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl || '');
  const [logoUrl, setLogoUrl] = useState(profile.avatarUrl || '');
  const [place, setPlace] = useState<GeoPoint | null>(
    hasPoint(profile.storeLocation) ? profile.storeLocation : hasPoint(profile.location) ? profile.location : null
  );
  // New shops start with typical hours; existing ones keep their choice
  const [showHours, setShowHours] = useState(Boolean(profile.storeHours) || !profile.storeName);
  const [opens, setOpens] = useState(profile.storeHours?.open || '10:00');
  const [closes, setCloses] = useState(profile.storeHours?.close || '20:00');
  const [closedDays, setClosedDays] = useState<number[]>(profile.storeHours?.closed_days || []);
  const [uploading, setUploading] = useState<'cover' | 'avatar' | null>(null);
  const [saving, setSaving] = useState(false);

  const category = CATEGORIES.find(c => c.id === categoryId);
  // What shop cards show, and what decides which rentals fit the shop page
  const label = specialities.length ? specialities.join(', ') : category?.name || '';
  const hours = showHours ? { open: opens, close: closes, closed_days: closedDays } : null;
  const openState = hours && opens && closes && opens !== closes ? getOpenState(hours) : null;

  const pickImage = async (file: File | undefined, kind: 'cover' | 'avatar') => {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadImage(file, profile.uid, kind);
      if (kind === 'cover') setCoverUrl(url);
      else setLogoUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const toggleSpeciality = (sub: string) => {
    if (specialities.includes(sub)) setSpecialities(specialities.filter(s => s !== sub));
    else if (specialities.length >= MAX_SPECIALITIES) toast(`Pick up to ${MAX_SPECIALITIES} — the ones you rent most`);
    else setSpecialities([...specialities, sub]);
  };

  const toggleDay = (day: number) =>
    setClosedDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('Give your shop a name');
    if (!category) return toast.error('Choose what you rent out');
    if (!place || !hasPoint(place)) return toast.error('Set your shop’s pickup location');
    if (!hasAddressDetails(place)) return toast.error('Enter your shop’s full address');
    if (hours && (!opens || !closes || opens === closes)) return toast.error('Set different opening and closing times');
    if (hours && closedDays.length >= 7) return toast.error('Pick at least one day you’re open');

    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        isSeller: true,
        storeName: name.trim(),
        storeCategory: label,
        storeDescription: description.trim(),
        storeLocation: { ...place, details: place.details!.trim() },
        storeHours: hours,
        coverUrl,
        avatarUrl: logoUrl,
      });
      await refreshProfile();
      toast.success(onboarding ? 'Your shop is ready — now add your first rental' : 'Shop updated');
      router.push(onboarding ? '/sell/new' : '/sell');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save your shop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <section className="lf-section">
        <div className="ss-banner">
          {coverUrl ? (
            <Image src={coverUrl} alt="Shop banner" fill sizes="(max-width: 760px) 100vw, 760px" priority />
          ) : (
            <div className="ss-banner-empty">
              <ImagePlus size={26} aria-hidden="true" />
              <span>Add a banner — your shop front, your best gear or your team at work</span>
            </div>
          )}
          {uploading === 'cover' && <div className="ss-uploading"><Loader2 size={24} className="ln-spin" aria-label="Uploading banner" /></div>}
          <div className="ss-banner-actions">
            {coverUrl && (
              <button type="button" className="ss-pill" onClick={() => setCoverUrl('')} disabled={Boolean(uploading)}>
                <Trash2 size={14} aria-hidden="true" /> Remove
              </button>
            )}
            <label className="ss-pill">
              <input type="file" accept="image/*" hidden disabled={Boolean(uploading)}
                onChange={e => { void pickImage(e.target.files?.[0], 'cover'); e.target.value = ''; }} />
              <Camera size={14} aria-hidden="true" /> {coverUrl ? 'Change banner' : 'Add banner'}
            </label>
          </div>
        </div>

        <div className="ss-identity">
          <div className="ss-logo">
            <span className="ss-logo-img">
              <Image src={avatarFor(name || profile.displayName, logoUrl)} alt="Shop logo" fill sizes="84px" unoptimized />
              {uploading === 'avatar' && <span className="ss-uploading"><Loader2 size={20} className="ln-spin" aria-label="Uploading logo" /></span>}
            </span>
            <label className="ss-logo-btn" title="Change logo">
              <input type="file" accept="image/*" hidden disabled={Boolean(uploading)} aria-label="Change shop logo"
                onChange={e => { void pickImage(e.target.files?.[0], 'avatar'); e.target.value = ''; }} />
              <Camera size={14} aria-hidden="true" />
            </label>
          </div>
          <div className="ss-identity-text">
            <strong>{name.trim() || 'Your shop name'}</strong>
            <span>{label || 'What you rent out'}</span>
          </div>
        </div>
        <p className="ln-note">A wide banner works best (about 1400 × 600). Your logo is square and also becomes your profile picture.</p>
      </section>

      <section className="lf-section">
        <h2>Shop details</h2>
        <label className="pd-field">
          <span>Shop name</span>
          <input className="ln-input" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Beat Box Sound & Lights" />
        </label>
        <label className="pd-field">
          <span>What do you rent out?</span>
          <select className="ln-input" value={categoryId} onChange={e => { setCategoryId(e.target.value); setSpecialities([]); }}>
            <option value="">Choose a category</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {category && category.subcategories.length > 0 && (
          <div className="pd-field">
            <span>Your specialities <em>(optional, up to {MAX_SPECIALITIES})</em></span>
            <div className="ln-chip-wrap">
              {category.subcategories.map(sub => (
                <button key={sub} type="button" className="ln-chip" aria-pressed={specialities.includes(sub)} onClick={() => toggleSpeciality(sub)}>{sub}</button>
              ))}
            </div>
          </div>
        )}
        {label && <p className="ln-note">Shop cards will show <strong>{label}</strong>. Your shop page lists the rentals that fit it.</p>}
        <label className="pd-field">
          <span>About your shop <em>(optional)</em></span>
          <textarea className="ln-input" rows={4} maxLength={500} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What you rent, delivery or setup you offer, anything renters should know…" />
        </label>
      </section>

      <section className="lf-section">
        <h2>Pickup location</h2>
        <LocationPicker
          value={place}
          fallback={{ lat: coords.lat, lng: coords.lng, address: hereAddress }}
          onChange={setPlace}
          extra={hasPoint(profile.location) && (
            <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => setPlace(profile.location)}>Use my saved address</button>
          )}
        />
        <p className="ln-note">Renters see this on the map, with the distance from them and directions.</p>
      </section>

      <section className="lf-section">
        <h2>Opening hours</h2>
        <label className="ln-check">
          <input type="checkbox" checked={showHours} onChange={e => setShowHours(e.target.checked)} />
          <span>Show opening hours on my shop</span>
        </label>
        {showHours && (
          <>
            <div className="pd-field-row">
              <label className="pd-field"><span>Opens</span><input className="ln-input" type="time" value={opens} onChange={e => setOpens(e.target.value)} /></label>
              <label className="pd-field"><span>Closes</span><input className="ln-input" type="time" value={closes} onChange={e => setCloses(e.target.value)} /></label>
            </div>
            <div className="pd-field">
              <span>Open on</span>
              <div className="ln-chip-wrap">
                {DAYS.map((day, i) => (
                  <button key={day} type="button" className="ln-chip" aria-pressed={!closedDays.includes(i)} onClick={() => toggleDay(i)}>{day}</button>
                ))}
              </div>
            </div>
            {openState && (
              <p className="ss-hours-preview">
                Right now renters would see: <strong className={openState.open ? 'ln-open' : ''}>{openState.label}</strong>
              </p>
            )}
          </>
        )}
      </section>

      <div className="lf-submit">
        {!onboarding && <Link href={`/seller/${profile.uid}`} className="ln-btn ln-btn-ghost"><Eye size={16} aria-hidden="true" /> Preview</Link>}
        <button type="submit" className="ln-btn ln-btn-primary" style={{ flex: 1 }} disabled={saving || Boolean(uploading)}>
          {saving ? <><Loader2 size={18} className="ln-spin" aria-hidden="true" /> Saving…</> : onboarding ? 'Save and add a rental' : 'Save shop'}
        </button>
      </div>
    </form>
  );
}
