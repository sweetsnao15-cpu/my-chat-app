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
        userName: msg.user_name || 'ゲスト',
        userIcon: msg.user_icon || 'https://www.gravatar.com/avatar/0?d=mp',
        lastMessage: msg.content,
        timestamp: msg.created_at
      };
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // --- スタイル定義（ゲスト側のシックな黒・金デザインに統一） ---
  const containerStyle = { display: 'flex', height: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif' };
  const sidebarStyle = { width: '300px', backgroundColor: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' };
  const mainStyle = { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#000', position: 'relative' };
  const headerStyle = { padding: '15px', backgroundColor: '#111', borderBottom: '1px solid #D4AF37', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#D4AF37' };
  
  return (
    <div style={containerStyle}>
      
      {/* 左側サイドバー */}
      <div style={sidebarStyle}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
          <h2 style={{ fontSize: '16px', color: '#D4AF37', margin: '0 0 15px 0', textAlign: 'center' }}>CONTROL PANEL</h2>
          <div style={{ display: 'flex', gap: '5px', backgroundColor: '#222', padding: '3px', borderRadius: '8px' }}>
            <button 
              onClick={() => setViewMode('dm')}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', backgroundColor: viewMode === 'dm' ? '#D4AF37' : 'transparent', color: viewMode === 'dm' ? '#000' : '#fff', fontWeight: 'bold' }}
            >DM</button>
            <button 
              onClick={() => setViewMode('comment')}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', backgroundColor: viewMode === 'comment' ? '#D4AF37' : 'transparent', color: viewMode === 'comment' ? '#000' : '#fff', fontWeight: 'bold' }}
            >COMMENT</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {viewMode === 'dm' && chatList.map((user) => (
            <div 
              key={user.userId} 
              onClick={() => setSelectedUserId(user.userId)}
              style={{ display: 'flex', padding: '15px', cursor: 'pointer', borderBottom: '1px solid #222', backgroundColor: selectedUserId === user.userId ? '#222' : 'transparent', transition: '0.2s' }}
            >
              <img src={user.userIcon} style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px', border: '1px solid #D4AF37' }} alt="" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: selectedUserId === user.userId ? '#D4AF37' : '#fff' }}>{user.userName}</div>
                <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右側メイン画面 */}
      <div style={mainStyle}>
        <div style={headerStyle}>
          <span>{viewMode === 'dm' ? (selectedUserId ? `${userList[selectedUserId]?.userName} との対話` : 'ユーザーを選択してください') : '全コメント表示'}</span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundImage: 'radial-gradient(#1a1a1a 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          {messages
            .filter(msg => {
              if (viewMode === 'comment') return true;
              return msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId);
            })
            .map((msg) => {
              const isAdmin = msg.user_id === ADMIN_ID;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px', alignItems: 'flex-start' }}>
                  {!isAdmin && <img src={msg.user_icon || 'https://www.gravatar.com/avatar/0?d=mp'} style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '10px', border: '1px solid #D4AF37' }} alt="" />}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    {!isAdmin && <span style={{ fontSize: '10px', color: '#D4AF37', marginBottom: '4px', marginLeft: '4px' }}>{msg.user_name}</span>}
                    
                    <div style={{
                      padding: '10px 14px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      borderRadius: isAdmin ? '15px 15px 2px 15px' : '15px 15px 15px 2px',
                      backgroundColor: isAdmin ? '#000' : '#222',
                      color: '#fff',
                      border: isAdmin ? '1px solid #D4AF37' : '1px solid #333',
                      boxShadow: isAdmin ? '0 0 10px rgba(212, 175, 55, 0.2)' : 'none'
                    }}>
                      {msg.content}
                      {msg.image_url && (
                        <div style={{ marginTop: '10px' }}>
                          <img src={msg.image_url} style={{ width: '100%', borderRadius: '8px', border: '1px solid #444' }} alt="" />
                        </div>
                      )}
                    </div>
                    
                    <span style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
