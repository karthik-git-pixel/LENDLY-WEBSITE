import { MapPin, QrCode, ShieldCheck } from 'lucide-react';
import Logo, { Wordmark } from './Logo';

const POINTS = [
  { icon: MapPin, title: 'Hyperlocal by default', text: 'Everything you see is within 30 km of you.' },
  { icon: ShieldCheck, title: 'Verified neighbours', text: 'KYC-checked sellers, real local people.' },
  { icon: QrCode, title: 'QR-secured handovers', text: 'Inspect in person, confirm with a scan.' },
];

/** The navy brand half of the login / register split layout (desktop only). */
export default function AuthBrandPanel() {
  return (
    <aside className="lp-auth-panel" aria-hidden="true">
      <div className="lp-auth-panel-orbit" />

      <div className="lp-auth-brand">
        <Logo size={52} variant="inverse" />
        <Wordmark size={32} tone="light" />
      </div>

      <div>
        <h2 className="lp-auth-headline">
          Find what you need,<br />
          <span>right around you.</span>
        </h2>

        <ul className="lp-auth-points">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="lp-auth-point-ico">
                <Icon size={17} strokeWidth={2.3} />
              </span>
              <span>
                <strong>{title}</strong>
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="lp-auth-foot">Buy · Sell · Rent — made for neighbourhoods across India.</p>
    </aside>
  );
}
