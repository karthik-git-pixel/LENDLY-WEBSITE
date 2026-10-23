import { useSyncExternalStore } from 'react';

const KEY = 'lendly_recently_viewed';
const MAX = 12;
const EMPTY: string[] = [];
const listeners = new Set<() => void>();

function parse(raw: string | null): string[] {
  try {
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// useSyncExternalStore needs a stable snapshot between changes
let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY;

function snapshot(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return EMPTY; }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parse(raw);
  }
  return cachedIds;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function getRecentlyViewed(): string[] {
  return snapshot();
}

export function recordRecentlyViewed(productId: string): void {
  try {
    const next = [productId, ...snapshot().filter(id => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach(l => l());
  } catch {
    // storage unavailable — recently viewed is a nicety
  }
}

/** Product ids the user opened recently, newest first */
export function useRecentlyViewed(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
