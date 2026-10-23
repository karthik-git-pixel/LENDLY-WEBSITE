'use client';

import Image from '@/components/AppImage';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateUserProfile } from '@/lib/firestore';
import { uploadImage } from '@/lib/upload';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  Package, 
  Store, 
  LogOut, 
  ChevronRight, 
  Bell, 
  MapPin, 
  Sparkles, 
  ShieldCheck, 
  BadgeCheck,
  Edit3, 
  X, 
  Check, 
  Phone, 
  User as UserIcon, 
  Camera,
  Heart,
  QrCode,
  CreditCard,
  Upload,
  Loader2,
  Globe,
  Printer,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language-context';
import { LANGUAGES } from '@/lib/i18n';
import LanguageSelectorModal from '@/components/LanguageSelectorModal';

// 6 Default Vector Avatars
const DEFAULT_AVATARS = [
  { id: 'avatar_1', name: 'Fox Vector', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=f38181' },
  { id: 'avatar_2', name: 'Cat Vector', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Luna&backgroundColor=95e1d3' },
  { id: 'avatar_3', name: 'Puppy Vector', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Milo&backgroundColor=fce38a' },
  { id: 'avatar_4', name: 'Bear Vector', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bear&backgroundColor=eaffd0' },
  { id: 'avatar_5', name: 'Robot Vector', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RadiusBot&backgroundColor=a855f7' },
  { id: 'avatar_6', name: 'Astro Vector', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astro&backgroundColor=3b82f6' },
];

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const router = useRouter();

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/profile');
    }
  }, [user, authLoading, router]);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || DEFAULT_AVATARS[0].url);
  const [isPrintProvider, setIsPrintProvider] = useState(profile?.isPrintProvider || false);
  const [printPriceBW, setPrintPriceBW] = useState(profile?.printPriceBW?.toString() || '2');
  const [printPriceColor, setPrintPriceColor] = useState(profile?.printPriceColor?.toString() || '10');
  const [printStoreName, setPrintStoreName] = useState(profile?.printStoreName || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const handleOpenEdit = () => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatarUrl || DEFAULT_AVATARS[0].url);
      setIsPrintProvider(profile.isPrintProvider || false);
      setPrintPriceBW(profile.printPriceBW?.toString() || '2');
      setPrintPriceColor(profile.printPriceColor?.toString() || '10');
      setPrintStoreName(profile.printStoreName || '');
    }
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!displayName.trim()) return toast.error('Please enter a display name');

    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        displayName: displayName.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
        isPrintProvider,
        printPriceBW: parseFloat(printPriceBW) || 2,
        printPriceColor: parseFloat(printPriceColor) || 10,
        printStoreName: printStoreName.trim(),
      });

      await refreshProfile();
      toast.success('Profile updated successfully! ✨');
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  const menuItems = [
    { icon: ShoppingBag, label: 'My Orders & Rentals', href: '/profile/orders', subtitle: 'Track purchases, rentals & direct handovers' },
    { icon: FileText, label: 'My Print Orders', href: '/print/orders', subtitle: 'Track document print jobs & doorstep drops' },
    { icon: Printer, label: 'Hyperlocal Print Hub', href: '/print', subtitle: profile.isPrintProvider ? 'Print Hub Active • Offer doorstep prints' : 'Order prints or offer local Xerox services' },
    { icon: Heart, label: 'Saved Wishlist Items', href: '/profile/saved', subtitle: `${profile.savedProducts?.length || 0} bookmarked items` },
    ...(profile.isSeller ? [
      { icon: Package, label: 'Seller hub', href: '/sell', subtitle: 'Listings, booking requests & earnings' },
      { icon: Store, label: 'My shop', href: '/sell/shop', subtitle: 'Banner, logo, location & opening hours' },
    ] : [
      { icon: Store, label: 'Rent out on Lendly', href: '/sell/onboarding', subtitle: 'Verify your ID, set up a shop, start earning' },
    ]),
    {
      icon: BadgeCheck,
      label: 'Identity verification',
      href: '/sell/verify',
      subtitle: profile.kycStatus === 'VERIFIED' ? 'Verified'
        : profile.kycStatus === 'PENDING_VERIFICATION' ? 'Under review'
        : profile.kycStatus === 'REJECTED' || profile.kycStatus === 'ACTION_REQUIRED' ? 'Needs attention — tap to fix'
        : 'Needed before you rent out',
    },
    ...(profile.isAdmin ? [
      { icon: ShieldCheck, label: 'Review lender verifications', href: '/admin/kyc', subtitle: 'Admin · approve IDs and selfies' },
    ] : []),
    { icon: Bell, label: 'Notifications', href: '/notifications', subtitle: 'Alerts & order updates' },
    { icon: MapPin, label: 'Location Settings', href: '/profile/location', subtitle: profile.location?.address?.split(',')[0] || 'Set your location' },
  ];

  return (
    <div className="fade-in">
      <div className="top-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>My Account</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Manage profile & transactions</p>
        </div>
        <button onClick={handleOpenEdit} className="btn-secondary" style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13 }}>
          <Edit3 size={15} /> Edit Profile
        </button>
      </div>

      <div className="page-container">
        {/* Profile Card */}
        <div className="glass-card" style={{ padding: 24, textAlign: 'center', marginBottom: 20, position: 'relative' }}>
          <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto 12px' }}>
            <Image
              src={profile.avatarUrl || DEFAULT_AVATARS[0].url}
              alt={profile.displayName}
              className="avatar-xl"
              width={84}
              height={84}
              unoptimized
              style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-light)' }}
            />
            <button
              onClick={handleOpenEdit}
              title="Change Profile Picture"
              style={{
                position: 'absolute', bottom: 2, right: 2, background: 'var(--primary)', color: 'white',
                border: '2px solid white', borderRadius: '50%', width: 28, height: 28, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Camera size={14} />
            </button>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, lineHeight: 1 }}>
            {profile.displayName}
            {profile.kycStatus === 'VERIFIED' && <span title="Verified User" style={{ display: 'flex' }}><BadgeCheck size={20} style={{ color: '#10b981', transform: 'translateY(-1px)' }} /></span>}
            {profile.isSeller && <span title="Lender on Lendly" style={{ display: 'flex' }}><Store size={19} style={{ color: 'var(--primary)', transform: 'translateY(-1px)' }} /></span>}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4, fontWeight: 500 }}>{profile.email}</p>
          
          {profile.phone && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--foreground)', fontSize: 14, fontWeight: 700, marginTop: 6 }}>
              <Phone size={14} style={{ color: 'var(--primary)', transform: 'translateY(-1px)' }} /> {profile.phone}
            </div>
          )}

          {profile.isSeller && (
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-primary" style={{ padding: '6px 14px', fontSize: 11, gap: 4 }}>
                <Store size={13} style={{ transform: 'translateY(-1px)' }} /> Store: {profile.storeName || 'Local Seller'}
              </span>
            </div>
          )}
        </div>


        {/* Mobile Quick Tools (QR & Scanner) */}
        <div className="glass-card mobile-only" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Quick Tools
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Link href="/scan" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 16,
                background: 'var(--surface-hover)', border: '1px solid var(--border-color)', color: 'var(--foreground)',
                fontWeight: 600, fontSize: 12, textAlign: 'center', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <span>Scan Product QR</span>
              </div>
            </Link>

            <Link href="/qr" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 16,
                background: 'var(--surface-hover)', border: '1px solid var(--border-color)', color: 'var(--foreground)',
                fontWeight: 600, fontSize: 12, textAlign: 'center', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <span>My Profile QR</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Menu Items */}
        <div className="glass-card" style={{ overflow: 'hidden', marginBottom: 20 }}>
          {menuItems.map((item, i) => (
            <Link key={item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
              borderBottom: i < menuItems.length - 1 ? '1px solid var(--border-color)' : 'none',
              textDecoration: 'none', color: 'var(--foreground)',
              transition: 'background 0.2s',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(243,129,129,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
              }}>
                <item.icon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{item.label}</div>
                {item.subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.subtitle}</div>}
              </div>
              <ChevronRight size={18} style={{ color: 'var(--muted)' }} />
            </Link>
          ))}

          {/* Select Language Option */}
          <div
            onClick={() => setShowLanguageModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
              cursor: 'pointer', transition: 'background 0.2s', color: 'var(--foreground)',
              borderTop: '1px solid var(--border-color)'
            }}
            className="hover-scale"
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(22, 163, 74,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary-dark)',
            }}>
              <Globe size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{t('language')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {currentLang.flag} {currentLang.nativeName} ({currentLang.name})
              </div>
            </div>
            <span className="badge badge-primary" style={{ fontSize: 11, padding: '3px 8px' }}>
              Change
            </span>
          </div>
        </div>

        {/* Legal & Policy Links (Razorpay Compliance) */}
        <div className="glass-card" style={{ overflow: 'hidden', marginBottom: 20, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Legal & Support Policies
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, fontWeight: 600 }}>
            <Link href="/terms" style={{ color: 'var(--foreground)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Terms and Conditions</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>
            <div style={{ borderBottom: '1px solid var(--border-color)' }} />
            <Link href="/privacy" style={{ color: 'var(--foreground)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Privacy Policy</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>
            <div style={{ borderBottom: '1px solid var(--border-color)' }} />
            <Link href="/shipping" style={{ color: 'var(--foreground)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Shipping & Delivery Policy</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>
            <div style={{ borderBottom: '1px solid var(--border-color)' }} />
            <Link href="/refunds" style={{ color: 'var(--foreground)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cancellation and Refunds</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>
            <div style={{ borderBottom: '1px solid var(--border-color)' }} />
            <Link href="/contact" style={{ color: 'var(--foreground)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Contact Us</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-danger" style={{ width: '100%', padding: 14, borderRadius: 16 }}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>Edit Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Avatar Selector Grid */}
              <div>
                <label className="input-label" style={{ marginBottom: 10 }}>Choose Profile Picture (Vector PNGs):</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                  {DEFAULT_AVATARS.map((av) => {
                    const isSelected = avatarUrl === av.url;
                    return (
                      <div
                        key={av.id}
                        onClick={() => setAvatarUrl(av.url)}
                        style={{
                          padding: 8, borderRadius: 16, border: isSelected ? '3px solid var(--primary)' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(243,129,129,0.08)' : 'var(--surface)', cursor: 'pointer',
                          textAlign: 'center', transition: 'all 0.2s', position: 'relative'
                        }}
                      >
                        <Image
                          src={av.url}
                          alt={av.name}
                          width={60}
                          height={60}
                          unoptimized
                          style={{ borderRadius: '50%', margin: '0 auto 4px', objectFit: 'cover' }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', display: 'block' }}>
                          {av.name}
                        </span>
                        {isSelected && (
                          <div style={{
                            position: 'absolute', top: 4, right: 4, background: 'var(--primary)',
                            color: 'white', borderRadius: '50%', width: 18, height: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Gallery Upload Option */}
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="file"
                    id="profile-gallery-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !profile?.uid) return;
                      try {
                        setUploadingAvatar(true);
                        const url = await uploadImage(file, profile.uid, 'avatar');
                        setAvatarUrl(url);
                        toast.success('Photo uploaded from gallery!');
                      } catch (err: unknown) {
                        console.error(err);
                        const msg = err instanceof Error ? err.message : 'Failed to upload photo';
                        toast.error(msg);
                      } finally {
                        setUploadingAvatar(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('profile-gallery-upload')?.click()}
                    disabled={uploadingAvatar}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: '2px dashed var(--primary)',
                      background: 'rgba(22, 163, 74, 0.08)',
                      color: 'var(--primary)',
                      fontSize: 13,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 size={18} className="spinner" /> Uploading Photo...
                      </>
                    ) : (
                      <>
                        <Upload size={18} /> Upload Photo from Gallery
                      </>
                    )}
                  </button>
                </div>

                {/* Custom Image URL fallback */}
                <input
                  type="text"
                  className="input-field"
                  placeholder="Or enter custom Image URL..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  style={{ fontSize: 12 }}
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="input-label">Display Name *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="input-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Shop details have their own page */}
              {profile.isSeller && (
                <p className="ln-note" style={{ margin: 0 }}>
                  Shop name, banner, location and hours are in <Link href="/sell/shop" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>Shop settings</Link>.
                </p>
              )}

              {/* Print Service Provider Section */}
              <div style={{
                marginTop: 10,
                padding: '16px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(255, 255, 255, 0.9) 100%)',
                border: '1px solid rgba(22, 163, 74, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPrintProvider ? 14 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: '#15803d' }}><Printer size={20} /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>Offer Print & Xerox Services</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Fulfill print orders for local neighbors</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPrintProvider}
                    onChange={(e) => setIsPrintProvider(e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>

                {isPrintProvider && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(22, 163, 74, 0.3)' }}>
                    <div>
                      <label className="input-label">Print Hub / Store Name</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Quick Print & Xerox Hub"
                        value={printStoreName}
                        onChange={(e) => setPrintStoreName(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="input-label">B&W Rate (₹/page)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          className="input-field"
                          placeholder="2"
                          value={printPriceBW}
                          onChange={(e) => setPrintPriceBW(e.target.value)}
                          style={{ fontSize: 13, fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label className="input-label">Color Rate (₹/page)</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          className="input-field"
                          placeholder="10"
                          value={printPriceColor}
                          onChange={(e) => setPrintPriceColor(e.target.value)}
                          style={{ fontSize: 13, fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: 12 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Language Selector Modal */}
      <LanguageSelectorModal isOpen={showLanguageModal} onClose={() => setShowLanguageModal(false)} />
    </div>
  );
}
