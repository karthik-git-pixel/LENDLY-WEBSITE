'use client';

import React, { useCallback, useEffect, useRef } from 'react';

/**
 * Wraps a stroke-based icon (any lucide icon) and animates it as if it were
 * being drawn by hand.
 *
 * Each shape inside the SVG is measured with `getTotalLength()`, so the dash
 * pattern matches the real geometry — every icon draws at the right speed
 * regardless of how long its paths are, and strokes land exactly on zero.
 *
 * It draws once when it scrolls into view, and again whenever `trigger`
 * changes (hover, selection, …).
 */

const DRAWABLE = 'path, line, polyline, polygon, circle, ellipse, rect';

interface DrawIconProps {
  children: React.ReactNode;
  /** Milliseconds for a single stroke to complete. */
  duration?: number;
  /** Delay between consecutive strokes within the same icon. */
  stagger?: number;
  /** Delay before the whole icon starts drawing. */
  delay?: number;
  /** Change this value to replay the animation. */
  trigger?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function DrawIcon({
  children,
  duration = 620,
  stagger = 90,
  delay = 0,
  trigger = 0,
  className,
  style,
}: DrawIconProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const hasPlayed = useRef(false);

  const play = useCallback(
    (startDelay: number) => {
      const svg = hostRef.current?.querySelector('svg');
      if (!svg) return;

      const shapes = Array.from(svg.querySelectorAll<SVGGeometryElement>(DRAWABLE));
      if (shapes.length === 0) return;

      const lengths = shapes.map((shape) => {
        let len = 0;
        try {
          len = shape.getTotalLength();
        } catch {
          // Older engines throw on non-path geometry — fall back to a length
          // comfortably longer than anything in a 24-unit viewBox.
          len = 0;
        }
        return Number.isFinite(len) && len > 0 ? len : 80;
      });

      // Reset to "undrawn" without transitioning back
      shapes.forEach((shape, i) => {
        shape.style.transition = 'none';
        shape.style.strokeDasharray = String(lengths[i]);
        shape.style.strokeDashoffset = String(lengths[i]);
      });

      // Flush the reset so the browser treats the next change as a transition
      void svg.getBoundingClientRect();

      shapes.forEach((shape, i) => {
        shape.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${
          startDelay + i * stagger
        }ms`;
        shape.style.strokeDashoffset = '0';
      });
    },
    [duration, stagger]
  );

  // First draw — once the icon is actually on screen
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hasPlayed.current = true;
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      play(delay);
      hasPlayed.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasPlayed.current) {
            hasPlayed.current = true;
            play(delay);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, [play, delay]);

  // Replays requested by the parent
  useEffect(() => {
    if (trigger === 0 || !hasPlayed.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    play(0);
  }, [trigger, play]);

  return (
    <span ref={hostRef} className={className} style={{ display: 'inline-flex', ...style }}>
      {children}
    </span>
  );
}
