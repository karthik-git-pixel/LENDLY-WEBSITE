'use client';

import { useMemo, useState } from 'react';
import Image from '@/components/AppImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, Info, Loader2, Star, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { useUserLocation } from '@/lib/location-context';
import { createProduct, deleteProduct, hasPoint, updateProduct, type GeoPoint, type Product } from '@/lib/supabase-db';
import { uploadImage } from '@/lib/upload';
import {
  CATEGORIES, RENT_UNITS, SALE_CONDITIONS, SUBCATEGORY_SPEC, fitsShopLabel, rentFeatureOptions, shopMainCategory,
  type ListingType, type RentUnit,
} from '@/lib/catalog';
import { draftFromSnap, inr, whyThisPrice, type AiField } from '@/lib/ai/snap-draft';
import type { SnapResult } from '@/lib/ai/snap-types';
import LocationPicker, { hasAddressDetails } from './LocationPicker';

const MAX_PHOTOS = 8;

/** A listing photo: already uploaded (src is its URL) or picked just now (src is a local preview) */
interface Photo {
  key: string;
  src: string;
  file?: File;
}

interface ListingFormProps {
  kind: ListingType;
  /** The listing being edited */
  initial?: Product;
  /** A listing to copy into a new one */
  template?: Product;
  /** A photo picked before the form opened; it becomes the cover */
  photo?: File;
  /** Snap-to-List's draft of this listing, for the owner to check */
  snap?: SnapResult;
}

/** Marks a field Snap-to-List filled in; it goes away once the owner edits it */
const AiTag = ({ on }: { on: boolean }) => (on ? <em className="lf-ai-tag">✨ AI</em> : null);

