'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getProduct, toggleSavedProduct, type Product } from '@/lib/firestore';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, MapPin, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SavedPage() {
  const { profile, toggleSaved } = useAuth();
  const router = useRouter();
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.savedProducts) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const ids = profile?.savedProducts || [];
        const items = await Promise.all(ids.map(id => getProduct(id)));
        const valid = items.filter((p): p is Product => p !== null && p.status === 'available');
        if (!cancelled) {
          setSavedProducts(valid);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [profile?.savedProducts]);

  const handleRemove = async (productId: string) => {
    if (!profile) return;
    // Instant optimistic removal from screen
    setSavedProducts(prev => prev.filter(p => p.id !== productId));
    toast.success('Removed from wishlist');
    try {
      await toggleSaved(productId);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update wishlist');
    }
  };

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Saved Wishlist</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : savedProducts.length === 0 ? (
          <div className="empty-state">
            <Heart size={48} style={{ color: 'var(--muted)' }} />
            <h3>Your Wishlist is Empty</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Tap the heart icon on any product to save it here for quick access.</p>
            <Link href="/home" className="btn-primary" style={{ marginTop: 16, display: 'inline-flex', padding: '10px 20px', borderRadius: 999 }}>
              Explore Nearby Products
            </Link>
          </div>
        ) : (
          <div className="product-grid">
            {savedProducts.map(p => (
              <div key={p.id} className="product-card" onClick={() => router.push(`/product/${p.id}`)}>
                <div style={{ position: 'relative', width: '100%', height: '190px', overflow: 'hidden' }}>
                  <Image
                    src={p.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=60'}
                    alt={p.title}
                    className="product-card-image"
                    width={400}
                    height={300}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    unoptimized
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(p.id);
                    }}
                    style={{
                      position: 'absolute', top: 10, right: 10, width: 32, height: 32,
                      borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)', color: 'var(--danger)'
                    }}
                    title="Remove from saved"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="product-card-body">
                  <div className="product-card-title">{p.title}</div>
                  {p.sellerName && (
                    <div style={{ fontSize: 11.5, color: '#64748b', opacity: 0.8, fontWeight: 500, marginTop: 1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.sellerName}
                    </div>
                  )}
                  <div className="product-card-price" style={{ color: 'var(--primary-dark)', fontWeight: 800, marginTop: 4 }}>
                    ₹{p.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} style={{ color: 'var(--primary)' }} />
                    <span>{p.location?.address?.split(',')[0] || 'Nearby'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
