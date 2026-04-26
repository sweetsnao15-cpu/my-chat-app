"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const GuestAvatarWithBadge = ({ profile, unreadCount, size = '50px', isSelected }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "G";
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity: isSelected ? 1 : 0.5, transition: '0.2s' }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} alt="" />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #D4AF37' }}>{initial}</div>
      )}
      {/* 0より大きい場合のみ、そのゲストの未読数だけを表示 */}
      {unreadCount > 0 && (
        <div style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ff4d4d', color: '#fff', fontSize: '10px', fontWeight: 'bold', minWidth: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #000', padding: '0 4px', zIndex: 10 }}>
          {unreadCount}
        </div>
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

  const fetchGuests = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles.filter(p => p.id !== ADMIN_ID));
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    if (data) setMessages(data);
  }, []);

  const markAsRead = useCallback(async (guestId) => {
    if (!guestId) return;
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('user_id', guestId)
      .eq('receiver_id', ADMIN_ID)
      .eq('is_read', false);
    
    setMessages(prev => prev.map(m => 
      (m.user_id === guestId && m.receiver_id === ADMIN_ID) ? { ...m, is_read: true } : m
    ));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();
    const channel = supabase.channel('admin_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  useEffect(() => {
    if (viewMode === 'DIRECT' && selectedGuestId) {
      markAsRead(selectedGuestId);
    }
  }, [selectedGuestId, viewMode, messages, markAsRead]);

  const sortedGuests = useMemo(() => {
    return [...guests].sort((a, b) => {
      const lastA = messages.find(m => m.user_id === a.id || m.receiver_id === a.id);
      const lastB = messages.find(m => m.user_id === b.id || m.receiver_id === b.id);
      return (lastB ? new Date(lastB.created_at).getTime() : 0) - (lastA ? new Date(lastA.created_at).getTime() : 0);
    });
  }, [guests, messages]);

  const handleSendGlobal = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');
    const bulk = guests.map(g => ({
      content: text, user_id: ADMIN_ID, receiver_id: g.id, is_image: false, is_read: false
    }));
    await supabase.from('messages').insert(bulk);
  };

  const openMenu = (e, m) => {
    // GLOBALモードの時だけメニューを許可
    if (viewMode !== 'GLOBAL') return;
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, message: m });
  };

  const deleteMessage = async () => {
    if (!contextMenu) return;
    await supabase.from('messages').delete().eq('id', contextMenu.message.id);
    setContextMenu(null);
  };

  const getDisplayMessages = () => {
    if (viewMode === 'DIRECT') {
      return [...messages.filter(m => 
        (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || 
        (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId)
      )].reverse();
    }
    const displayed = [];
    const seenAdminMsgs = new Set();
    [...messages].reverse().forEach(m => {
      if (m.user_id === ADMIN_ID) {
        const key = `${m.content}_${Math.floor(new Date(m.created_at).getTime() / 1000)}`;
        if (!seenAdminMsgs.has(key)) { displayed.push(m); seenAdminMsgs.add(key); }
      } else {
        displayed.push(m);
      }
    });
    return displayed;
  };

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <style>{`
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #800000; border-radius: 10px; }
        * { -webkit-tap-highlight-color: transparent; }
        img { -webkit-touch-callout: none; pointer-events: none; }
      `}</style>

      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 50, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '12px', zIndex: 1000, overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }} style={{ padding: '12px 20px', fontSize: '0.9rem', borderBottom: contextMenu.message.user_id === ADMIN_ID ? '1px solid #333' : 'none', cursor: 'pointer' }}>コピー</div>
          {contextMenu.message.user_id === ADMIN_ID && (
            <div onClick={deleteMessage} style={{ padding: '12px 20px', fontSize: '0.9rem', color: '#ff4d4d', cursor: 'pointer' }}>送信取消</div>
          )}
        </div>
      )}

      <header style={{ padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} onClick={() => { setViewMode(mode); if(mode==='GLOBAL') setSelectedGuestId(null); }} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '5px 15px', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '90px', borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '15px 0', flexShrink: 0 }}>
            {sortedGuests.map(g => {
              // 【重要】そのゲスト(g.id)からADMIN宛の未読メッセージだけをカウント
              const unread = messages.filter(m => m.user_id === g.id && m.receiver_id === ADMIN_ID && !m.is_read).length;
              return (
                <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', textAlign: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GuestAvatarWithBadge profile={g} unreadCount={unread} isSelected={selectedGuestId === g.id} />
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#D4AF37', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 5px' }}>{g.username || 'Guest'}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column-reverse' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {getDisplayMessages().map(m => {
                const isMe = m.user_id === ADMIN_ID;
                const guest = guests.find(g => g.id === (isMe ? m.receiver_id : m.user_id));
                return (
                  <div key={m.id} onContextMenu={(e) => openMenu(e, m)} onTouchStart={(e) => {
                    const timer = setTimeout(() => openMenu(e, m), 600);
                    e.target.ontouchend = () => clearTimeout(timer);
                  }} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && viewMode === 'GLOBAL' && <div style={{ fontSize: '0.7rem', color: '#D4AF37', marginBottom: '4px' }}>{guest?.username}</div>}
                      <div style={{ 
                        padding: m.is_image ? '5px' : '10px 15px', background: isMe ? '#500000' : '#1a1a1a', 
                        borderRadius: isMe ? '15px 15px 0 15px' : '15px 15px 15px 0', border: isMe ? 'none' : '1px solid #D4AF37', maxWidth: '85%',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left', fontSize: '0.95rem'
                      }}>
                        {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '4px' }}>
                        {isMe && m.is_read && viewMode === 'DIRECT' && <span style={{ color: '#D4AF37', marginRight: '5px' }}>既読</span>}
                        {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '15px', background: '#800000', display: 'flex', gap: '10px', borderTop: '2px solid #D4AF37', flexShrink: 0 }}>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="全ゲストへ一斉送信..." style={{ flex: 1, background: '#800000', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', padding: '10px 15px', outline: 'none', resize: 'none', height: '42px', fontSize: '16px' }} />
            <button onClick={handleSendGlobal} style={{ background: '#000', color: '#D4AF37', padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic', border: 'none', cursor: 'pointer' }}>SEND ALL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
