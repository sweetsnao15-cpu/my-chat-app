"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const scrollRef = useRef(null);

  const COLORS = {
    bg: '#000000',
    guestRed: '#800000', 
    accentGold: '#D4AF37',
    textWhite: '#FFFFFF',
    darkBorder: '#333'
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  };

  const markAsRead = async (userId) => {
    if (!userId) return;
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('receiver_id', ADMIN_ID)
      .eq('is_read', false);
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel('admin-db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      fetchMessages();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      markAsRead(selectedUserId);
    }
  }, [selectedUserId, messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedUserId, messages]);

  // ユーザーリストの集計（未読数含む）
  const userList = messages.reduce((acc, msg) => {
    if (msg.user_id !== ADMIN_ID && msg.user_id) {
      const isUnread = !msg.is_read && msg.receiver_id === ADMIN_ID;
      if (!acc[msg.user_id]) {
        acc[msg.user_id] = {
          userId: msg.user_id,
          userName: msg.username || 'GUEST',
          userIcon: msg.avatar_url || '',
          lastMessage: msg.content,
          timestamp: msg.created_at,
          unreadCount: 0
        };
      }
      if (isUnread) {
        acc[msg.user_id].unreadCount++;
      }
      if (new Date(msg.created_at) > new Date(acc[msg.user_id].timestamp)) {
        acc[msg.user_id].lastMessage = msg.content;
        acc[msg.user_id].timestamp = msg.created_at;
      }
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div style={{ 
      maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: COLORS.bg, color: COLORS.textWhite, position: 'relative', overflow: 'hidden'
    }}>
      
      <header style={{ 
        padding: '10px 25px', background: COLORS.guestRed, borderBottom: `2px solid ${COLORS.accentGold}`,
        display: 'flex', alignItems: 'center', minHeight: '80px', position: 'relative', zIndex: 10 
      }}>
        {/* 幅を固定して文字を中央に寄せる */}
        <div style={{ width: '60px', display: 'flex', alignItems: 'center' }}>
          {selectedUserId && (
            <div onClick={() => setSelectedUserId(null)} style={{ cursor: 'pointer', fontSize: '24px', color: COLORS.accentGold, fontWeight: 'bold' }}>✕</div>
          )}
        </div>
        <h1 style={{ 
          flex: 1, textAlign: 'center', fontSize: '2.2rem', fontWeight: '700', letterSpacing: '3px',
          fontFamily: '"Times New Roman", Times, serif', fontStyle: 'italic', textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          margin: 0
        }}>
          {viewMode === 'dm' ? (selectedUserId ? userList[selectedUserId]?.userName : "ADMIN") : "GLOBAL"}
        </h1>
        <div style={{ width: '60px' }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', background: '#000' }}>
        {viewMode === 'dm' && !selectedUserId ? (
          <div>
            {chatList.map((u) => (
              <div key={u.userId} onClick={() => setSelectedUserId(u.userId)} style={{ 
                display: 'flex', padding: '20px 15px', alignItems: 'center', borderBottom: `1px solid ${COLORS.darkBorder}`
              }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: COLORS.accentGold, marginRight: '15px', border: `2px solid ${COLORS.accentGold}`, overflow: 'hidden' }}>
                  {u.userIcon ? <img src={u.userIcon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ textAlign: 'center', lineHeight: '50px', fontWeight: 'bold' }}>V</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: u.unreadCount > 0 ? COLORS.accentGold : '#fff' }}>{u.userName}</div>
                  <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{u.lastMessage}</div>
                </div>
                {/* 吹き出し数の表示を連動 */}
                {u.unreadCount > 0 && (
                  <div style={{ background: COLORS.guestRed, color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', border: `1px solid ${COLORS.accentGold}` }}>{u.unreadCount}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            {messages.filter(m => viewMode === 'comment' || m.user_id === selectedUserId || (m.user_id === ADMIN_ID && (m.recipient_id === selectedUserId || m.receiver_id === selectedUserId))).map((m) => {
              const isAdmin = m.user_id === ADMIN_ID;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                  {!isAdmin &&
