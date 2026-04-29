"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
// app/page.js の3行目を修正
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(prof);
        fetchMessages(session.user.id);
      }
    };
    init();

    const channel = supabase.channel('chat_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (user) fetchMessages(user.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // メッセージ数が増えた時（新規受信・送信）のみ自動スクロール
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('auto');
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  const fetchMessages = async (userId) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(user_id.eq.${userId},receiver_id.eq.${ADMIN_ID}),and(user_id.eq.${ADMIN_ID},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSend = async (content, isImage = false) => {
    const text = content?.trim();
    if (!text || !user || isUploading) return;
    if (!isImage) setInputText('');

    const { error } = await supabase.from('messages').insert([
      { content: text, user_id: user.id, receiver_id: ADMIN_ID, is_image: isImage }
    ]);
    if (!error) fetchMessages(user.id);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSend(publicUrl, true);
    }
    setIsUploading(false);
  };

  const executeDelete = async (msgId) => {
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setContextMenu(null);
    }
  };

  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none' }}>
      
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => executeDelete(contextMenu.msg.id)}>送信取消</button>
        </div>
      )}

      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '2px' }}>for VAU</h1>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {messages.map((m, index) => {
            const isMe = m.user_id === user?.id;
            const date = new Date(m.created_at);
            
            // ホスト側と同じデザインの年月日
            const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

            return (
              <div key={m.id}>
                {isNewDay && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic', opacity: 0.6 }}>{dateStr}</div>
                  </div>
                )}
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '85%' }}>
                    <div 
                      onContextMenu={isMe ? (e) => openMenu(e, m) : null}
                      onTouchStart={isMe ? (e) => { longPressTimer.current = setTimeout(() => openMenu(e, m), 600); } : null}
                      onTouchEnd={() => clearTimeout(longPressTimer.current)}
                      style={{ padding: m.is_image ? '5px' : '12px 16px', background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', backdropFilter: 'blur(4px)', borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', fontSize: '0.95rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {m.is_image ? <img src={m.content} onLoad={() => scrollToBottom('auto')} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#D4AF37', whiteSpace: 'nowrap', paddingBottom: '2px' }}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <button onClick={() => fileInputRef.current.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.6rem', padding: '5px', cursor: 'pointer' }}>{isUploading ? '...' : '⊕'}</button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
          <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Message..." rows={1} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', padding: '10px 15px', resize: 'none', fontSize: '16px', outline: 'none', fontFamily: 'serif', maxHeight: '150px' }} />
          <button onClick={() => handleSend(inputText)} style={{ background: '#000', color: '#D4AF37', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #D4AF37', cursor: 'pointer', fontFamily: 'serif' }}>SEND</button>
        </div>
      </div>
    </div>
  );
}
