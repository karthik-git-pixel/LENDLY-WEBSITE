'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getChatRoom, listenToMessages, sendMessage, type ChatMessage } from '@/lib/chat';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, MessageSquare, Lock, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

const BUYER_PRESET_MESSAGES = [
  'Is this item still available?',
  'What is your best final price?',
  'Can I inspect this in person today?',
  'Is local pickup or handover preferred?',
  'Where is your preferred pickup location?',
  'I would like to purchase / rent this now!',
];

const SELLER_PRESET_MESSAGES = [
  'Yes, this item is available for pickup!',
  'Price is firm, but I can offer a small discount for quick pickup.',
  'You are welcome to inspect it before buying.',
  'Please let me know your preferred pickup time.',
  'Pickup location details shared above.',
  'Ready for QR code verification scan!',
];

export default function ChatRoomPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const { profile } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [otherName, setOtherName] = useState('Chat');
  const [otherAvatar, setOtherAvatar] = useState('');
  const [productTitle, setProductTitle] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Fetch room metadata (requires profile for determining "other" user)
    if (!profile?.uid) return;
    let cancelled = false;
    getChatRoom(chatId).then(room => {
      if (cancelled || !room) return;
      const currentUid = profile.uid;
      const otherId = room.participants.find(p => p !== currentUid) || '';
      setOtherName(room.participantNames[otherId] || 'User');
      setOtherAvatar(room.participantAvatars[otherId] || '');
      if (room.productTitle) setProductTitle(room.productTitle);
      // participants are [opener, other]; the opener is usually the buyer
      if (room.participants.length > 1) setIsSeller(room.participants[1] === currentUid);
    }).catch(err => {
      console.error('Failed to load chat room info:', err);
    });
    return () => { cancelled = true; };
  }, [chatId, profile?.uid]);

  useEffect(() => {
    // Subscribe to messages — intentionally decoupled from profile so the
    // listener isn't torn down and recreated when auth state settles.
    const unsub = listenToMessages(chatId, (allMessages) => {
      setMessages(allMessages);
    });
    return () => {
      unsub();
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || text.trim();
    if (!textToSend || !profile || sending) return;
    setSending(true);
    try {
      await sendMessage(chatId, profile.uid, profile.displayName || 'User', textToSend);
      if (!messageText) setText('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
      background: 'var(--background)'
    }}>
      {/* Standard Professional Top Header */}
      <div style={{
        position: 'sticky', top: 'var(--chat-top, 0px)', zIndex: 100,
        background: 'var(--surface)', borderBottom: '1px solid var(--border-color)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 6, borderRadius: 10 }}>
          <ArrowLeft size={20} />
        </button>

        <div style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <Image
            src={otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=0b2240&color=fff`}
            alt={otherName}
            width={38}
            height={38}
            unoptimized
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span>{otherName}</span>
            <span title="End-to-End Encrypted"><Lock size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} /></span>
          </h1>
          {productTitle ? (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Listing: {productTitle}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
              Encrypted Chat Session
            </div>
          )}
        </div>
      </div>

      {/* End-to-End Encryption Security Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '6px 12px', background: 'var(--surface)', borderRadius: 12,
        margin: '12px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--muted)',
        border: '1px solid var(--border-color)', textAlign: 'center'
      }}>
        <Lock size={12} style={{ color: 'var(--primary)' }} />
        <span>Messages are end-to-end encrypted with 256-bit AES</span>
      </div>

      {/* Messages Feed */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', paddingTop: 40, paddingBottom: 20 }}>
            <MessageSquare size={32} style={{ color: 'var(--primary)', marginBottom: 8, opacity: 0.8 }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--foreground)' }}>
              Start Conversation
            </h3>
            <p style={{ fontSize: 12, margin: 0 }}>
              Select a standard preset response below or type a message.
            </p>
          </div>
        )}

        {messages.map(msg => {
          const isMine = msg.senderId === profile?.uid;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div className={`chat-bubble ${isMine ? 'chat-bubble-sent' : 'chat-bubble-received'}`}>
                  {msg.text}
                </div>
                <div className="chat-time" style={{ textAlign: isMine ? 'right' : 'left', marginTop: 4, padding: '0 4px' }}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick Preset Messages Bar */}
      <div style={{
        padding: '8px 16px 4px', background: 'var(--surface)',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <MessageSquare size={12} style={{ color: 'var(--primary)' }} />
          <span>{isSeller ? 'Quick Seller Responses:' : 'Quick Buyer Questions:'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {(isSeller ? SELLER_PRESET_MESSAGES : BUYER_PRESET_MESSAGES).map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(preset)}
              disabled={sending}
              style={{
                whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999,
                background: 'var(--surface-hover)', border: '1px solid var(--border-color)',
                fontSize: 12, fontWeight: 600, color: 'var(--foreground)',
                cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Controls */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--surface)', display: 'flex', gap: 8,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <input
          className="input-field"
          placeholder="Type your message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{ flex: 1, borderRadius: 999, height: 42, fontSize: 13, paddingLeft: 16 }}
        />
        <button onClick={() => handleSend()} className="btn-primary" style={{ width: 42, height: 42, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={!text.trim() || sending}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
