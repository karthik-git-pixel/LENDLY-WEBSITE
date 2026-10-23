'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateUserProfile } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Store, Check, MapPin } from 'lucide-react';

export default function BecomeSellerPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!storeName.trim()) return toast.error('Store name is required');
    setLoading(true);
    try {
      await updateUserProfile(profile.uid, {
        isSeller: true,
        storeName: storeName.trim(),
        storeDescription: storeDescription.trim(),
        storeLocation: profile.location,
      });
      await refreshProfile();
      toast.success('Seller account created! 🎉');
      router.push('/sell');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create seller account'));
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Become a Seller</h1>
        <div style={{ width: 36 }} />
      </div>
      <div className="page-container">
        <div className="glass-card" style={{ padding: 24, textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(139,92,246,0.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Store size={32} color="var(--primary-light)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Start Selling</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Set up your store and start listing products
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Store Name *</label>
            <input className="input-field" placeholder="My Awesome Store" value={storeName} onChange={e => setStoreName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Store Description</label>
            <textarea className="input-field" placeholder="What do you sell? Tell buyers about your store..." value={storeDescription} onChange={e => setStoreDescription(e.target.value)} rows={3} />
          </div>
          <div className="glass-card" style={{ padding: 12, marginBottom: 24, fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>Your store location will be set to your current profile location. You can update it later.</span>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }} disabled={loading}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Check size={16} /> Create Seller Account</>}
          </button>
        </form>
      </div>
    </div>
  );
}
