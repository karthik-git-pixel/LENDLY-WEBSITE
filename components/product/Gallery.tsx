'use client';

import Image from '@/components/AppImage';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

const FALLBACK = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=900&auto=format&fit=crop&q=60';

interface GalleryProps {
  images: string[];
  title: string;
  badge: string;
  rent: boolean;
  dimmed?: string | null;
}

export default function Gallery({ images, title, badge, rent, dimmed }: GalleryProps) {
  const list = images.length ? images : [FALLBACK];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const step = useCallback((delta: number) => setIndex(i => (i + delta + list.length) % list.length), [list.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, step]);

  return (
    <div className="pd-gallery">
      <div className="pd-stage">
        <button type="button" className="pd-stage-btn" onClick={() => setOpen(true)} aria-label={`View photos of ${title} full screen`}>
          <Image
            src={list[index]}
            alt={title}
            fill
            sizes="(max-width: 1023px) 100vw, 640px"
            loading="eager"
            fetchPriority="high"
          />
        </button>
        <span className={`ln-tag ${rent ? 'ln-tag-rent' : ''} pd-stage-tag`}>{badge}</span>
        {dimmed && <span className="pd-stage-status">{dimmed}</span>}
        <span className="pd-stage-expand" aria-hidden="true"><Expand size={15} /></span>
        {list.length > 1 && (
          <>
            <button type="button" className="pd-arrow is-left" aria-label="Previous photo" onClick={() => step(-1)}><ChevronLeft size={20} /></button>
            <button type="button" className="pd-arrow is-right" aria-label="Next photo" onClick={() => step(1)}><ChevronRight size={20} /></button>
            <span className="pd-count">{index + 1} / {list.length}</span>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="pd-thumbs" role="tablist" aria-label="Photos">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1}`}
              className={`pd-thumb ${i === index ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <Image src={src} alt="" fill sizes="72px" />
            </button>
          ))}
        </div>
      )}

      {open && typeof document !== 'undefined' && createPortal(
        <div className="pd-lightbox" role="dialog" aria-modal="true" aria-label={`${title} photos`} onClick={() => setOpen(false)}>
          <button type="button" className="pd-lightbox-close" aria-label="Close" onClick={() => setOpen(false)}><X size={22} /></button>
          <div className="pd-lightbox-img" onClick={e => e.stopPropagation()}>
            <Image src={list[index]} alt={title} fill sizes="100vw" />
          </div>
          {list.length > 1 && (
            <>
              <button type="button" className="pd-arrow is-left is-dark" aria-label="Previous photo" onClick={e => { e.stopPropagation(); step(-1); }}><ChevronLeft size={22} /></button>
              <button type="button" className="pd-arrow is-right is-dark" aria-label="Next photo" onClick={e => { e.stopPropagation(); step(1); }}><ChevronRight size={22} /></button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
