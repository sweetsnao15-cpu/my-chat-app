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

  const markAsRead = async (userId) => {
    if (!userId) return;
    await supabase.from('messages').update({ is_read: true }).eq('user_id', userId).eq('receiver_id', ADMIN_ID).eq('is_read', false);
  };

  useEffect(() => {
    fetchMessages();
    const ch = supabase.channel('admin-db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    if (selectedUserId) markAsRead(selectedUserId);
  }, [selectedUserId, messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selectedUserId, messages, viewMode]);

  // ユーザー情報の集約
  const userList = messages.reduce((acc, m) => {
    if (m.user_id !== ADMIN_ID && m.user_id) {
      if (!acc[m.user_id]) acc[m.user_id] = { userId: m.user_id, userName: m.username || 'GUEST', icon: m.avatar_url, last: m.content, time: m.created_at, unread: 0 };
      if (!m.is_read && m.receiver_id === ADMIN_ID) acc[m.user_id].unread++;
      if (new Date(m.created_at) > new Date(acc[m.user_id].time)) { 
        acc[m.user_id].last = m.content; 
        acc[m.user_id].time = m.created_at; 
        // 最新のプロフィール情報を優先
        acc[m.user_id].userName = m.username || acc[m.user_id].userName;
        acc[m.user_id].icon = m.avatar_url || acc[m.user_id].icon;
      }
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: COLORS.bg, color: '#fff' }}>
      
      <header style={{ 
        padding: '10px 25px', background: COLORS.red, borderBottom: `2px solid ${COLORS.gold}`, 
        display: 'flex', alignItems: 'center', minHeight: '80px', position: 'relative'
      }}>
        {/* 左側: 戻るボタンエリア (固定幅で中央寄せを維持) */}
        <div style={{ width: '60px', display: 'flex', alignItems: 'center' }}>
          {selectedUserId && (
            <div onClick={() => setSelectedUserId(null)} style={{ cursor: 'pointer', fontSize: '24px', color: COLORS.gold, fontWeight: 'bold' }}>✕</div>
          )}
        </div>

        {/* 中央: タイトル / 選択時プロフィール */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {selectedUserId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `1px solid ${COLORS.gold}`, overflow: 'hidden', background: '#333' }}>
                {userList[selectedUserId]?.icon ? (
                  <img src={userList[selectedUserId].icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div style={{ textAlign: 'center', lineHeight: '32px', fontSize: '14px', fontWeight: 'bold' }}>V</div>
                )}
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                {userList[selectedUserId]?.userName}
              </span>
            </div>
          ) : (
            <h1 style={{ 
              fontSize: '2.2rem', fontFamily: '"Times New Roman", serif', fontStyle: 'italic', letterSpacing: '3px', margin: 0 
            }}>
              {viewMode === 'dm' ? "ADMIN" : "GLOBAL"}
            </h1>
          )}
        </div>

        {/* 右側: バランス用の余白 (固定幅) */}
        <div style={{ width: '60px' }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {viewMode === 'dm' && !selectedUserId ? (
          chatList.map(u => (
            <div key={u.userId} onClick={() => setSelectedUserId(u.userId)} style={{ display: 'flex', padding: '20px 15px', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: `2px solid ${COLORS.gold}`, overflow: 'hidden', marginRight: '15px', background: '#333' }}>
                {u.icon ? <img src={u.icon} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : <div style={{textAlign:'center', lineHeight:'50px', fontWeight: 'bold'}}>V</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: u.unread > 0 ? COLORS.gold : '#fff' }}>{u.userName}</div>
                <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{u.last}</div>
              </div>
              {u.unread > 0 && (
                <div style={{ background: COLORS.red, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', border: `1px solid ${COLORS.gold}`, fontWeight: 'bold' }}>{u.unread}</div>
              )}
            </div>
          ))
        ) : (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            {messages.filter(m => viewMode === 'comment' || (m.user_id === selectedUserId || (m.user_id === ADMIN_ID && m.recipient_id === selectedUserId))).map(m => {
              const isAdmin = m.user_id === ADMIN_ID;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                  {/* GLOBALモードの時だけアイコンと名前を表示 */}
                  {viewMode === 'comment' && !isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #D4AF37', overflow: 'hidden', marginRight: '6px', background: '#333' }}>
                        {m.avatar_url ? <img src={m.avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : <div style={{textAlign:'center', fontSize:'10px', fontWeight: 'bold'}}>V</div>}
                      </div>
                      <span style={{ fontSize: '12px', color: COLORS.gold, fontWeight: 'bold' }}>{m.username}</span>
                    </div>
                  )}
                  <div style={{ 
                    padding: m.is_image ? '5px' : '10px 16px', borderRadius: '18px', 
                    background: COLORS.red, maxWidth: '85%', color: '#fff' 
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px', display: 'block' }} alt=""/> : m.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer style={{ height: '70px', background: COLORS.red, borderTop: `2px solid ${COLORS.gold}`, display: 'flex', alignItems: 'center' }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ flex: 1, textAlign: 'center', opacity: viewMode === 'dm' ? 1 : 0.4, cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px' }}>DIRECT</div>
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ flex: 1, textAlign: 'center', opacity: viewMode === 'comment' ? 1 : 0.4, cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px' }}>GLOBAL</div>
      </footer>
    </div>
  );
}
