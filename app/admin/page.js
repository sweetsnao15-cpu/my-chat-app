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
    if (!error) {
      setMessages(data || []);
    }
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

  // ユーザーリストの生成（正確な列名 username, avatar_url を使用）
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

  // メッセージが画像URL（http...で始まり、拡張子が画像）かどうか判定する関数
  const isImage = (text) => {
    return typeof text === 'string' && text.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* サイドバー */}
      <div style={{ width: '300px', backgroundColor: '#0a0a0a', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #D4AF37' }}>
          <h2 style={{ fontSize: '12px', color: '#D4AF37', letterSpacing: '4px', textAlign: 'center', marginBottom: '20px', fontWeight: 'normal' }}>MANAGER</h2>
          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#1a1a1a', padding: '4px', borderRadius: '4px' }}>
            <button onClick={() => setViewMode('dm')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', backgroundColor: viewMode === 'dm' ? '#D4AF37' : 'transparent', color: viewMode === 'dm' ? '#000' : '#fff', transition: '0.3s' }}>DM</button>
            <button onClick={() => setViewMode('comment')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', backgroundColor: viewMode === 'comment' ? '#D4AF37' : 'transparent', color: viewMode === 'comment' ? '#000' : '#fff', transition: '0.3s' }}>ALL</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {viewMode === 'dm' && chatList.map((user) => (
            <div key={user.userId} onClick={() => setSelectedUserId(user.userId)} style={{ display: 'flex', padding: '15px', cursor: 'pointer', borderBottom: '1px solid #111', backgroundColor: selectedUserId === user.userId ? '#111' : 'transparent', alignItems: 'center' }}>
              <img src={user.userIcon} style={{ width: '42px', height: '42px', borderRadius: '50%', marginRight: '15px', border: '1px solid #D4AF37', objectFit: 'cover' }} alt="" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: selectedUserId === user.userId ? '#D4AF37' : '#fff' }}>{user.userName}</div>
                <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* メイン画面 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
        <div style={{ padding: '18px 25px', borderBottom: '1px solid #1a1a1a', color: '#D4AF37', fontSize: '12px', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{viewMode === 'dm' ? (selectedUserId ? `TALK : ${userList[selectedUserId]?.userName}` : 'SELECT USER') : 'GLOBAL CHAT'}</span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '30px 20px', backgroundImage: 'radial-gradient(#111 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
          {messages
            .filter(msg => {
              if (viewMode === 'comment') return true;
              return msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId);
            })
            .map((msg) => {
              const isAdmin = msg.user_id === ADMIN_ID;
              const isMsgImage = isImage(msg.content);

              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '25px' }}>
                  {!isAdmin && (
                    <img src={msg.avatar_url || userList[msg.user_id]?.userIcon || 'https://www.gravatar.com/avatar/0?d=mp'} 
                         style={{ width: '36px', height: '36px', borderRadius: '50%', marginRight: '12px', border: '1px solid #D4AF37', alignSelf: 'flex-start', objectFit: 'cover' }} alt="" />
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    {!isAdmin && <span style={{ fontSize: '10px', color: '#D4AF37', marginBottom: '6px', fontWeight: 'bold' }}>{msg.username || 'GUEST'}</span>}
                    
                    <div style={{
                      padding: isMsgImage ? '5px' : '12px 16px', 
                      borderRadius: isAdmin ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                      fontSize: '14px', lineHeight: '1.6',
                      backgroundColor: isAdmin ? '#000' : '#1a1a1a', 
                      color: '#fff',
                      border: isAdmin ? '1px solid #D4AF37' : '1px solid #333',
                      boxShadow: isAdmin ? '0 0 15px rgba(212, 175, 55, 0.1)' : 'none'
                    }}>
                      {isMsgImage ? (
                        <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '14px', display: 'block' }} alt="sent" />
                      ) : (
                        msg.content
                      )}
                    </div>
                    <span style={{ fontSize: '9px', color: '#444', marginTop: '6px' }}>
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
