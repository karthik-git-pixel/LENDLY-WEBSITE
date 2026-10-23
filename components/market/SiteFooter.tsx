import Link from 'next/link';
import { Handshake, QrCode, ShieldCheck } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="ln-footer">
      <ul className="ln-trust" aria-label="Why Lendly">
        <li><QrCode size={16} aria-hidden="true" /> QR-verified handovers</li>
        <li><ShieldCheck size={16} aria-hidden="true" /> Verified neighbours</li>
        <li><Handshake size={16} aria-hidden="true" /> Direct P2P deals</li>
      </ul>
      <nav className="ln-footer-links" aria-label="Footer">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refunds">Refunds</Link>
        <Link href="/shipping">Pickup &amp; delivery</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      <p className="ln-copy">© {new Date().getFullYear()} Lendly · Find what you need, right around you.</p>
    </footer>
  );
}
