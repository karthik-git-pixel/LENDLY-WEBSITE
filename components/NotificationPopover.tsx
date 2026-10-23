'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
  type AppNotification,
} from '@/lib/firestore';
import { toMillis } from '@/lib/time';
import { Bell, ShoppingBag, Calendar, Package, AlertTriangle, MessageSquare, Zap, Star, X, Printer, ShieldCheck, type LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ICONS: Record<string, LucideIcon> = {
  order: ShoppingBag,
  rental_reminder: Calendar,
  new_product: Package,
  report: AlertTriangle,
  inquiry: MessageSquare,
  message: MessageSquare,
  back_in_stock: Zap,
  review: Star,
  print_order: Printer,
  kyc: ShieldCheck,
};

/** Where tapping a notification should take the user */
export function notificationHref(n: AppNotification): string | null {
  const d = n.data || {};
  if (d.chatId) return `/chat/${d.chatId}`;
  if (d.orderId) return `/profile/orders?order=${d.orderId}`;
  if (d.printOrderId) return n.type === 'print_order' ? '/print/orders' : null;
  if (d.productId) return `/product/${d.productId}`;
  if (n.type === 'kyc') return '/sell/verify';
  return null;
}

interface NotificationPopoverProps {
  buttonSize?: number;
  iconSize?: number;
}

export default function NotificationPopover({ buttonSize = 44, iconSize = 20 }: NotificationPopoverProps) {
  const { profile } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const uid = profile?.uid;

  // Initial load + live updates
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const refresh = () => {
      getNotifications(uid).then(n => {
        if (cancelled) return;
        setNotifs(n);
        setLoaded(true);
      });
    };
    refresh();
    const unsubscribe = subscribeToNotifications(uid, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const unread = notifs.filter(n => !n.read).length;

  const handleClick = async (n: AppNotification) => {
    if (!n.read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      void markNotificationRead(n.id);
    }
    const href = notificationHref(n);
    if (href) {
      setIsOpen(false);
      router.push(href);
    }
  };

  const markAll = async () => {
    if (!uid) return;
    setNotifs(prev => prev.map(x => ({ ...x, read: true })));
    await markAllNotificationsRead(uid);
  };

  const sorted = [...notifs].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="ln-icon-btn"
        style={{ width: buttonSize, height: buttonSize }}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={iconSize} />
        {unread > 0 && <span className="ln-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {isOpen && (
        <>
          <div className="mobile-only ln-pop-backdrop" onClick={() => setIsOpen(false)} />
          <div className="notification-card-box ln-pop" role="dialog" aria-label="Notifications">
            <div className="ln-pop-head">
              <h3>Notifications</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {unread > 0 && (
                  <button type="button" className="ln-text-btn" onClick={markAll}>Mark all read</button>
                )}
                <button type="button" className="ln-icon-btn" onClick={() => setIsOpen(false)} aria-label="Close notifications">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="ln-pop-body">
              {!loaded ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div className="spinner spinner-sm" />
                </div>
              ) : sorted.length === 0 ? (
                <div className="ln-pop-empty">
                  <Bell size={22} aria-hidden="true" />
                  <strong>You&apos;re all caught up</strong>
                  <span>Booking requests, messages and updates will show up here.</span>
                </div>
              ) : (
                sorted.map(n => {
                  const Icon = ICONS[n.type] || Bell;
                  const ts = toMillis(n.createdAt);
                  return (
                    <button
                      type="button"
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`ln-notif ${n.read ? '' : 'is-unread'}`}
                    >
                      <span className="ln-notif-icon"><Icon size={17} /></span>
                      <span className="ln-notif-text">
                        <strong>{n.title}</strong>
                        {n.body && <span>{n.body}</span>}
                        {ts > 0 && <em>{formatDistanceToNow(new Date(ts), { addSuffix: true })}</em>}
                      </span>
                      {!n.read && <span className="ln-notif-dot" aria-label="Unread" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
