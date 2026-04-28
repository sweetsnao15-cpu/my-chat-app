"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const [chats, setChats] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [deletedIds, setDeletedIds] = useState([]);
  const scrollRef = useRef(null);
  const longPressTimer = useRef(null);

  useEffect(() => {
    fetchChats();
    const channel = supabase.channel('admin_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchChats();
        if (selectedUser) fetchMessages(selectedUser.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser]);

  const fetchChats = async () => {
    const { data: msgs } = await supabase.from('messages').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    const userMap = {};
    msgs?.forEach(m => {
      const uid = m.user_id === "bed1d346-5186-49cb-a371-1aad719c2a56" ? m.receiver_id : m.user_id;
      if (!userMap[uid]) userMap[uid] = { id: uid, profile: m.profiles, lastMsg: m };
    });
    setChats(Object.values(userMap));
  };

  const fetchMessages = async (userId) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`user_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedUser) return;
    await supabase.from('messages').insert({
      content: inputText.trim(),
      user_id: "bed1d346-5186-49cb-a371-1aad719c2a56",
      receiver_id: selectedUser.id,
      is_read: false
    });
    setInputText('');
  };

  // メニュー表示ロジック（ゲスト側と統一）
  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const handleTouchStart = (e, msg) => {
    longPressTimer.current = setTimeout(() => openMenu(e, msg), 600);
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  return (
    <div onClick={() => setContextMenu(null)} style={{ display: 'flex', height: '100dvh', background: '#000', color: '#fff', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
      
      {/* メニュー：ゲスト側と同一デザイン */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #333' }}
                  onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #333' }}
                  onClick={() => { setDeletedIds([...deletedIds, contextMenu.msg.id]); setContextMenu(null); }}>削除</button>
          
          <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}
                  onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }}>送信取消</button>
        </div>
      )}

      {/* サイドバー */}
      <div style={{ width: '300px', borderRight: '1px solid #800000', overflowY: 'auto', background: '#0a0a0a' }}>
        <div style={{ padding: '20px', fontSize: '1.5rem', fontWeight: 'bold', color: '#800000', borderBottom: '1px solid #800000' }}>ADMIN PANEL</div>
        {chats.map(chat => (
          <div key={chat.id} onClick={() => { setSelectedUser(chat); fetchMessages(chat.id); }} 
               style={{ padding: '15px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', background: selectedUser?.id === chat.id ? '#1a0000' : 'transparent' }}>
            <div style={{ fontWeight: 'bold' }}>{chat.profile?.username || 'Guest User'}</div>
            <div style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.lastMsg.content}</div>
          </div>
        ))}
      </div>

      {/* メインチャット */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            <header style={{ height: '80px', background: '#800000', borderBottom: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontSize: '2.4rem', fontStyle: 'italic', fontWeight: 'bold', paddingTop: '10px' }}>for VAU</span>
              <div style={{ position: 'absolute', left: '20px', bottom: '15px', fontSize: '0.9rem' }}>Chat with: {selectedUser.profile?.username}</div>
            </header>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#050505' }}>
              {messages.filter(m => !deletedIds.includes(m.id)).map(m => {
                const isAdmin = m.user_id === "bed1d346-5186-49cb-a371-1aad719c2a56";
                return (
                  <div key={m.id} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                    <div 
                      onContextMenu={(e) => openMenu(e, m)}
                      onTouchStart={(e) => handleTouchStart(e, m)}
                      onTouchEnd={handleTouchEnd}
                      style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isAdmin ? 'row-reverse' : 'row', width: '100%' }}
                    >
                      <div style={{ 
                        padding: m.is_image ? '5px' : '12px 16px', 
                        background: isAdmin ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                        borderRadius: isAdmin ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                        border: isAdmin ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                        maxWidth: '85%', // 横に広がるように制限を緩和
                        width: 'fit-content', // 中身に合わせて広がる
                        fontSize: '0.95rem', color: '#fff', wordBreak: 'break-word'
                      }}>
                        {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px' }} /> : m.content}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#444' }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #800000', display: 'flex', gap: '10px' }}>
              <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Type a message..." 
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '10px', padding: '10px', resize: 'none', outline: 'none' }} />
              <button onClick={handleSend} style={{ background: '#800000', border: 'none', color: '#fff', padding: '0 30px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>SEND</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '2rem' }}>Select a chat to start</div>
        )}
      </div>
    </div>
  );
}
