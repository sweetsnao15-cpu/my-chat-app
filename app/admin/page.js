"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const Avatar = ({ profile, size = '32px' }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "V";
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} alt="" />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem', border: '1px solid #D4AF37' }}>{initial}</div>
      )}
    </div>
  );
};

export default function AdminPage() {
  const [guests, setGuests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localDeletedIds, setLocalDeletedIds] = useState([]); // ローカル削除用

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setGuests(data);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();
    
    const channel = supabase.channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  useEffect(() => { 
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('auto');
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // 全員へ一斉送信
  const handleSendAll = async (content, isImage = false) => {
    const text = typeof content === 'string' ? content.trim() : "";
    if (!text || !user || isUploading) return;

    const targetIds = guests.filter(g => g.id !== ADMIN_ID).map(g => g.id);
    if (targetIds.length === 0) return;

    const inserts = targetIds.map(id => ({
      content: text,
      user_id: ADMIN_ID,
      receiver_id: id,
      is_image: isImage,
      is_read: false
    }));

    const { error } = await supabase.from('messages').insert(inserts);
    
    if (!error) {
      if (!isImage) {
        setInputText('');
        const textarea = document.querySelector('textarea');
        if (textarea) textarea.style.height = 'auto';
      }
      fetchMessages();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const filePath = `admin/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSendAll(publicUrl, true);
    }
    setIsUploading(false);
  };

  // 送信取消（DBから削除）
  const executeUnsend = async (msg) => {
    const { error } = await supabase.from('messages')
      .delete()
      .eq('user_id', ADMIN_ID)
      .eq('content', msg.content)
      .eq('created_at', msg.created_at);
    if (!error) {
      setContextMenu(null);
      fetchMessages();
    }
  };

  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  // 管理者画面：同じ内容・同時刻の送信は1つにまとめて表示（重複防止）
  const displayMessages = (() => {
    const displayed = [];
    const seenAdminMsgs = new Set();
    messages.filter(m => !localDeletedIds.includes(m.id)).forEach(m => {
      if (m.user_id === ADMIN_ID) {
        const key = `${m.content}_${m.created_at.substring(0,16)}`; 
        if (!seenAdminMsgs.has(key)) {
          displayed.push(m);
          seenAdminMsgs.add(key);
        }
      } else {
        displayed.push(m);
      }
    });
    return displayed;
  })();

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none' }}>
      
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 120, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button type="button" style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button type="button" style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { setLocalDeletedIds([...localDeletedIds, contextMenu.msg.id]); setContextMenu(null); }}>削除</button>
          {contextMenu.msg.user_id === ADMIN_ID && (
            <button type="button" style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => executeUnsend(contextMenu.msg)}>送信取消</button>
          )}
        </div>
      )}

      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '2px' }}>for VAU - HOST</h1>
        <div style={{ fontSize: '0.7rem', color: '#D4AF37', marginTop: '5px', opacity: 0.8 }}>GLOBAL MODE</div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', paddingBottom: '20px' }}>
          {displayMessages.map((m, index) => {
            const isMe = m.user_id === ADMIN_ID;
            const senderProfile = guests.find(g => g.id === m.user_id);
            const date = new Date(m.created_at);
            const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
            const prevMsg = index > 0 ? displayMessages[index - 1] : null;
            const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

            return (
              <div key={m.id}>
                {isNewDay && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic', opacity: 0.6 }}>{dateStr}</div>
                  </div>
                )}
                <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                    {!isMe && <div style={{ marginTop: '2px' }}><Avatar profile={senderProfile} size="28px" /></div>}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      {!isMe && <span style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 'bold', marginBottom: '4px' }}>{senderProfile?.username || 'Guest'}</span>}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        <div 
                          onContextMenu={(e) => openMenu(e, m)} 
                          onTouchStart={(e) => { longPressTimer.current = setTimeout(() => openMenu(e, m), 600); }} 
                          onTouchEnd={() => clearTimeout(longPressTimer.current)}
                          style={{ padding: m.is_image ? '5px' : '10px 14px', background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', backdropFilter: 'blur(4px)', borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.is_image ? <img src={m.content} onLoad={() => scrollToBottom('auto')} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                        </div>
                        <div style={{ fontSize: '0.5rem', color: '#D4AF37', whiteSpace: 'nowrap', paddingBottom: '2px', opacity: 0.8 }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.5rem', padding: '5px', cursor: 'pointer', minWidth: '40px' }}>{isUploading ? '...' : '⊕'}</button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
          <textarea 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            placeholder="ゲスト全員へ一斉送信..." 
            rows={1} 
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} 
            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '18px', padding: '8px 15px', resize: 'none', fontSize: '16px', outline: 'none', lineHeight: '1.4', maxHeight: '120px' }} 
          />
          <button 
            type="button" 
            onClick={() => handleSendAll(inputText)} 
            style={{ background: '#000', color: '#D4AF37', padding: '10px 18px', borderRadius: '18px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '13px', cursor: 'pointer', minWidth: '60px' }}>
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
