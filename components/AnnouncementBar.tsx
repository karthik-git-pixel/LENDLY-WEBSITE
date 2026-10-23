'use client';

import Link from 'next/link';
import { CreditCard, MapPin, ShieldCheck, Tag, QrCode, Printer } from 'lucide-react';

const newsItems = [
  {
    badge: 'INSTANT PAY',
    badgeIcon: CreditCard,
    text: 'Seamless direct payments with UPI apps & Cards',
    link: '/explore',
  },
  {
    badge: 'HYPERLOCAL',
    badgeIcon: MapPin,
    text: 'Rent from verified neighbours and shops within 0–30km',
    link: '/explore',
  },
  {
    badge: 'DIRECT P2P',
    badgeIcon: ShieldCheck,
    text: 'Peer-to-peer deals with local neighbors — zero middlemen',
    link: '/explore',
  },
  {
    badge: 'RENT OUT',
    badgeIcon: Tag,
    text: 'List your rental gear in under 30 seconds',
    link: '/sell',
  },
  {
    badge: 'QR VERIFIED',
    badgeIcon: QrCode,
    text: 'Safe & instant pickup verification with QR code',
    link: '/scan',
  },
  {
    badge: 'PRINT SERVICE',
    badgeIcon: Printer,
    text: 'Upload documents & get doorstep prints from local hubs',
    link: '/print',
  },
];

export default function AnnouncementBar() {
  // Two identical halves: the track slides by exactly one half, then repeats seamlessly
  const tickerItems = [...newsItems, ...newsItems];

  return (
    <div className="announcement-bar" role="region" aria-label="Lendly highlights">
      {/* Scrolling News Ticker */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {tickerItems.map((item, idx) => {
            const BadgeIcon = item.badgeIcon;
            return (
              <Link key={idx} href={item.link} className="ticker-item" aria-hidden={idx >= newsItems.length} tabIndex={idx >= newsItems.length ? -1 : undefined}>
                <span className="ticker-badge">
                  <BadgeIcon size={12} className="ticker-badge-icon" strokeWidth={2.4} />
                  <span>{item.badge}</span>
                </span>
                <span className="ticker-text-wrapper">
                  <span>{item.text}</span>
                </span>
                <span className="ticker-separator">✦</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
