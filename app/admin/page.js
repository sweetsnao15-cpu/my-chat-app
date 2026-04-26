"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const Avatar = ({ profile, size = '40px', isSelected = true }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "G";
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity: isSelected ? 1 : 0.6, flexShrink: 0 }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '1px solid #D4AF37' : '1px solid #444' }} alt="" />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid #D4AF37' }}>{initial}</div>
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
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const fetchGuests = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      setMessages(data);
      setTimeout(scrollToBottom, 50);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();
    const channel = supabase.channel('admin_room').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  useEffect(() => { setTimeout(scrollToBottom, 100); }, [viewMode, selectedGuestId]);

  const sortedGuests = useMemo(() => {
    const guestList = guests.filter(g => g.id !== ADMIN_ID);
    return guestList.sort((a, b) => {
      const lastMsgA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
      const lastMsgB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
      return (lastMsgB ? new Date(lastMsgB.created_at).getTime() : 0) - (lastMsgA ? new Date(lastMsgA.created_at).getTime() : 0);
    });
  }, [guests, messages]);

  const handleSendGlobal = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');
    const guestProfiles = guests.filter(g => g.id !== ADMIN_ID);
    const bulk = guestProfiles.map(g => ({ content: text, user_id: ADMIN_ID, receiver_id: g.id, is_image: false, is_read: false }));
    await supabase.from('messages').insert(bulk);
  };

  const handleContextMenu = (e, msg) => {
    if (viewMode === 'DIRECT') return; // ダイレクト時は長押し無効
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const deleteMessage = async () => {
    if (!contextMenu) return;
    await supabase.from('messages').delete().eq('id', contextMenu.msg.id);
    setContextMenu(null);
  };

  const renderMessages = () => {
    const filtered = viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : (() => {
          const displayed = [];
          const seenAdminMsgs = new Set();
          messages.forEach(m => {
            if (m.user_id === ADMIN_ID) {
              const key = `${m.content}_${Math.floor(new Date(m.created_at).getTime() / 1000)}`;
              if (!seenAdminMsgs.has(key)) { displayed.push(m); seenAdminMsgs.add(key); }
            } else { displayed.push(m); }
          });
          return displayed;
        })();

    let lastDate = "";
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', userSelect: 'none' }}>
        {filtered.map(m => {
          const currentDate = new Date(m.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
          const showDate = currentDate !== lastDate;
          lastDate = currentDate;
          const isMe = m.user_id === ADMIN_ID;
          const senderProfile = guests.find(g => g.id === m.user_id);

          return (
            <div key={m.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '30px 0 15px', fontSize: '0.7rem', color: '#D4AF37', letterSpacing: '0.1rem', fontFamily: 'serif' }}>― {currentDate} ―</div>
              )}
              <div 
                onContextMenu={(e) => handleContextMenu(e, m)}
                onTouchStart={(e) => {
                  if (viewMode === 'DIRECT') return;
                  const timer = setTimeout(() => handleContextMenu(e, m), 500);
                  e.target.ontouchend = () => clearTimeout(timer);
                }}
                style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
              >
                {!isMe && viewMode === 'GLOBAL' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', marginLeft: '5px' }}>
                    <Avatar profile={senderProfile} size="36px" />
                    <span style={{ fontSize: '0.75rem', color: '#D4AF37', fontWeight: 'bold' }}>{senderProfile?.username || 'Guest'}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <div style={{ 
                    padding: m.is_image ? '5px' : '12px 16px', 
                    background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                    backdropFilter: 'blur(4px)',
                    // とんがり位置を左右反対に調整
                    borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                    border: isMe ? '1px solid rgba(128, 0, 0, 0.5)' : '1px solid #D4AF37', 
                    maxWidth: '100%', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '200px', borderRadius: '10px', display: 'block' }} alt="" /> : m.content}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#666', marginTop: 'auto', marginBottom: '2px' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 60, left: contextMenu.x - 40, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '10px', zIndex: 9999 }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }} style={{ padding: '10px 20px', fontSize: '0.8rem', borderBottom: '1px solid #333', cursor: 'pointer' }}>コピー</div>
          {contextMenu.msg.user_id === ADMIN_ID && <div onClick={deleteMessage} style={{ padding: '10px 20px', fontSize: '0.8rem', color: '#ff4d4d', cursor: 'pointer' }}>送信取消</div>}
        </div>
      )}
      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', margin: 0, letterSpacing: '2px' }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '4px 20px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'serif', cursor: 'pointer' }}>{mode}</button>
          ))}
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '85px', borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px', padding: '20px 0', flexShrink: 0 }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar profile={g} size="50px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.55rem', color: selectedGuestId === g.id ? '#D4AF37' : '#888', marginTop: '8px', textAlign: 'center', width: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.username || 'Guest'}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 15px' }}>{renderMessages()}</div>
          {viewMode === 'GLOBAL' && (
            <div style={{ padding: '15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0 }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="全員へのメッセージを入力..." style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '15px', padding: '10px 15px', resize: 'none', minHeight: '40px', maxHeight: '100px', fontSize: '15px', outline: 'none', fontFamily: 'serif' }} />
                <button onClick={handleSendGlobal} style={{ background: '#000', color: '#D4AF37', padding: '10px 20px', borderRadius: '15px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '14px', fontFamily: 'serif', cursor: 'pointer' }}>SEND</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
