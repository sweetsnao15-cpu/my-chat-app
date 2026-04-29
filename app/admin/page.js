"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const scrollRef = useRef(null);
  const longPressTimer = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel('admin_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchInitialData = async () => {
    await Promise.all([fetchProfiles(), fetchMessages()]);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      const pMap = {};
      data.forEach(p => { pMap[p.id] = p; });
      setProfiles(pMap);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  // 送信取消（削除）機能
  const deleteMessage = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== id));
      setContextMenu(null);
    }
  };

  const handleSendAll = async () => {
    const text = inputText.trim();
    if (!text) return;
    const { data: users } = await supabase.from('profiles').select('id');
    if (users) {
      const newMsgs = users.map(u => ({
        content: text,
        user_id: ADMIN_ID,
        receiver_id: u.id,
        is_read: false
      }));
      await supabase.from('messages').insert(newMsgs);
      setInputText('');
    }
  };

  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const handleTouchStart = (e, msg) => {
    // 管理者（右側）のメッセージのみメニューを出す
    if (msg.user_id === ADMIN_ID) {
      longPressTimer.current = setTimeout(() => openMenu(e, msg), 600);
    }
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  if (loading) return <div style={{ height: '100dvh', background: '#000' }} />;

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050505', color: '#fff', fontFamily: 'serif', overflow: 'hidden' }}>
      
      {/* 送信取消用メニュー */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 50, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '8px', zIndex: 10000, boxShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>
          <button onClick={() => deleteMessage(contextMenu.msg.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '10px 20px', cursor: 'pointer', fontSize: '0.9rem' }}>送信取消</button>
        </div>
      )}

      <header style={{ height: '70px', background: '#800000', borderBottom: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '1.5rem', fontStyle: 'italic', fontWeight: 'bold', letterSpacing: '2px' }}>ADMIN CONSOLE</span>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {messages.map((m, index) => {
            const isMe = m.user_id === ADMIN_ID;
            const profile = profiles[m.user_id] || {};
            const date = new Date(m.created_at);
            const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

            return (
              <div key={m.id}>
                {isNewDay && (
                  <div style={{ textAlign: 'center', margin: '30px 0', color: '#D4AF37', fontSize: '0.9rem', fontWeight: 'bold', fontStyle: 'italic' }}>
                    {dateStr}
                  </div>
                )}

                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', marginLeft: '5px' }}>
                      <img src={profile.avatar_url || ''} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #D4AF37', objectFit: 'cover', background: '#333' }} alt="" />
                      <span style={{ fontSize: '0.75rem', color: '#D4AF37', fontWeight: 'bold' }}>{profile.username || 'Unknown'}</span>
                    </div>
                  )}
                  
                  <div 
                    onContextMenu={isMe ? (e) => openMenu(e, m) : null}
                    onTouchStart={isMe ? (e) => handleTouchStart(e, m) : null}
                    onTouchEnd={handleTouchEnd}
                    style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '90%' }}
                  >
                    <div style={{ 
                      padding: m.is_image ? '5px' : '10px 14px', 
                      background: isMe ? 'rgba(80, 0, 0, 0.6)' : 'rgba(26, 26, 26, 0.8)', 
                      borderRadius: isMe ? '15px 2px 15px 15px' : '2px 15px 15px 15px', 
                      border: isMe ? '1px solid rgba(128, 0, 0, 0.5)' : '1px solid #D4AF37',
                      fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                    }}>
                      {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '8px' }} alt="chat" /> : m.content}
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#D4AF37', minWidth: '35px' }}>{timeStr}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 入力エリア（スマホ対応） */}
      <div style={{ padding: '15px', background: '#111', borderTop: '1px solid #800000', flexShrink: 0 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            placeholder="全員へのメッセージを入力..."
            rows={1}
            style={{ 
              flex: 1, background: '#000', color: '#fff', border: '1px solid #333', 
              borderRadius: '15px', padding: '10px 15px', fontSize: '16px', outline: 'none', 
              resize: 'none', maxHeight: '150px', lineHeight: '1.4' 
            }}
          />
          <button 
            onClick={handleSendAll}
            style={{ 
              background: '#800000', color: '#fff', border: '1px solid #D4AF37', 
              padding: '10px 20px', borderRadius: '15px', fontWeight: 'bold', 
              cursor: 'pointer', flexShrink: 0 
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
