"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [deletedIds, setDeletedIds] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const scrollRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const longPressTimer = useRef(null);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel('admin_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe();
    setLoading(false);
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSend = async (content, isImage = false, receiverId = null) => {
    const text = content?.trim();
    if (!text) return;
    const { error } = await supabase.from('messages').insert([{ 
      content: text, 
      user_id: ADMIN_ID, 
      receiver_id: receiverId, 
      is_image: isImage, 
      is_read: false 
    }]);
    if (!error) {
      if (!isImage) {
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      fetchMessages();
    }
  };

  const handleChatImageUpload = async (e, receiverId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const filePath = `chat/admin/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSend(publicUrl, true, receiverId);
    }
    setIsUploading(false);
  };

  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const handleTouchStart = (e, msg) => { longPressTimer.current = setTimeout(() => openMenu(e, msg), 600); };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  if (loading) return <div style={{ height: '100dvh', background: '#000' }} />;

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none' }}>
      
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { setDeletedIds([...deletedIds, contextMenu.msg.id]); setContextMenu(null); }}>削除</button>
          <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }} onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }}>送信取消</button>
        </div>
      )}

      <header style={{ 
        padding: '40px 15px 20px', 
        background: '#4a0000', 
        borderBottom: '1px solid #D4AF37', 
        display: 'flex', 
        alignItems: 'flex-end', 
        justifyContent: 'center', 
        position: 'relative', 
        flexShrink: 0, 
        zIndex: 10,
        minHeight: '110px'
      }}>
        <span style={{ 
          fontSize: '2.2rem', 
          fontStyle: 'italic', 
          fontWeight: 'bold', 
          letterSpacing: '4px', 
          color: '#fff', 
          textAlign: 'center',
          lineHeight: '1.2'
        }}>
          for VAU <span style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginLeft: '5px' }}>-HOST-</span>
        </span>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '20px' }}>
          {messages.filter(m => !deletedIds.includes(m.id)).map((m) => {
            const isMe = m.user_id === ADMIN_ID;
            const date = new Date(m.created_at);
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            return (
              <div key={m.id} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '85%' }}>
                  <div 
                    onContextMenu={(e) => !m.is_image && openMenu(e, m)}
                    onTouchStart={(e) => !m.is_image && handleTouchStart(e, m)}
                    onTouchEnd={() => !m.is_image && handleTouchEnd()}
                    style={{ 
                      padding: m.is_image ? '5px' : '12px 16px', 
                      background: 'rgba(0, 0, 0, 0.5)', 
                      backdropFilter: 'blur(4px)', 
                      borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                      border: '1px solid #D4AF37', 
                      fontSize: '0.95rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' 
                    }}
                  >
                    {m.is_image ? (
                      <img 
                        src={m.content} 
                        onLoad={() => scrollToBottom('auto')} 
                        onContextMenu={(e) => e.stopPropagation()} 
                        onTouchStart={(e) => e.stopPropagation()}
                        style={{ 
                          maxWidth: '100%', 
                          borderRadius: '10px', 
                          display: 'block',
                          WebkitUserSelect: 'auto',
                          userSelect: 'auto',
                          pointerEvents: 'auto' 
                        }} 
                      />
                    ) : (
                      m.content
                    )}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#D4AF37', whiteSpace: 'nowrap', paddingBottom: '2px' }}>{timeStr}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '12px 15px', background: '#4a0000', borderTop: '1px solid #D4AF37', flexShrink: 0, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <button
            onClick={() => chatFileInputRef.current?.click()}
            disabled={isUploading}
            style={{ 
              background: '#000', border: '1px solid #D4AF37', borderRadius: '50%', 
              width: '42px', height: '42px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0
            }}
          >
            {isUploading ? <span style={{ color: '#D4AF37', fontSize: '0.6rem' }}>...</span> : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </button>
          <input type="file" ref={chatFileInputRef} hidden accept="image/*" onChange={(e) => handleChatImageUpload(e, messages[0]?.user_id)} />

          <textarea 
            ref={textareaRef}
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            placeholder="MESSAGES..." 
            rows={1} 
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} 
            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '22px', padding: '10px 18px', resize: 'none', fontSize: '16px', outline: 'none', lineHeight: '1.4', maxHeight: '120px' }} 
          />
          
          <button 
            onClick={() => handleSend(inputText, false, messages[0]?.user_id)} 
            style={{ background: '#000', color: '#D4AF37', padding: '10px 20px', borderRadius: '22px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '0.85rem', cursor: 'pointer', height: '42px' }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
