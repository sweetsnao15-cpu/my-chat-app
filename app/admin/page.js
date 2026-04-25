"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [viewMode, setViewMode] = useState('dm');
  const scrollRef = useRef(null);

  const COLORS = { bg: '#000', red: '#800000', gold: '#D4AF37', border: '#333' };

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  // 既読にする処理
  const markAsRead = async (userId) => {
    if (!userId) return;
    await supabase.from('messages').update({ is_read: true })
      .eq('user_id', userId).eq('receiver_id', ADMIN_ID).eq('is_read', false);
  };

  useEffect(() => {
    fetchMessages();
    const ch = supabase.channel('admin-db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      markAsRead(selectedUserId); // チャットを開いたら既読にする
    }
  }, [selectedUserId, messages]); // メッセージが増えた時も再実行

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selectedUserId, messages]);

  const userList = messages.reduce((acc, m) => {
    if (m.user_id !== ADMIN_ID) {
      if (!acc[m.user_id]) acc[m.user_id] = { userId: m.user_id, userName: m.username, icon: m.avatar_url, last: m.content, time: m.created_at, unread: 0 };
      if (!m.is_read && m.receiver_id === ADMIN_ID) acc[m.user_id].unread++;
      if (new Date(m.created_at) > new Date(acc[m.user_id].time)) { acc[m.user_id].last = m.content; acc[m.user_id].time = m.created_at; }
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: COLORS.bg, color: '#fff' }}>
      <header style={{ padding: '10px 25px', background: COLORS.red, borderBottom: `2px solid ${COLORS.gold}`, display: 'flex', alignItems: 'center', minHeight: '80px' }}>
        <div style={{ width: '60px' }}>{selectedUserId && <div onClick={() => setSelectedUserId(null)} style={{ cursor: 'pointer', fontSize: '24px', color: COLORS.gold }}>✕</div>}</div>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '2.2rem', fontFamily: '"Times New Roman", serif', fontStyle: 'italic' }}>
          {selectedUserId ? userList[selectedUserId]?.userName : "ADMIN"}
        </h1>
        <div style={{ width: '60px' }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {viewMode === 'dm' && !selectedUserId ? (
          chatList.map(u => (
            <div key={u.userId} onClick={() => setSelectedUserId(u.userId)} style={{ display: 'flex', padding: '20px 15px', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: `2px solid ${COLORS.gold}`, overflow: 'hidden', marginRight: '15px' }}>
                {u.icon ? <img src={u.icon} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : <div style={{textAlign:'center', lineHeight:'50px'}}>V</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: u.unread > 0 ? COLORS.gold : '#fff' }}>{u.userName}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{u.last}</div>
              </div>
              {u.unread > 0 && <div style={{ background: COLORS.red, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', border: `1px solid ${COLORS.gold}` }}>{u.unread}</div>}
            </div>
          ))
        ) : (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            {messages.filter(m => viewMode === 'comment' || m.user_id === selectedUserId || (m.user_id === ADMIN_ID && m.recipient_id === selectedUserId)).map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.user_id === ADMIN_ID ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                <div style={{ padding: '10px 16px', borderRadius: '18px', background: COLORS.red, fontSize: '14px' }}>{m.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer style={{ height: '70px', background: COLORS.red, borderTop: `2px solid ${COLORS.gold}`, display: 'flex', alignItems: 'center' }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ flex: 1, textAlign: 'center', opacity: viewMode === 'dm' ? 1 : 0.4, fontWeight: 'bold' }}>DIRECT</div>
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ flex: 1, textAlign: 'center', opacity: viewMode === 'comment' ? 1 : 0.4, fontWeight: 'bold' }}>GLOBAL</div>
      </footer>
    </div>
  );
}
