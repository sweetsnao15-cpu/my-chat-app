"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const scrollRef = useRef(null);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedUserId, viewMode, messages]);

  const userList = messages.reduce((acc, msg) => {
    if (msg.user_id !== ADMIN_ID) {
      acc[msg.user_id] = {
        userId: msg.user_id,
        userName: msg.username || 'GUEST',
        userIcon: msg.avatar_url || 'https://www.gravatar.com/avatar/0?d=mp',
        lastMessage: msg.content,
        timestamp: msg.created_at
      };
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const isImage = (text) => {
    return typeof text === 'string' && text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) != null;
  };

  // --- 色の定義 ---
  const COLORS = {
    bg: '#000000',
    sidebar: '#0a0a0a',
    accent: '#D4AF37', // 金
    danger: '#B22222', // 赤 (Firebrick)
    text: '#ffffff',
    border: '#222222'
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: '"Hiragino Kaku Gothic ProN", Meiryo, sans-serif' }}>
      
      {/* サイドバー */}
      <div style={{ width: '320px', backgroundColor: COLORS.sidebar, borderRight: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px 20px', borderBottom: `2px solid ${COLORS.danger}` }}>
          <h2 style={{ fontSize: '12px', color: COLORS.accent, letterSpacing: '4px', textAlign: 'center', marginBottom: '20px' }}>ADMIN PANEL</h2>
          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#1a1a1a', padding: '4px', borderRadius: '4px' }}>
            <button onClick={() => setViewMode('dm')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', backgroundColor: viewMode === 'dm' ? COLORS.danger : 'transparent', color: '#fff', fontWeight: 'bold', transition: '0.3s' }}>DM</button>
            <button onClick={() => setViewMode('comment')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', backgroundColor: viewMode === 'comment' ? COLORS.danger : 'transparent', color: '#fff', fontWeight: 'bold', transition: '0.3s' }}>ALL</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {viewMode === 'dm' && chatList.map((user) => (
            <div key={user.userId} onClick={() => setSelectedUserId(user.userId)} style={{ display: 'flex', padding: '15px', cursor: 'pointer', borderBottom: '1px solid #111', backgroundColor: selectedUserId === user.userId ? '#1a0505' : 'transparent', borderLeft: selectedUserId === user.userId ? `4px solid ${COLORS.danger}` : '4px solid transparent', transition: '0.2s' }}>
              <img src={user.userIcon} style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '15px', border: `1px solid ${COLORS.accent}`, objectFit: 'cover' }} alt="" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: selectedUserId === user.userId ? COLORS.accent : '#fff' }}>{user.userName}</div>
                <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* メイン画面 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: COLORS.bg }}>
        <div style={{ padding: '20px 25px', borderBottom: '1px solid #1a1a1a', color: COLORS.accent, fontSize: '12px', letterSpacing: '2px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>{viewMode === 'dm' ? (selectedUserId ? `LOG: ${userList[selectedUserId]?.userName}` : 'SELECT GUEST') : 'MONITORING ALL'}</span>
          <span style={{ color: COLORS.danger }}>● LIVE</span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '30px 20px', backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`, backgroundSize: '40px 40px' }}>
          {messages
            .filter(msg => {
              if (viewMode === 'comment') return true;
              return msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId);
            })
            .map((msg) => {
              const isAdmin = msg.user_id === ADMIN_ID;
              const isMsgImage = isImage(msg.content);

              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '30px' }}>
                  {!isAdmin && (
                    <img src={msg.avatar_url || userList[msg.user_id]?.userIcon} 
                         style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px', border: `1px solid ${COLORS.danger}`, alignSelf: 'flex-start', objectFit: 'cover' }} alt="" />
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    {!isAdmin && <span style={{ fontSize: '10px', color: COLORS.accent, marginBottom: '6px', fontWeight: 'bold', letterSpacing: '1px' }}>{msg.username}</span>}
                    
                    <div style={{
                      padding: isMsgImage ? '6px' : '12px 18px', 
                      borderRadius: isAdmin ? '20px 20px 2px 20px' : '20px 20px 20px 2px',
                      fontSize: '14px', lineHeight: '1.7',
                      backgroundColor: isAdmin ? '#000' : '#111', 
                      color: '#fff',
                      border: isAdmin ? `1px solid ${COLORS.danger}` : `1px solid ${COLORS.border}`,
                      boxShadow: isAdmin ? `0 0 20px rgba(178, 34, 34, 0.2)` : 'none'
                    }}>
                      {isMsgImage ? (
                        <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '15px', display: 'block' }} alt="uploaded" />
                      ) : (
                        msg.content
                      )}
                    </div>
                    <span style={{ fontSize: '9px', color: '#555', marginTop: '8px', letterSpacing: '1px' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
