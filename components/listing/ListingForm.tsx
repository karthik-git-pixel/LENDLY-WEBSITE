'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Crosshair, ImagePlus, Loader2, MapPin, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useUserLocation } from '@/lib/location-context';
import { createProduct, deleteProduct, hasPoint, updateProduct, type GeoPoint, type Product } from '@/lib/supabase-db';
import { uploadImage } from '@/lib/upload';
import { reverseGeocode, searchAddress } from '@/lib/location';
import {
  CATEGORIES, RENT_UNITS, SALE_CONDITIONS, SUBCATEGORY_SPEC, rentFeatureOptions, type ListingType, type RentUnit,
} from '@/lib/catalog';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="ln-skel" style={{ height: 200, borderRadius: 14 }} /> });

const MAX_PHOTOS = 8;

interface ListingFormProps {
  kind: ListingType;
  initial?: Product;
}

export default function ListingForm({ kind, initial }: ListingFormProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { coords, address, locate } = useUserLocation();
  const rent = kind === 'rent';
  const editing = Boolean(initial);

  const startCategory = initial?.category || (rent ? 'Event & Sound' : 'Electronics');
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(startCategory);
  const [subcategory, setSubcategory] = useState(initial?.subcategory || '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [originalPrice, setOriginalPrice] = useState(initial?.originalPrice ? String(initial.originalPrice) : '');
  const [condition, setCondition] = useState(initial?.condition || 'Good');
  const [unit, setUnit] = useState<RentUnit>((initial?.rentDuration as RentUnit) || 'day');
  const [deposit, setDeposit] = useState(initial?.securityDeposit ? String(initial.securityDeposit) : '');
  const [minUnits, setMinUnits] = useState(String(initial?.minUnits || 1));
  const [maxUnits, setMaxUnits] = useState(initial?.maxUnits ? String(initial.maxUnits) : '');
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : '');
  const [features, setFeatures] = useState<string[]>(initial?.features || []);
  const [spec, setSpec] = useState(() => Object.values(initial?.attributes || {})[0] || '');
  const [images, setImages] = useState<string[]>(initial?.images || []);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [place, setPlace] = useState<GeoPoint | null>(
    initial && hasPoint(initial.location) ? initial.location
      : profile?.storeLocation && hasPoint(profile.storeLocation) ? profile.storeLocation
      : null
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPoint[]>([]);
  const [active, setActive] = useState(initial ? initial.status !== 'paused' : true);
  const [saving, setSaving] = useState(false);

  const subs = useMemo(() => CATEGORIES.find(c => c.name === category)?.subcategories || [], [category]);
  const specField = SUBCATEGORY_SPEC[subcategory];
  const featureOptions = rentFeatureOptions(subcategory);
  const isVenue = subcategory === 'Halls & Venues';
  const where = place || { lat: coords.lat, lng: coords.lng, address };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - images.length - files.length;
    const picked = Array.from(list).filter(f => f.type.startsWith('image/')).slice(0, room);
    if (picked.length < (list.length || 0)) toast(`Up to ${MAX_PHOTOS} photos`);
    setFiles(prev => [...prev, ...picked.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const useMyLocation = async () => {
    const fix = await locate({ switchToDevice: false });
    if (!fix) return toast.error('Could not get your location — search for the area instead');
    setPlace({ lat: fix.lat, lng: fix.lng, address: await reverseGeocode(fix.lat, fix.lng) });
  };

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setResults(await searchAddress(query));
  };

  const movePin = async (c: { lat: number; lng: number }) => {
    setPlace({ lat: c.lat, lng: c.lng, address: place?.address || '' });
    const addr = await reverseGeocode(c.lat, c.lng);
    setPlace({ lat: c.lat, lng: c.lng, address: addr });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return toast.error('Please log in again');
    if (!title.trim()) return toast.error('Add a title');
    if (!(Number(price) > 0)) return toast.error(rent ? 'Set your rental price' : 'Set your price');
    if (images.length + files.length === 0) return toast.error('Add at least one photo');
    if (!hasPoint(where)) return toast.error('Set the pickup location');

    setSaving(true);
    try {
      const uploaded = await Promise.all(files.map(f => uploadImage(f.file, profile.uid, 'products')));
      const payload: Partial<Product> = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        subcategory,
        images: [...images, ...uploaded],
        location: { lat: where.lat, lng: where.lng, address: where.address || 'Nearby' },
        listingType: kind,
        status: active ? 'available' : 'paused',
        ...(rent
          ? {
              rentDuration: unit,
              securityDeposit: Number(deposit) || 0,
              minUnits: Math.max(1, Number(minUnits) || 1),
              maxUnits: maxUnits ? Math.max(Number(minUnits) || 1, Number(maxUnits)) : null,
              capacity: isVenue && Number(capacity) > 0 ? Number(capacity) : null,
              features,
              attributes: specField && spec.trim() ? { [specField.key]: spec.trim() } : {},
              condition: '',
            }
          : {
              condition,
              originalPrice: Number(originalPrice) > 0 ? Number(originalPrice) : undefined,
              features: [],
              attributes: {},
            }),
      };

      if (initial) {
        // A sold item can't come back; relisting makes a fresh listing
        if (initial.status === 'sold') {
          const id = await createProduct({ ...(payload as Product), sellerId: profile.uid });
          toast.success('Relisted as a new listing');
          router.push(`/product/${id}`);
        } else {
          await updateProduct(initial.id, payload);
          toast.success('Listing updated');
          router.push(`/product/${initial.id}`);
        }
      } else {
        const id = await createProduct({ ...(payload as Product), sellerId: profile.uid, status: 'available' });
        toast.success(rent ? 'Your rental is live!' : 'Your listing is live!');
        router.push(`/product/${id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the listing');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial || !confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await deleteProduct(initial.id);
      toast.success('Listing deleted');
      router.push('/sell');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  };

  return (
    <form className="lf" onSubmit={submit}>
      <section className="lf-section">
        <h2>Photos</h2>
        <div className="lf-photos">
          {images.map((src, i) => (
            <div key={src} className="lf-photo">
              <Image src={src} alt="" fill sizes="96px" />
              <button type="button" aria-label="Remove photo" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}><X size={14} /></button>
              {i === 0 && <span>Cover</span>}
            </div>
          ))}
          {files.map((f, i) => (
            <div key={f.preview} className="lf-photo">
              <Image src={f.preview} alt="" fill sizes="96px" unoptimized />
              <button type="button" aria-label="Remove photo" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}><X size={14} /></button>
              {images.length === 0 && i === 0 && <span>Cover</span>}
            </div>
          ))}
          {images.length + files.length < MAX_PHOTOS && (
            <label className="lf-add">
              <input type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              <ImagePlus size={22} aria-hidden="true" />
              <span>Add photos</span>
            </label>
          )}
        </div>
      </section>

      <section className="lf-section">
        <h2>Details</h2>
        <label className="pd-field"><span>Title</span>
          <input className="ln-input" value={title} maxLength={90} onChange={e => setTitle(e.target.value)}
            placeholder={rent ? 'e.g. JBL PA speaker set with mixer' : 'e.g. iPhone 12, 128 GB'} required />
        </label>
        <div className="pd-field-row">
          <label className="pd-field"><span>Category</span>
            <select className="ln-input" value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          {subs.length > 0 && (
            <label className="pd-field"><span>Type</span>
              <select className="ln-input" value={subcategory} onChange={e => setSubcategory(e.target.value)}>
                <option value="">Choose…</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
        </div>
        <label className="pd-field"><span>Description</span>
          <textarea className="ln-input" rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}
            placeholder={rent ? 'What is included, how it is delivered, any rules…' : 'Condition, age, what comes with it…'} />
        </label>
      </section>

      <section className="lf-section">
        <h2>{rent ? 'Rental price & terms' : 'Price'}</h2>
        {rent ? (
          <>
            <div className="pd-field-row">
              <label className="pd-field"><span>Price (₹)</span>
                <input className="ln-input" type="number" inputMode="numeric" min={1} value={price} onChange={e => setPrice(e.target.value)} placeholder="500" required />
              </label>
              <label className="pd-field"><span>Per</span>
                <select className="ln-input" value={unit} onChange={e => setUnit(e.target.value as RentUnit)}>
                  {RENT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label.replace('Per ', '')}</option>)}
                </select>
              </label>
            </div>
            <div className="pd-field-row">
              <label className="pd-field"><span>Refundable deposit (₹)</span>
                <input className="ln-input" type="number" inputMode="numeric" min={0} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" />
              </label>
              {isVenue && (
                <label className="pd-field"><span>Guests it holds</span>
                  <input className="ln-input" type="number" inputMode="numeric" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="200" />
                </label>
              )}
            </div>
            <div className="pd-field-row">
              <label className="pd-field"><span>Minimum ({unit}s)</span>
                <input className="ln-input" type="number" inputMode="numeric" min={1} value={minUnits} onChange={e => setMinUnits(e.target.value)} />
              </label>
              <label className="pd-field"><span>Maximum ({unit}s)</span>
                <input className="ln-input" type="number" inputMode="numeric" min={1} value={maxUnits} onChange={e => setMaxUnits(e.target.value)} placeholder="No limit" />
              </label>
            </div>
            {specField && (
              <label className="pd-field"><span>{specField.label}</span>
                <input className="ln-input" value={spec} onChange={e => setSpec(e.target.value)} placeholder={specField.placeholder} />
              </label>
            )}
            <div className="pd-field"><span>What&apos;s included</span>
              <div className="ln-chip-wrap">
                {featureOptions.map(f => (
                  <button key={f} type="button" className="ln-chip" aria-pressed={features.includes(f)}
                    onClick={() => setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}>{f}</button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="pd-field-row">
              <label className="pd-field"><span>Selling price (₹)</span>
                <input className="ln-input" type="number" inputMode="numeric" min={1} value={price} onChange={e => setPrice(e.target.value)} placeholder="12000" required />
              </label>
              <label className="pd-field"><span>Original price (₹, optional)</span>
                <input className="ln-input" type="number" inputMode="numeric" min={0} value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} />
              </label>
            </div>
            <div className="pd-field"><span>Condition</span>
              <div className="ln-chip-wrap">
                {SALE_CONDITIONS.map(c => <button key={c} type="button" className="ln-chip" aria-pressed={condition === c} onClick={() => setCondition(c)}>{c}</button>)}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="lf-section">
        <h2>{rent ? 'Pickup location' : 'Where buyers meet you'}</h2>
        <p className="ln-note" style={{ marginTop: 0 }}><MapPin size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> {where.address || 'Using your current area'} — drag the pin or tap the map to adjust.</p>
        <div className="sr-map">
          <MapView center={where} pin={where} onPinMove={c => void movePin(c)} height={200} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={useMyLocation}><Crosshair size={15} aria-hidden="true" /> Use my location</button>
          {profile?.storeLocation && hasPoint(profile.storeLocation) && (
            <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => setPlace(profile.storeLocation!)}>Use shop address</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div className="ln-input-icon" style={{ flex: 1 }}>
            <Search size={16} aria-hidden="true" />
            <input className="ln-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search area or landmark"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runSearch(); } }} />
          </div>
          <button type="button" className="ln-btn ln-btn-ghost" onClick={runSearch}>Find</button>
        </div>
        {results.length > 0 && (
          <ul className="ln-place-list">
            {results.map(r => (
              <li key={`${r.lat},${r.lng}`}><button type="button" onClick={() => { setPlace(r); setResults([]); setQuery(''); }}><MapPin size={15} aria-hidden="true" /><span>{r.address}</span></button></li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <section className="lf-section">
          <label className="ln-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><span>Listing is live (untick to pause it)</span></label>
        </section>
      )}

      <div className="lf-submit">
        {editing && <button type="button" className="ln-btn ln-btn-danger" onClick={remove}>Delete</button>}
        <button type="submit" className="ln-btn ln-btn-primary" style={{ flex: 1 }} disabled={saving}>
          {saving ? <><Loader2 size={18} className="ln-spin" /> Saving…</> : editing ? 'Save changes' : rent ? 'Publish rental' : 'Publish listing'}
        </button>
      </div>
    </form>
  );
}
