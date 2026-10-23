'use client';

import { useEffect, useState } from 'react';
import { Camera, ImageUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/auth-fetch';
import { compressImage } from '@/lib/upload';
import { SNAP_MAX_BYTES, type SnapResponse, type SnapResult } from '@/lib/ai/snap-types';

const STATUS = ['Spotting the item…', 'Checking condition…', 'Estimating fair price…', 'Writing the description…'];

interface SnapToListProps {
  /** The original photo (it becomes the cover) and the AI's draft */
  onResult: (photo: File, result: SnapResult) => void;
  /** Go to the empty form, optionally with the photo already added */
  onManual: (photo?: File) => void;
}

/** First step of a new rental: one photo, and the AI drafts the listing */
export default function SnapToList({ onResult, onManual }: SnapToListProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState(0);

  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => setStatus(s => (s + 1) % STATUS.length), 1400);
    return () => clearInterval(timer);
  }, [preview]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose a photo');
    setStatus(0);
    setPreview(URL.createObjectURL(file));
    try {
      // A small JPEG is all the model needs, and keeps the call quick and cheap
      const small = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8, type: 'image/jpeg' });
      if (small.size > SNAP_MAX_BYTES) throw new Error('Photo is larger than 8 MB');
      const body = new FormData();
      body.append('image', small);
      const res = await authFetch('/api/ai/snap-to-list', { method: 'POST', body });
      const data = await res.json().catch(() => ({ fallback: true })) as SnapResponse;
      if (data.fallback) throw new Error(data.error || 'Couldn’t read the photo');
      onResult(file, data.result);
    } catch (err) {
      toast(`${err instanceof Error ? err.message : 'Couldn’t read the photo'} — fill in the details yourself`);
      onManual(file);
    }
  };

  if (preview) {
    return (
      <section className="snap-card" aria-live="polite" aria-busy="true">
        <div className="snap-scan">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={preview} alt="Your photo" />
          <span className="snap-scan-beam" aria-hidden="true" />
        </div>
        <p className="snap-status" key={status}>{STATUS[status]}</p>
      </section>
    );
  }

  return (
    <section className="snap-card">
      <div className="snap-head">
        <span className="snap-badge">✨ AI</span>
        <h2>📸 Snap to List</h2>
        <p>One photo, we&apos;ll fill the rest. You check everything before it goes live.</p>
      </div>
      <div className="snap-actions">
        <label className="ln-btn ln-btn-primary">
          <input type="file" accept="image/*" capture="environment" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <Camera size={18} aria-hidden="true" /> Take photo
        </label>
        <label className="ln-btn ln-btn-ghost">
          <input type="file" accept="image/*" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <ImageUp size={18} aria-hidden="true" /> Upload
        </label>
      </div>
      <button type="button" className="ln-text-btn snap-manual" onClick={() => onManual()}>Fill manually instead</button>
    </section>
  );
}
