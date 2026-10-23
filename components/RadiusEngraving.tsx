'use client';

/**
 * A light "engraved" Lendly watermark for card backgrounds.
 *
 * Two motifs, both pressed into the surface with a white lower highlight so
 * they read as carved rather than printed: the concentric radius rings that
 * stand for the hyperlocal search area, and the wordmark itself.
 *
 * Purely decorative — hidden from assistive tech and never intercepts clicks.
 */
export default function RadiusEngraving({ word = 'Lendly' }: { word?: string }) {
  return (
    <span className="rc-engrave" aria-hidden="true">
      <svg viewBox="0 0 220 220" className="rc-engrave-rings">
        <circle cx="110" cy="110" r="26" />
        <circle cx="110" cy="110" r="48" />
        <circle cx="110" cy="110" r="70" />
        <circle cx="110" cy="110" r="92" />
        {/* Location pin at the centre of the radius */}
        <path d="M110 92c-7.2 0-13 5.8-13 13 0 9.8 13 23 13 23s13-13.2 13-23c0-7.2-5.8-13-13-13z" />
        <circle cx="110" cy="105" r="4.6" />
      </svg>

      <span className="rc-engrave-word">{word}</span>
    </span>
  );
}
