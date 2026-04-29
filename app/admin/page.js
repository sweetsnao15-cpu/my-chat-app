"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const Avatar = ({ profile, size = '32px', isSelected = true }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "V";
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity: isSelected ? 1 : 0.6, flexShrink: 0 }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '1px solid #D4AF37' : '1px solid #444' }} alt="" />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem', border: '1px solid #D4AF37' }}>{initial}</div>
      )}
    </div>
  );
};

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('GLOBAL');
  const [guests, setGuests] = useState([]);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
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

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setGuests(data);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      setMessages(data);
      if (prevMsgCountRef.current === 0) {
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    }
  }, [scrollToBottom]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();
    const channel = supabase.channel('admin_room').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  useEffect(() => { 
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('auto');
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [viewMode, selectedGuestId, scrollToBottom]);

  const sortedGuests = useMemo(() => {
    const guestList = guests.filter(g => g.id !== ADMIN_ID);
    return guestList.sort((a, b) => {
      const lastMsgA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
      const lastMsgB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
      return (lastMsgB ? new Date(lastMsgB.created_at).getTime() : 0) - (lastMsgA ? new Date(lastMsgA.created_at).getTime() : 0);
    });
  }, [guests, messages]);

  // 送信機能：ゲスト側と同様のロジックで全ゲストへ送信
  const handleSend = async (content, isImage = false) => {
    const text = content?.trim();
    if (!text || !user || isUploading) return;
    
    // 全ゲストを取得（管理者以外）
    const targetGuests = guests.filter(g => g.id !== ADMIN_ID);
    if (targetGuests.length === 0) return;

    // 入力欄を先にクリア
    if (!isImage) setInputText('');

    const inserts = targetGuests.map(g => ({
      content: text,
      user_id: ADMIN_ID,
      receiver_id: g.id,
      is_image: isImage,
      is_read: false
    }));

    const { error } = await supabase.from('messages').insert(inserts);
    if (!error) {
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

  const handleTouchStart = (e, msg) => {
    if (msg.user_id === ADMIN_ID) {
      longPressTimer.current = setTimeout(() => openMenu(e, msg), 600);
    }
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  const renderMessages = () => {
    const filtered = (viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : (() => {
          const displayed = []; const seenAdminMsgs = new Set();
          messages.forEach(m => {
            if (m.user_id === ADMIN_ID) {
              const key = `${m.content}_${m.created_at.substring(0,16)}`; 
              if (!seenAdminMsgs.has(key)) { displayed.push(m); seenAdminMsgs.add(key); }
            } else { displayed.push(m); }
          });
          return displayed;
        })()
    );

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', paddingBottom: '20px' }}>
        {filtered.map((m, index) => {
          const isMe = m.user_id === ADMIN_ID;
          const senderProfile = guests.find(g => g.id === m.user_id);
          const date = new Date(m.created_at);
          // 年月日のサイズを小さく
          const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
          const prevMsg = index > 0 ? filtered[index - 1] : null;
          const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

          return (
            <div key={m.id}>
              {isNewDay && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                  <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic', opacity: 0.6 }}>{dateStr}</div>
                </div>
              )}
              <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  
                  {/* ヘッダー部分：アイコンと名前を横並びにし、上に配置 */}
                  {!isMe && viewMode === 'GLOBAL' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', marginLeft: '2px' }}>
                      <Avatar profile={senderProfile} size="24px" />
                      <span style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 'bold' }}>
                        {senderProfile?.username || 'Guest'}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '85%' }}>
                    <div 
                      onContextMenu={isMe ? (e) => openMenu(e, m) : null} 
                      onTouchStart={isMe ? (e) => handleTouchStart(e, m) : null} 
                      onTouchEnd={handleTouchEnd}
                      style={{ 
                        padding: m.is_image ? '5px' : '10px 14px', 
                        background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                        backdropFilter: 'blur(4px)', 
                        borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                        border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                        fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' 
                      }}
                    >
                      {m.is_image ? <img src={m.content} onLoad={() => scrollToBottom('auto')} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                    </div>
                    <div style={{ fontSize: '0.5rem', color: '#D4AF37', whiteSpace: 'nowrap', paddingBottom: '2px', opacity: 0.8 }}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => executeDelete(contextMenu.msg.id)}>送信取消</button>
        </div>
      )}
      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '2px' }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '6px 20px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'serif', cursor: 'pointer' }}>{mode}</button>
          ))}
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '85px', borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px', padding: '20px 0', flexShrink: 0 }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar profile={g} size="50px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.6rem', color: selectedGuestId === g.id ? '#D4AF37' : '#888', marginTop: '8px', textAlign: 'center', width: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.username || 'Guest'}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>{renderMessages()}</div>
          {viewMode === 'GLOBAL' && (
            <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.5rem', padding: '5px', cursor: 'pointer', minWidth: '40px' }}>{isUploading ? '...' : '⊕'}</button>
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="全員へ送信..." rows={1} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '18px', padding: '8px 15px', resize: 'none', fontSize: '16px', outline: 'none', fontFamily: 'serif', lineHeight: '1.4', maxHeight: '120px' }} />
                <button type="button" onClick={() => handleSend(inputText)} style={{ background: '#000', color: '#D4AF37', padding: '10px 18px', borderRadius: '18px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '13px', fontFamily: 'serif', cursor: 'pointer', minWidth: '60px' }}>SEND</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
