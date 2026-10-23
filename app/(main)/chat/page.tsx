'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { listenToChatRooms, type ChatRoom } from '@/lib/chat';
import { useRouter } from 'next/navigation';
import { MessageCircle, ChevronRight, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ChatListPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/chat');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const uid = profile?.uid || user?.uid;
    if (!uid) {
      if (!authLoading) setLoading(false);
      return;
    }

    // Real-time listener — seller sees new rooms from buyers instantly
    const unsub = listenToChatRooms(uid, (updatedRooms) => {
      setRooms(updatedRooms);
      setLoading(false);
    });

    // Safety fallback: Force exit spinner after 2s max under all circumstances
    const safetyTimer = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsub();
      clearTimeout(safetyTimer);
    };
  }, [user, profile, authLoading]);

  const getOtherUser = (room: ChatRoom) => {
    const currentUid = profile?.uid || user?.uid || '';
    const otherId = room.participants?.find(p => p !== currentUid) || '';
    return {
      name: room.participantNames?.[otherId] || 'User',
      avatar: room.participantAvatars?.[otherId] || '',
    };
  };

  const currentUid = profile?.uid || user?.uid || '';
  const displayedRooms = rooms.filter(room => {
    if (!currentUid || !room.participants || room.participants.length < 2) return false;
    
    // User is buyer if they are at index 0
    const isBuyer = room.participants[0] === currentUid;
    // User is seller if they are at index 1
    const isSeller = room.participants[1] === currentUid;
    
    if (activeTab === 'buying') return isBuyer;
    return isSeller;
  });

  return (
    <div className="fade-in">
      <div className="page-container">
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px', marginBottom: 4 }}>Messages</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Direct chats with buyers & sellers</p>
        </div>
        
        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <button 
            onClick={() => setActiveTab('buying')}
            className={`tab-item ${activeTab === 'buying' ? 'active' : ''}`}
            style={activeTab === 'buying' ? { background: 'var(--primary)', color: '#fff', fontWeight: 700 } : {}}
          >
            Buying
          </button>
          <button 
            onClick={() => setActiveTab('selling')}
            className={`tab-item ${activeTab === 'selling' ? 'active' : ''}`}
            style={activeTab === 'selling' ? { background: 'var(--primary)', color: '#fff', fontWeight: 700 } : {}}
          >
            Selling
          </button>
        </div>

        {loading && authLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : displayedRooms.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={44} />
            <h3>No {activeTab} conversations</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {activeTab === 'buying' ? 'Reach out to sellers when you find something you like.' : 'When buyers contact you about your items, they will appear here.'}
            </p>
          </div>
        ) : (
          displayedRooms.map(room => {
            const other = getOtherUser(room);
            return (
              <div
                key={room.id}
                className="glass-card"
                style={{ padding: 16, marginBottom: 12, display: 'flex', gap: 14, cursor: 'pointer', alignItems: 'center' }}
                onClick={() => router.push(`/chat/${room.id}`)}
              >
                <Image
                  src={other.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other.name)}&background=f38181&color=fff`}
                  alt=""
                  className="avatar-lg"
                  width={48}
                  height={48}
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--foreground)' }}>{other.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {room.lastMessageTime ? formatDistanceToNow(new Date(room.lastMessageTime), { addSuffix: true }) : ''}
                    </div>
                  </div>
                  {room.productTitle && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <Package size={12} /> {room.productTitle}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
                    {room.lastMessage || 'Start a conversation...'}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
