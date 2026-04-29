"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// アバターコンポーネント
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
  const [isSending, setIsSending] = useState(false); // 送信中フラグ追加
  
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
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

  const sortedGuests = useMemo(() => {
    const guestList = guests.filter(g => g.id !== ADMIN_ID);
    return guestList.sort((a, b) => {
      const lastMsgA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
      const lastMsgB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
      return (lastMsgB ? new Date(lastMsgB.created_at).getTime() : 0) - (lastMsgA ? new Date(lastMsgA.created_at).getTime() : 0);
    });
  }, [guests, messages]);

  // ★送信ロジックの改善（一括処理）
  const handleSendAll = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const text = inputText.trim();
    if (!text || isSending || !user) return;

    const targetIds = guests.filter(g => g.id !== ADMIN_ID).map(g => g.id);
    if (targetIds.length === 0) return;

    setIsSending(true); // 二重送信防止

    const inserts = targetIds.map(id => ({
      content: text,
      user_id: ADMIN_ID,
      receiver_id: id,
      is_image: false,
      is_read: false
    }));

    // 入力欄を先にクリア（サクサク感を出す）
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }

    try {
      const { error } = await supabase.from('messages').insert(inserts);
      if (error) throw error;
      await fetchMessages();
    } catch (err) {
      console.error("Send Error:", err);
      alert("送信に失敗しました。電波の良い場所で再度お試しください。");
      setInputText(text); // 失敗したら文字を戻す
    } finally {
      setIsSending(false);
    }
  };

  const executeDelete = async (msg) => {
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
    if (viewMode === 'DIRECT') return;
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const renderMessages = () => {
    const filtered = (viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : (() => {
          const displayed = [];
          const seenAdminMsgs = new Set();
          messages.forEach(m => {
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
        })()
    );

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', paddingBottom: '20px' }}>
        {filtered.map((m, index) => {
          const isMe = m.user_id === ADMIN_ID;
          const senderProfile = guests.find(g => g.id === m.user_id);
          const date = new Date(m.created_at);
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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                  {!isMe && <div style={{ marginTop: '2px' }}><Avatar profile={senderProfile} size="28px" /></div>}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    {!isMe && viewMode === 'GLOBAL' && (
                      <span style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 'bold', marginBottom: '4px' }}>{senderProfile?.username || 'Guest'}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div 
                        onContextMenu={isMe ? (e) => openMenu(e, m) : null} 
                        onTouchStart={isMe ? (e) => { longPressTimer.current = setTimeout(() => openMenu(e, m), 600); } : null} 
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
    );
  };

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          <button type="button" style={{ background: 'none', border: 'none', color: '#fff', padding: '15px 25px', borderBottom: '1px solid #333' }} onClick={() => { if(contextMenu.msg.content) navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button type="button" style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '15px 25px' }} onClick={() => executeDelete(contextMenu.msg)}>送信取消</button>
        </div>
      )}

      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '6px 15px', borderRadius: '20px', fontSize: '0.7rem' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '80px', borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px 0' }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar profile={g} size="45px" isSelected={selectedGuestId === g.id} />
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>{renderMessages()}</div>
          
          {/* ★スマホ対応入力エリア */}
          {viewMode === 'GLOBAL' && (
            <div style={{ 
              padding: '12px', 
              background: '#800000', 
              borderTop: '1px solid #D4AF37',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
            }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px' }}>
                <textarea 
                  ref={textareaRef}
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  placeholder="全員へ送信..." 
                  rows={1} 
                  style={{ 
                    flex: 1, background: '#000', color: '#fff', border: '1px solid #D4AF37', 
                    borderRadius: '20px', padding: '10px 15px', fontSize: '16px', resize: 'none', outline: 'none'
                  }} 
                />
                <button 
                  type="button" 
                  disabled={isSending || !inputText.trim()}
                  onPointerDown={(e) => {
                    // pointerDownなら瞬時に反応する
                    if (inputText.trim() && !isSending) handleSendAll(e);
                  }}
                  style={{ 
                    background: isSending ? '#333' : '#000', 
                    color: isSending ? '#666' : '#D4AF37', 
                    padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', 
                    border: '1px solid #D4AF37', minWidth: '70px'
                  }}
                >
                  {isSending ? '...' : 'SEND'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
