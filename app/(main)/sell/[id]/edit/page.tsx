'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createProduct, getProduct, updateProduct, notifyStockAvailable, type Product } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, X, Save, Link as LinkIcon } from 'lucide-react';

const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Furniture', 'Sports', 'Stationery', 'Food', 'Services', 'Other'];

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [type, setType] = useState<'sell' | 'rent'>('sell');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const isRelisting = product?.status !== 'available';

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      const p = await getProduct(id);
      if (!p || cancelled) return;

      setProduct(p);
      setTitle(p.title);
      setDescription(p.description);
      setPrice(String(p.price));
      setReferenceUrl(p.referenceUrl || '');
      setCategory(p.category);
      setType(p.listingType === 'rent' ? 'rent' : 'sell');
      setExistingImages(p.images || []);
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!title.trim() || !price) return toast.error('Title and price required');
    setLoading(true);
    try {
      const productPayload = {
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        sellerAvatar: product.sellerAvatar,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        referenceUrl: referenceUrl.trim() || undefined,
        category,
        images: existingImages,
        listingType: (type === 'rent' ? 'rent' : 'sale') as 'sale' | 'rent',
        rentPricePerDay: type === 'rent' ? Number(price) : undefined,
        status: 'available' as const,
        location: product.location,
      };

      if (isRelisting) {
        await createProduct(productPayload);
        void notifyStockAvailable(id, product.title);
        toast.success('New listing created from the sold item.');
      } else {
        await updateProduct(id, productPayload);
        if (product.status !== 'available' && productPayload.status === 'available') {
          void notifyStockAvailable(id, product.title);
        }
        toast.success('Product updated!');
      }
      router.push('/sell');
    } catch (err) {
      toast.error(getErrorMessage(err, isRelisting ? 'Failed to create relisted product' : 'Failed to update product'));
    } finally { setLoading(false); }
  };

  if (!product) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>;

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{isRelisting ? 'Relist Product' : 'Edit Product'}</h1>
        <div style={{ width: 36 }} />
      </div>
      <div className="page-container">
        {isRelisting && (
          <div className="glass-card" style={{ padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
            This item is already {product.status}. Saving here will create a new available listing and keep the original record unchanged.
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Images</label>
            <div className="image-upload-grid">
              {existingImages.map((url, i) => (
                <div key={i} className="image-upload-card">
                  <Image src={url} alt="" width={120} height={120} unoptimized />
                  <button type="button" className="image-upload-remove-btn" onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))} title="Remove photo">
                    <X size={13} />
                  </button>
                  {i === 0 && <span className="image-upload-cover-badge">Cover</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Title *</label>
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Description</label>
            <textarea className="input-field" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Price (₹)</label>
            <input className="input-field" type="number" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
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
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Category</label>
            <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }} disabled={loading}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Save size={16} /> {isRelisting ? 'Create New Listing' : 'Save Changes'}</>}
          </button>
        </form>
      </div>
    </div>
  );
}
