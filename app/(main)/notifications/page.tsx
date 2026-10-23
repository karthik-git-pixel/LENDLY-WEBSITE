'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getNotifications, markNotificationRead, type AppNotification } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, ShoppingBag, Calendar, Package, AlertTriangle, MessageSquare, Zap, Star, Printer, type LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ICONS: Record<AppNotification['type'], LucideIcon> = {
  order: ShoppingBag,
  rental_reminder: Calendar,
  new_product: Package,
  report: AlertTriangle,
  inquiry: MessageSquare,
  back_in_stock: Zap,
  review: Star,
  print_order: Printer,
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    const uid = profile.uid;

    let cancelled = false;

    async function load() {
      try {
        const n = await getNotifications(uid);
        if (!cancelled) {
          setNotifs(n);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const handleClick = async (n: AppNotification) => {
    if (!n.read) await markNotificationRead(n.id);
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  };

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Notifications</h1>
        <div style={{ width: 36 }} />
      </div>
      <div className="page-container">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
        ) : notifs.length === 0 ? (
          <div className="empty-state">
            <Bell size={48} />
            <h3>No notifications</h3>
            <p>You&apos;ll see updates here</p>
          </div>
        ) : (
          notifs.map(n => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <div key={n.id} className="glass-card" onClick={() => handleClick(n)} style={{
                padding: 14, marginBottom: 8, display: 'flex', gap: 12, cursor: 'pointer',
                opacity: n.read ? 0.6 : 1,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(139,92,246,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--primary-light)', flexShrink: 0,
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : ''}
                  </div>
                </div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
