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
  const [isUploading, setIsUploading] = useState(false);
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
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

  // ★一斉送信処理（スマホ対応）
  const handleSendAll = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const text = inputText.trim();
    if (!text || isUploading || !user) return;

    // ADMIN以外の全ゲストIDを取得
    const targetIds = guests.filter(g => g.id !== ADMIN_ID).map(g => g.id);
    if (targetIds.length === 0) {
      alert("送信対象がいません");
      return;
    }

    // 送信処理中のUIロック
    setIsUploading(true);

    const inserts = targetIds.map(id => ({
      content: text,
      user_id: ADMIN_ID,
      receiver_id: id,
      is_image: false,
      is_read: false
    }));

    // 先に入力をクリアしてキーボードを閉じる（UX向上）
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur(); 
    }

    const { error } = await supabase.from('messages').insert(inserts);
    if (error) {
      console.error(error);
      alert("送信に失敗しました");
    } else {
      fetchMessages();
    }
    setIsUploading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user || viewMode === 'DIRECT') return;
    setIsUploading(true);
    const filePath = `admin/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      const targetIds = guests.filter(g => g.id !== ADMIN_ID).map(g => g.id);
      const inserts = targetIds.map(id => ({
        content: publicUrl,
        user_id: ADMIN_ID,
        receiver_id: id,
        is_image: true,
        is_read: false
      }));
      await supabase.from('messages').insert(inserts);
      fetchMessages();
    }
    setIsUploading(false);
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

  // ビルドエラー回避のため、returnの前に定義
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
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none' }}>
      {/* ...コンテキストメニュー省略... */}
      {contextMenu && viewMode === 'GLOBAL' && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button type="button" style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { if (contextMenu.msg.content) navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button type="button" style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => executeDelete(contextMenu.msg)}>送信取消</button>
        </div>
      )}

      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '2px' }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '6px 20px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* DIRECTモード時のゲスト一覧 */}
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
          
          {/* ★入力欄（スマホ最適化） */}
          {viewMode === 'GLOBAL' && (
            <div style={{ 
              padding: '10px 15px', 
              background: '#800000', 
              borderTop: '1px solid #D4AF37', 
              flexShrink: 0, 
              paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' 
            }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.8rem', padding: '0 5px', cursor: 'pointer' }}
                >
                  {isUploading ? '...' : '⊕'}
                </button>
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                
                <textarea 
                  ref={textareaRef}
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  placeholder="全員へ送信..." 
                  rows={1} 
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }} 
                  style={{ 
                    flex: 1, 
                    background: 'rgba(0,0,0,0.3)', 
                    color: '#fff', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: '20px', 
                    padding: '10px 15px', 
                    resize: 'none', 
                    fontSize: '16px', // iOSズーム防止
                    outline: 'none', 
                    lineHeight: '1.2'
                  }} 
                />
                
                <button 
                  type="button" 
                  onClick={handleSendAll} 
                  disabled={isUploading || !inputText.trim()}
                  style={{ 
                    background: '#000', 
                    color: (isUploading || !inputText.trim()) ? '#555' : '#D4AF37', 
                    padding: '10px 18px', 
                    borderRadius: '20px', 
                    fontWeight: 'bold', 
                    border: '1px solid',
                    borderColor: (isUploading || !inputText.trim()) ? '#333' : '#D4AF37', 
                    fontSize: '14px', 
                    minWidth: '70px',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  SEND
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
