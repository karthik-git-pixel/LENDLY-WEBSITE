import React from 'react';

type LogoVariant = 'color' | 'inverse' | 'onBrand';

interface LogoProps {
  size?: number;
  color?: string; // Kept for backwards compatibility with props
  /**
   * `color` on white/light surfaces, `inverse` on navy, `onBrand` on orange —
   * the three icon treatments from the Lendly brand sheet.
   */
  variant?: LogoVariant;
  className?: string;
  style?: React.CSSProperties;
}

const ORANGE = '#16a34a';
const NAVY = '#0b2240';
const WHITE = '#ffffff';

const PALETTES: Record<LogoVariant, { pin: string; ring: string; core: string; orbit: string; dot: string }> = {
  color: { pin: ORANGE, ring: WHITE, core: NAVY, orbit: ORANGE, dot: NAVY },
  inverse: { pin: ORANGE, ring: WHITE, core: NAVY, orbit: ORANGE, dot: WHITE },
  onBrand: { pin: WHITE, ring: WHITE, core: NAVY, orbit: WHITE, dot: WHITE },
};

// The dashed orbit is drawn as explicit arc segments rather than a dashed
// ellipse, so the gaps land exactly around the pin and the bottom dot.
const ORBIT_PATH =
  'M49.11 28.91A29.29 12.18 0 0 1 55.07 31.28M58.31 33.44A29.29 12.18 0 0 1 60.86 36.71M61.27 39.25A29.29 12.18 0 0 1 59.80 42.62M57.28 44.94A29.29 12.18 0 0 1 52.14 47.63M47.28 49.18A29.29 12.18 0 0 1 39.70 50.54M24.30 50.54A29.29 12.18 0 0 1 16.72 49.18M11.86 47.63A29.29 12.18 0 0 1 6.72 44.94M4.20 42.62A29.29 12.18 0 0 1 2.73 39.25M3.14 36.71A29.29 12.18 0 0 1 5.69 33.44M8.93 31.28A29.29 12.18 0 0 1 14.89 28.91';
const PIN_PATH = 'M32 43.87L22.09 34.58A14.5 14.5 0 1 1 41.91 34.58Z';

/**
 * The Lendly icon: a location pin inside a dashed orbit, with the dot at the
 * bottom marking "right around you". Plain fills only — no gradient or mask
 * ids — so it renders correctly even when another copy sits in a hidden
 * (`display: none`) header.
 */
export default function Logo({ size = 32, variant = 'color', className, style }: LogoProps) {
  const p = PALETTES[variant];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Lendly"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, overflow: 'visible', ...style }}
    >
      <path d={ORBIT_PATH} fill="none" stroke={p.orbit} strokeWidth="3.2" strokeLinecap="round" />
      <path d={PIN_PATH} fill={p.pin} stroke={p.pin} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="32" cy="24" r="8.9" fill={p.ring} />
      <circle cx="32" cy="24" r="5.8" fill={p.core} />
      <circle cx="32" cy="50.97" r="3.8" fill={p.dot} />
    </svg>
  );
}

interface WordmarkProps {
  size?: number;
  /** `light` for dark backgrounds */
  tone?: 'dark' | 'light';
  style?: React.CSSProperties;
}

/** "Lendly" — "Lend" in navy (white on dark), "ly" always in brand orange. */
export function Wordmark({ size = 22, tone = 'dark', style }: WordmarkProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: size,
        fontWeight: 900,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        color: tone === 'light' ? WHITE : NAVY,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      Lend<span style={{ color: ORANGE }}>ly</span>
    </span>
  );
}
