import { encryptMessage, decryptMessage } from './crypto';
import { supabase } from './supabase';
import { toMillis } from './time';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ChatRoom {
  id: string;
  /** [opener, other] — the buyer usually opens the room */
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage: string;
  lastMessageTime: number;
  lastSenderId?: string;
  productId?: string;
  productTitle?: string;
}

export function getChatRoomId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

interface ChatRow {
  id: string;
  participants?: string[] | null;
  participant_names?: Record<string, string> | null;
  participant_avatars?: Record<string, string> | null;
  last_message?: string | null;
  last_message_at?: string | null;
  last_sender_id?: string | null;
  product_id?: string | null;
  product_title?: string | null;
}

interface MessageRow {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  text?: string | null;
  created_at?: string | null;
}

function mapRoom(row: ChatRow): ChatRoom {
  return {
    id: row.id,
    participants: row.participants || [],
    participantNames: row.participant_names || {},
    participantAvatars: row.participant_avatars || {},
    lastMessage: row.last_message || '',
    lastMessageTime: toMillis(row.last_message_at),
    lastSenderId: row.last_sender_id || undefined,
    productId: row.product_id || '',
    productTitle: row.product_title || '',
  };
}

/**
 * Opens (or reuses) the room between the signed-in user and `otherUid`;
 * names and avatars come from the profiles.
 */
export async function openChat(otherUid: string, productId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_chat', { p_other: otherUid, p_product_id: productId || null });
  if (error) throw new Error(error.message || 'Could not open the chat');
  return data as string;
}

export async function getChatRoom(roomId: string): Promise<ChatRoom | null> {
  const { data, error } = await supabase.from('chats').select('*').eq('id', roomId).maybeSingle();
  if (error || !data) return null;
  return mapRoom(data);
}

export async function sendMessage(
  roomId: string, senderId: string, senderName: string, text: string
): Promise<void> {
  const encryptedText = await encryptMessage(text, roomId);
  const { error } = await supabase.from('messages').insert({
    chat_id: roomId,
    sender_id: senderId,
    sender_name: senderName,
    text: encryptedText,
  });
  if (error) throw new Error(error.message || 'Message not sent');
}

async function decryptRow(row: MessageRow, roomId: string): Promise<ChatMessage> {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name || '',
    text: await decryptMessage(row.text || '', roomId),
    timestamp: toMillis(row.created_at) || Date.now(),
  };
}

/** Delivers the full, decrypted message list on load and on every new message */
export function listenToMessages(
  roomId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  let messages: ChatMessage[] = [];
  let closed = false;

  const publish = () => {
    if (!closed) callback([...messages].sort((a, b) => a.timestamp - b.timestamp));
  };

  void (async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', roomId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      console.error('Load messages error:', error.message);
      return;
    }
    const decrypted = await Promise.all((data || []).map(row => decryptRow(row, roomId)));
    // Keep anything that arrived over realtime while the history loaded
    const seen = new Set(decrypted.map(m => m.id));
    messages = [...decrypted, ...messages.filter(m => !seen.has(m.id))];
    publish();
  })();

  const channel = supabase
    .channel(`messages:${roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${roomId}` },
      async payload => {
        const msg = await decryptRow(payload.new as MessageRow, roomId);
        if (!messages.some(m => m.id === msg.id)) {
          messages = [...messages, msg];
          publish();
        }
      })
    .subscribe();

  return () => {
    closed = true;
    void supabase.removeChannel(channel);
  };
}

async function withPreviews(rooms: ChatRoom[]): Promise<ChatRoom[]> {
  // Previews are stored encrypted, like the messages themselves
  return Promise.all(rooms.map(async room => ({
    ...room,
    lastMessage: room.lastMessage ? await decryptMessage(room.lastMessage, room.id) : '',
  })));
}

export async function getUserChatRooms(userId: string): Promise<ChatRoom[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .contains('participants', [userId])
    .order('last_message_at', { ascending: false });
  if (error || !data) return [];
  return withPreviews(data.map(mapRoom));
}

/**
 * Real-time listener for chat rooms — new conversations and fresh messages
 * reorder the list without a refresh.
 */
export function listenToChatRooms(
  userId: string,
  callback: (rooms: ChatRoom[]) => void
): () => void {
  let closed = false;
  const load = async () => {
    const rooms = await getUserChatRooms(userId);
    if (!closed) callback(rooms);
  };
  void load();

  // Realtime can't filter on array membership; row-level security already
  // limits the events to rooms this user is in.
  const channel = supabase
    .channel(`chats:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => { void load(); })
    .subscribe();

  return () => {
    closed = true;
    void supabase.removeChannel(channel);
  };
}
