"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function GuestPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMessages(session.user.id);
    });

    const channel = supabase.channel('guest_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (user) fetchMessages(user.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchMessages = async (userId) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`user_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');
    await supabase.from('messages').insert({
      content: text, user_id: user.id, receiver_id: ADMIN_ID, is_image: false, is_read: false
    });
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const renderMessages = () => {
    let lastDate = "";
    return messages.map(m => {
      const currentDate = new Date(m.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
      const showDate = currentDate !== lastDate;
      lastDate = currentDate;
      const isMe = m.user_id === user?.id;

      return (
        <div key={m.id}>
          {showDate && (
            <div style={{ textAlign: 'center', margin: '30px 0 15px', fontSize: '0.7rem', color: '#D4AF37', letterSpacing: '0.1rem', fontFamily: 'serif' }}>― {currentDate} ―</div>
          )}
          <div 
            onContextMenu={(e) => handleContextMenu(e, m)}
            onTouchStart={(e) => {
              const timer = setTimeout(() => handleContextMenu(e, m), 500);
              e.target.ontouchend = () => clearTimeout(timer);
            }}
            style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
              <div style={{ 
                padding: m.is_image ? '5px' : '12px 16px', 
                background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                backdropFilter: 'blur(4px)',
                borderRadius: isMe ? '2px 18px 18px 18px' : '18px 2px 18px 18px', 
                border: isMe ? '1px solid rgba(128, 0, 0, 0.5)' : '1px solid #D4AF37', 
                maxWidth: '85%', fontSize: '0.95rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
              }}>
                {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px' }} alt="" /> : m.content}
              </div>
              <div style={{ fontSize: '0.55rem', color: '#666', marginTop: 'auto', marginBottom: '2px' }}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 60, left: contextMenu.x - 40, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '10px', zIndex: 9999 }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }} style={{ padding: '10px 20px', fontSize: '0.8rem', borderBottom: '1px solid #333' }}>コピー</div>
          {contextMenu.msg.user_id === user?.id && <div onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }} style={{ padding: '10px 20px', fontSize: '0.8rem', color: '#ff4d4d' }}>送信取消</div>}
        </div>
      )}
      <header style={{ padding: '20px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', fontStyle: 'italic', margin: 0, letterSpacing: '2px' }}>for VAU</h1>
      </header>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>{renderMessages()}</div>
      <div style={{ padding: '20px', background: '#800000', borderTop: '1px solid #D4AF37', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '15px', padding: '12px', resize: 'none', minHeight: '45px', maxHeight: '120px', fontSize: '16px', outline: 'none', fontFamily: 'serif' }} />
        <button onClick={handleSend} style={{ background: '#000', color: '#D4AF37', padding: '12px 20px', borderRadius: '15px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '15px' }}>SEND</button>
      </div>
    </div>
  );
}
