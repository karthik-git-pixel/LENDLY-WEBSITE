'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, X } from 'lucide-react';
import { useMediaQuery } from '@/lib/use-media-query';

const PLACEHOLDERS = [
  'Search speakers, cameras, cycles…',
  'Try: sound setup for 200 people on Saturday',
  'Search halls, projectors, textbooks…',
];

// Same ideas, short enough to fit beside the Ask AI pill on a phone
const SHORT_PLACEHOLDERS = [
  'Speakers, cameras, cycles…',
  'Try: sound for 200 people',
  'Halls, projectors, books…',
];

interface SearchBarProps {
  initialQuery?: string;
  autoFocus?: boolean;
}

export default function SearchBar({ initialQuery = '', autoFocus }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const narrow = useMediaQuery('(max-width: 479px)');
  const placeholders = narrow ? SHORT_PLACEHOLDERS : PLACEHOLDERS;

  // Follow the URL (back/forward) by adjusting state during render
  if (initialQuery !== syncedQuery) {
    setSyncedQuery(initialQuery);
    setQuery(initialQuery);
  }

  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(timer);
  }, []);

  const submit = (ai: boolean) => {
    const q = query.trim();
    if (!q && !ai) {
      inputRef.current?.focus();
      return;
    }
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (ai) params.set('ai', '1');
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form
      className="ln-search"
      role="search"
      onSubmit={e => {
        e.preventDefault();
        submit(false);
        inputRef.current?.blur();
      }}
    >
      <Search size={19} className="ln-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        className="ln-search-input"
        aria-label="Search listings near you"
        placeholder={placeholders[placeholderIdx % placeholders.length]}
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      {query && (
        <button type="button" className="ln-search-clear" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
          <X size={16} />
        </button>
      )}
      <button type="button" className="ln-ai-pill" onClick={() => submit(true)} aria-label="Ask AI to plan this search">
        <Sparkles size={15} aria-hidden="true" /> Ask AI
      </button>
    </form>
  );
}
