'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications, type AppNotification,
} from '@/lib/supabase-db';
import { notificationHref } from '@/components/NotificationPopover';
import { toMillis } from '@/lib/time';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const uid = profile?.uid;

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/notifications');
  }, [loading, user, router]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const refresh = () => { getNotifications(uid).then(n => { if (!cancelled) setItems(n); }); };
    refresh();
    const unsubscribe = subscribeToNotifications(uid, refresh);
    return () => { cancelled = true; unsubscribe(); };
  }, [uid]);

  const open = (n: AppNotification) => {
    if (!n.read) void markNotificationRead(n.id);
    const href = notificationHref(n);
    if (href) router.push(href);
  };

  return (
    <div className="ln-page">
      <div className="top-header">
        <button type="button" className="ln-icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 17, fontWeight: 800 }}>Notifications</h1>
        <button type="button" className="ln-text-btn" onClick={() => uid && markAllNotificationsRead(uid).then(() => setItems(prev => prev?.map(n => ({ ...n, read: true })) ?? null))}>Mark all read</button>
      </div>
      <div className="ln-shell" style={{ paddingTop: 10 }}>
        {!items ? (
          <div className="ln-skel" style={{ height: 160, borderRadius: 16 }} />
        ) : items.length === 0 ? (
          <div className="ln-empty"><Bell size={28} aria-hidden="true" /><h2>You&apos;re all caught up</h2><p>Booking requests, messages and updates appear here.</p></div>
        ) : (
          items.map(n => (
            <button type="button" key={n.id} className={`ln-notif ${n.read ? '' : 'is-unread'}`} onClick={() => open(n)}>
              <span className="ln-notif-icon"><Bell size={17} /></span>
              <span className="ln-notif-text">
                <strong>{n.title}</strong>
                {n.body && <span>{n.body}</span>}
                {toMillis(n.createdAt) > 0 && <em>{formatDistanceToNow(new Date(toMillis(n.createdAt)), { addSuffix: true })}</em>}
              </span>
              {!n.read && <span className="ln-notif-dot" aria-label="Unread" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
