'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * A single mount that gives the whole app its interaction polish:
 *
 *  1. Ripple feedback on every button / chip / tab (no per-component wiring)
 *  2. A reading-progress bar pinned to the top of the viewport
 *  3. Reveal-on-scroll for any element carrying `.rc-reveal`
 *  4. A back-to-top control that appears once you have scrolled a screen
 *
 * All of it is opt-out under `prefers-reduced-motion`.
 */

const RIPPLE_SELECTOR =
  '.btn-primary, .btn-secondary, .btn-danger, .btn-ghost, .chip, .tab-item, [data-ripple]';

// Elements whose background is light — they need a dark ripple to be visible
const DARK_RIPPLE_SELECTOR = '.btn-secondary, .btn-ghost, .tab-item, [data-ripple="dark"]';

export default function InteractionLayer() {
  const [showTop, setShowTop] = useState(false);
  const ticking = useRef(false);

  // ---- Ripple ------------------------------------------------------------
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function onPointerDown(e: PointerEvent) {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(RIPPLE_SELECTOR);
      if (!target || target.hasAttribute('disabled')) return;

      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // Ripples need a containing block and clipping to stay inside the shape
      const computed = getComputedStyle(target);
      if (computed.position === 'static') target.style.position = 'relative';
      if (computed.overflow === 'visible') target.style.overflow = 'hidden';

      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = target.matches(DARK_RIPPLE_SELECTOR)
        ? 'rc-ripple rc-ripple-dark'
        : 'rc-ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // ---- Back-to-top visibility --------------------------------------------
  useEffect(() => {
    function update() {
      const y = window.scrollY;
      setShowTop(y > window.innerHeight * 0.9);
      ticking.current = false;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // ---- Reveal on scroll --------------------------------------------------
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document
        .querySelectorAll('.rc-reveal')
        .forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
    );

    function observeAll() {
      document.querySelectorAll('.rc-reveal:not(.is-visible)').forEach((el) => observer.observe(el));
    }

    observeAll();

    // Client-side navigation and async data both swap content in after mount
    const mutations = new MutationObserver(() => observeAll());
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Scroll back to top"
        className={`rc-to-top ${showTop ? 'is-shown' : ''}`}
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          })
        }
      >
        <ArrowUp size={20} strokeWidth={2.6} />
      </button>
    </>
  );
}
