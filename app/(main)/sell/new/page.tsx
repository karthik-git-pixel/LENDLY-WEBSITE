'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createProduct } from '@/lib/firestore';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { getErrorMessage } from '@/lib/error-utils';
import { getCurrentLocation } from '@/lib/location';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Camera, X, Upload, Plus, Link as LinkIcon } from 'lucide-react';

const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Furniture', 'Sports', 'Stationery', 'Food', 'Services', 'Other'];

export default function NewProductPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/sell/new');
    }
  }, [user, authLoading, router]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [type, setType] = useState<'sell' | 'rent'>('sell');
  const [rentalDuration, setRentalDuration] = useState('7');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) return toast.error('Max 5 images');
    setImages(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !price) return toast.error('Title and price are required');
    if (images.length === 0) return toast.error('Add at least one image');

    setLoading(true);
    try {
      // Fast concurrent uploads
      const urls = await Promise.all(
        images.map(img => uploadImageToCloudinary(img, profile.uid, 'products'))
      );

      let loc;
      try { loc = await getCurrentLocation(); } catch {
        loc = { lat: profile.location.lat, lng: profile.location.lng };
      }

      await createProduct({
        sellerId: profile.uid,
        sellerName: profile.storeName || profile.displayName,
        sellerAvatar: profile.avatarUrl || '',
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        referenceUrl: referenceUrl.trim() || undefined,
        category,
        images: urls,
        listingType: type === 'rent' ? 'rent' : 'sale',
        ...(type === 'rent' ? { rentPricePerDay: Number(price) } : {}),
        status: 'available',
        location: { lat: loc.lat, lng: loc.lng, address: profile.location?.address || 'Local' },
      });

      toast.success('Product listed! 🎉');
      router.push('/sell');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create product'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Add Product</h1>
        <div style={{ width: 36 }} />
      </div>
      <div className="page-container" style={{ paddingBottom: 40 }}>
        <form onSubmit={handleSubmit}>
          {/* Images */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="input-label" style={{ margin: 0 }}>Photos (max 5)</label>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{previews.length} / 5 Uploaded</span>
            </div>
            <div className="image-upload-grid">
              {previews.map((p, i) => (
                <div key={i} className="image-upload-card">
                  <Image src={p} alt="" width={120} height={120} unoptimized />
                  <button type="button" className="image-upload-remove-btn" onClick={() => removeImage(i)} title="Remove photo">
                    <X size={13} />
                  </button>
                  {i === 0 && <span className="image-upload-cover-badge">Cover</span>}
                </div>
              ))}
              {previews.length < 5 && (
                <label className="image-upload-add-card">
                  <input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} />
                  <div className="image-upload-add-icon">
                    <Plus size={18} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, marginTop: 2 }}>Add Photo</span>
                </label>
              )}
            </div>
          </div>

          {/* Type */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Listing Type</label>
            <div className="tab-bar">
              <button type="button" className={`tab-item ${type === 'sell' ? 'active' : ''}`} onClick={() => setType('sell')}>Sell</button>
              <button type="button" className={`tab-item ${type === 'rent' ? 'active' : ''}`} onClick={() => setType('rent')}>Rent</button>
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Title *</label>
            <input className="input-field" placeholder="What are you selling?" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Description</label>
            <textarea className="input-field" placeholder="Describe your item, condition, etc." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Price */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">{type === 'rent' ? 'Price per day (₹) *' : 'Price (₹) *'}</label>
            <input className="input-field" type="number" min="1" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} />
          </div>

          {/* Product Reference Link (Optional) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="input-label" style={{ margin: 0 }}>Product Reference Link (Optional)</label>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Amazon, Flipkart, etc.</span>
            </div>
            <div style={{ position: 'relative' }}>
              <LinkIcon size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 42 }}
                type="url"
                placeholder="e.g. https://www.amazon.in/dp/B08N5WRWNW or Flipkart link"
                value={referenceUrl}
                onChange={e => setReferenceUrl(e.target.value)}
              />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
              Paste an online store URL to help buyers verify the exact product, original price, or technical specs.
            </p>
          </div>

          {/* Rental duration */}
          {type === 'rent' && (
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Default rental duration (days)</label>
              <input className="input-field" type="number" min="1" value={rentalDuration} onChange={e => setRentalDuration(e.target.value)} />
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Category</label>
            <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Uploading...</> : <><Upload size={16} /> List Product</>}
          </button>
        </form>
      </div>
    </div>
  );
}
