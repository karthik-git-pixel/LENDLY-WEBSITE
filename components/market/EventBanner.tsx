import Link from 'next/link';
import { Sparkles, Speaker } from 'lucide-react';

/** The single promotional block on the home page */
export default function EventBanner() {
  return (
    <aside className="ln-event" aria-label="Plan an event">
      <span className="ln-event-icon" aria-hidden="true"><Speaker size={22} /></span>
      <p className="ln-event-text">Planning a fest or function? Get sound, lights &amp; venue in one quote ✨</p>
      <Link href="/plan" className="ln-event-btn">
        <Sparkles size={15} aria-hidden="true" /> Get AI quote
      </Link>
    </aside>
  );
}