export default function ListingForm({ kind, initial, template, photo, snap }: ListingFormProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { coords, address } = useUserLocation();
  const rent = kind === 'rent';
  const editing = Boolean(initial);
  const source = initial || template;
  const [draft] = useState(() => (snap ? draftFromSnap(snap) : null));

  // New rentals start in the shop's own category, on its first speciality
  const startCategory = draft?.category || source?.category || shopMainCategory(profile?.storeCategory)?.name || (rent ? 'Event & Sound' : 'Electronics');
  const startSub = draft ? draft.subcategory : source ? source.subcategory || '' : (profile?.storeCategory || '').split(',').map(s => s.trim())
    .find(s => CATEGORIES.find(c => c.name === startCategory)?.subcategories.includes(s)) || '';
  const [title, setTitle] = useState(draft?.title || source?.title || '');
  const [description, setDescription] = useState(draft?.description || source?.description || '');
  const [category, setCategory] = useState(startCategory);
  const [subcategory, setSubcategory] = useState(startSub);
  const [price, setPrice] = useState(draft ? draft.price : source ? String(source.price) : '');
  const [originalPrice, setOriginalPrice] = useState(source?.originalPrice ? String(source.originalPrice) : '');
  const [condition, setCondition] = useState(source?.condition || 'Good');
  const [unit, setUnit] = useState<RentUnit>((source?.rentDuration as RentUnit) || 'day');
  const [deposit, setDeposit] = useState(draft ? draft.deposit : source?.securityDeposit ? String(source.securityDeposit) : '');
  const [minUnits, setMinUnits] = useState(String(source?.minUnits || 1));
  const [maxUnits, setMaxUnits] = useState(source?.maxUnits ? String(source.maxUnits) : '');
  const [capacity, setCapacity] = useState(source?.capacity ? String(source.capacity) : '');
  const [features, setFeatures] = useState<string[]>(draft?.features || source?.features || []);
  const [spec, setSpec] = useState(() => draft?.spec || Object.values(source?.attributes || {})[0] || '');
  const [photos, setPhotos] = useState<Photo[]>(() => [
    ...(photo ? [{ key: `${photo.name}-${photo.lastModified}`, src: URL.createObjectURL(photo), file: photo }] : []),
    ...(source?.images || []).map((src, i) => ({ key: `${i}-${src}`, src })),
  ]);
  const [place, setPlace] = useState<GeoPoint | null>(
    source && hasPoint(source.location) ? source.location
      : profile?.storeLocation && hasPoint(profile.storeLocation) ? profile.storeLocation
      : null
  );
  const [active, setActive] = useState(initial ? initial.status !== 'paused' : true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [aiFields, setAiFields] = useState<Set<AiField>>(() => draft?.fields || new Set());
  const [showWhy, setShowWhy] = useState(false);
  const ai = (field: AiField) => aiFields.has(field);
  const edited = (...fields: AiField[]) => setAiFields(prev => {
    if (!fields.some(f => prev.has(f))) return prev;
    const next = new Set(prev);
    fields.forEach(f => next.delete(f));
    return next;
  });
  const blocked = snap && !snap.is_allowed ? snap.rejection_reason || 'This item can’t be listed on Lendly.' : null;

  const subs = useMemo(() => CATEGORIES.find(c => c.name === category)?.subcategories || [], [category]);
  const specField = SUBCATEGORY_SPEC[subcategory];
  const featureOptions = rentFeatureOptions(subcategory);
  const isVenue = subcategory === 'Halls & Venues';
  const where = place || { lat: coords.lat, lng: coords.lng, address };
  const storeLabel = profile?.storeCategory || '';
  const offGenre = rent && Boolean(storeLabel) && Boolean(subcategory) && !fitsShopLabel(storeLabel, { category, subcategory, title });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const images = Array.from(list).filter(f => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    if (images.length > room) toast(`Up to ${MAX_PHOTOS} photos`);
    const picked = images.slice(0, Math.max(0, room)).map(file => ({
      key: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      src: URL.createObjectURL(file),
      file,
    }));
    if (picked.length) setPhotos(prev => [...prev, ...picked]);
  };

  const removePhoto = (key: string) => setPhotos(prev => prev.filter(p => p.key !== key));

  const makeCover = (key: string) => setPhotos(prev => {
    const chosen = prev.find(p => p.key === key);
    return chosen ? [chosen, ...prev.filter(p => p.key !== key)] : prev;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return toast.error('Please log in again');
    if (blocked) return toast.error(blocked);
    if (!title.trim()) return toast.error('Add a title');
    if (!(Number(price) > 0)) return toast.error(rent ? 'Set your rental price' : 'Set your price');
    if (photos.length === 0) return toast.error('Add at least one photo');
    if (!hasPoint(where)) return toast.error('Set the pickup location');
    if (!hasAddressDetails(where)) return toast.error('Enter the full pickup address');

    const pending = photos.filter(p => p.file).length;
    let uploaded = 0;
    setSaving(pending ? `Uploading photos 0/${pending}…` : 'Saving…');
    try {
      const images = await Promise.all(photos.map(async p => {
        if (!p.file) return p.src;
        const url = await uploadImage(p.file, profile.uid, 'products');
        uploaded += 1;
        setSaving(uploaded < pending ? `Uploading photos ${uploaded}/${pending}…` : 'Saving…');
        return url;
      }));
      // Uploaded photos stay uploaded if saving fails, so a retry won't send them again
      setPhotos(images.map((src, i) => ({ key: photos[i].key, src })));

      const payload: Partial<Product> = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        subcategory,
        images,
        location: { lat: where.lat, lng: where.lng, address: where.address || 'Nearby', details: where.details!.trim() },
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
      setSaving(null);
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
      {snap && (
        blocked ? (
          <p className="ln-note lf-ai-block" role="alert"><strong>We can&apos;t list this item.</strong> {blocked}</p>
        ) : (
          <p className="ln-note lf-ai-note">
            ✨ We filled this in from your photo. Check every detail — nothing goes live until you publish.
            {snap.confidence < 0.6 && <><br /><strong>Not fully sure — please check the details.</strong></>}
          </p>
        )
      )}
      <section className="lf-section">
        <h2>Photos</h2>
        <p className="ln-note" style={{ marginTop: 4 }}>Up to {MAX_PHOTOS}. The first photo is the cover — tap the star on another to swap.</p>
        <div
          className={`lf-photos ${dragging ? 'is-dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        >
          {photos.map((p, i) => (
            <div key={p.key} className="lf-photo">
              <Image src={p.src} alt="" fill sizes="96px" unoptimized={Boolean(p.file)} />
              <button type="button" aria-label="Remove photo" onClick={() => removePhoto(p.key)}><X size={14} /></button>
              {i === 0 ? (
                <span>Cover</span>
              ) : (
                <button type="button" className="lf-cover-btn" aria-label="Make this the cover photo" title="Make cover" onClick={() => makeCover(p.key)}>
                  <Star size={13} />
                </button>
              )}
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
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
        <label className="pd-field"><span>Title <AiTag on={ai('title')} /></span>
          <input className="ln-input" value={title} maxLength={90} onChange={e => { setTitle(e.target.value); edited('title'); }}
            placeholder={rent ? 'e.g. JBL PA speaker set with mixer' : 'e.g. iPhone 12, 128 GB'} required />
        </label>
        <div className="pd-field-row">
          <label className="pd-field"><span>Category <AiTag on={ai('category')} /></span>
            <select className="ln-input" value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); edited('category', 'subcategory'); }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          {subs.length > 0 && (
            <label className="pd-field"><span>Type <AiTag on={ai('subcategory')} /></span>
              <select className="ln-input" value={subcategory} onChange={e => { setSubcategory(e.target.value); edited('subcategory'); }}>
                <option value="">Choose…</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
        </div>
        {offGenre && (
          <p className="ln-note ln-note-warn">
            Your shop is listed for <strong>{storeLabel}</strong>, so this may not show on your shop page.{' '}
            <Link href="/sell/shop" className="ln-text-btn">Update your shop specialities</Link>
          </p>
        )}
        <label className="pd-field"><span>Description <AiTag on={ai('description')} /></span>
          <textarea className="ln-input" rows={snap ? 6 : 4} maxLength={2000} value={description} onChange={e => { setDescription(e.target.value); edited('description'); }}
            placeholder={rent ? 'What is included, how it is delivered, any rules…' : 'Condition, age, what comes with it…'} />
        </label>
      </section>

      <section className="lf-section">
        <h2>{rent ? 'Rental price & terms' : 'Price'}</h2>
        {rent ? (
          <>
            {snap && snap.suggested_rent_per_day_inr > 0 && (
              <div className="lf-ai-prices">
                <span className="lf-ai-prices-label">✨ Suggested</span>
                <div className="ln-chip-wrap">
                  <button type="button" className="ln-chip" aria-pressed={price === String(snap.suggested_rent_per_day_inr) && unit === 'day'}
                    onClick={() => { setPrice(String(snap.suggested_rent_per_day_inr)); setUnit('day'); }}>
                    {inr(snap.suggested_rent_per_day_inr)}/day
                  </button>
                  {snap.suggested_deposit_inr > 0 && (
                    <button type="button" className="ln-chip" aria-pressed={deposit === String(snap.suggested_deposit_inr)}
                      onClick={() => setDeposit(String(snap.suggested_deposit_inr))}>
                      {inr(snap.suggested_deposit_inr)} deposit
                    </button>
                  )}
                  {snap.estimated_replacement_value_inr > 0 && (
                    <span className="ln-chip lf-ai-value">~{inr(snap.estimated_replacement_value_inr)} to replace</span>
                  )}
                </div>
                <button type="button" className="ln-text-btn" aria-expanded={showWhy} title={whyThisPrice(snap)} onClick={() => setShowWhy(v => !v)}>
                  <Info size={14} aria-hidden="true" /> Why this price?
                </button>
                {showWhy && <p className="ln-note" style={{ margin: 0 }}>{whyThisPrice(snap)}</p>}
              </div>
            )}
            <div className="pd-field-row">
              <label className="pd-field"><span>Price (₹) <AiTag on={ai('price')} /></span>
                <input className="ln-input" type="number" inputMode="numeric" min={1} value={price} onChange={e => { setPrice(e.target.value); edited('price'); }} placeholder="500" required />
              </label>
              <label className="pd-field"><span>Per</span>
                <select className="ln-input" value={unit} onChange={e => setUnit(e.target.value as RentUnit)}>
                  {RENT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label.replace('Per ', '')}</option>)}
                </select>
              </label>
            </div>
            <div className="pd-field-row">
              <label className="pd-field"><span>Refundable deposit (₹) <AiTag on={ai('deposit')} /></span>
                <input className="ln-input" type="number" inputMode="numeric" min={0} value={deposit} onChange={e => { setDeposit(e.target.value); edited('deposit'); }} placeholder="0" />
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
              <label className="pd-field"><span>{specField.label} <AiTag on={ai('spec')} /></span>
                <input className="ln-input" value={spec} onChange={e => { setSpec(e.target.value); edited('spec'); }} placeholder={specField.placeholder} />
              </label>
            )}
            <div className="pd-field"><span>What&apos;s included <AiTag on={ai('features')} /></span>
              <div className="ln-chip-wrap">
                {featureOptions.map(f => (
                  <button key={f} type="button" className="ln-chip" aria-pressed={features.includes(f)}
                    onClick={() => { setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]); edited('features'); }}>{f}</button>
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
        <LocationPicker
          value={place}
          fallback={where}
          onChange={setPlace}
          extra={profile?.storeLocation && hasPoint(profile.storeLocation) && (
            <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => setPlace(profile.storeLocation!)}>Use shop address</button>
          )}
        />
      </section>

      {editing && (
        <section className="lf-section">
          <label className="ln-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><span>Listing is live (untick to pause it)</span></label>
        </section>
      )}

      <div className="lf-submit">
        {editing && <button type="button" className="ln-btn ln-btn-danger" onClick={remove} disabled={Boolean(saving)}>Delete</button>}
        <button type="submit" className="ln-btn ln-btn-primary" style={{ flex: 1 }} disabled={Boolean(saving) || Boolean(blocked)}>
          {saving ? <><Loader2 size={18} className="ln-spin" /> {saving}</> : editing ? 'Save changes' : rent ? 'Publish rental' : 'Publish listing'}
        </button>
      </div>
    </form>
  );
}
