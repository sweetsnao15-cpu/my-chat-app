"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const Avatar = ({ profile, size = '32px', isSelected = true }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "V";
  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      style={{ 
        position: 'relative', width: size, height: size, 
        opacity: isSelected ? 1 : 0.6, flexShrink: 0,
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {profile?.avatar_url ? (
        <img 
          src={profile.avatar_url} 
          draggable="false" 
          style={{ 
            width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', 
            border: isSelected ? '1px solid #D4AF37' : '1px solid #444',
            pointerEvents: 'none',
            WebkitTouchCallout: 'none'
          }} 
          alt="" 
        />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid #D4AF37' }}>{initial}</div>
      )}
    </div>
  );
};

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('GLOBAL');
  const [guests, setGuests] = useState([]);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);
  
  const scrollRef = useRef(null);

  const scrollToBottomInstant = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setGuests(data);
  }, []);

  const fetchInitialMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setMessages(data.reverse());
      setTimeout(scrollToBottomInstant, 100);
    }
  }, [scrollToBottomInstant]);

  useEffect(() => {
    fetchGuests();
    fetchInitialMessages();

    const channel = supabase.channel('admin_all_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        setTimeout(scrollToBottomInstant, 50);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchInitialMessages, scrollToBottomInstant]);

  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const sortedGuests = useMemo(() => {
    const guestList = guests.filter(g => g.id !== ADMIN_ID);
    return guestList.sort((a, b) => {
      const lastMsgA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
      const lastMsgB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
      return (lastMsgB ? new Date(lastMsgB.created_at).getTime() : 0) - (lastMsgA ? new Date(lastMsgA.created_at).getTime() : 0);
    });
  }, [guests, messages]);

  const handleContextMenu = (e, message) => {
    if (!message.is_image) {
      e.preventDefault();
      e.stopPropagation();
      setActiveMenuId(message.id);
    } else {
      e.stopPropagation();
    }
  };

  const renderMessages = () => {
    const filtered = (viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : messages
    );

    return (
      <div style={{ width: '100%', paddingBottom: '20px' }}>
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
                <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                  <div style={{ color: '#D4AF37', fontSize: '0.6rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                    {dateStr}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                  {!isMe && viewMode !== 'DIRECT' && <div style={{ marginTop: '2px' }}><Avatar profile={senderProfile} size="32px" /></div>}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    {!isMe && viewMode === 'GLOBAL' && (
                      <span style={{ fontSize: '0.75rem', color: '#D4AF37', fontWeight: 'bold', marginBottom: '4px', marginLeft: '2px' }}>
                        {senderProfile?.username || 'Guest'}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div 
                        onContextMenu={(e) => handleContextMenu(e, m)}
                        style={{ 
                          padding: m.is_image ? '4px' : '10px 14px', 
                          background: isMe ? 'rgba(80, 0, 0, 0.8)' : 'rgba(30, 30, 30, 0.9)', 
                          borderRadius: isMe ? '16px 2px 16px 16px' : '2px 16px 16px 16px', 
                          border: isMe ? '1px solid rgba(150, 0, 0, 0.5)' : '1px solid #D4AF37', 
                          fontSize: '0.85rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          position: 'relative'
                        }}>
                        {m.is_image ? (
                          <img src={m.content} onLoad={scrollToBottomInstant} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} />
                        ) : m.content}

                        {activeMenuId === m.id && (
                          <div style={{
                            position: 'absolute', top: '100%', [isMe ? 'right' : 'left']: 0, zIndex: 100,
                            background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '8px',
                            marginTop: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', width: 'max-content'
                          }}>
                            <button style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#fff', borderBottom: '1px solid #333', textAlign: 'left', fontSize: '0.8rem' }}>編集</button>
                            <button style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#ff4444', textAlign: 'left', fontSize: '0.8rem' }}>削除</button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.5rem', color: '#D4AF37', opacity: 0.7, marginBottom: '2px' }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
    <div style={{ 
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif'
    }}>
      <style jsx global>{`
        * { -webkit-tap-highlight-color: transparent !important; }
        ::-webkit-scrollbar { width: 0px; background: transparent; }
      `}</style>

      {/* Header: スマホ用に高さを少し抑える */}
      <header style={{ padding: 'env(safe-area-inset-top) 15px 10px', background: '#800020', borderBottom: '1px solid #D4AF37', textAlign: 'center', zIndex: 10 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', margin: '10px 0', letterSpacing: '2px', color: '#fff' }}>
          for VAU <span style={{ fontSize: '0.9rem', color: '#D4AF37' }}>-HOST-</span>
        </h1>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Guest List: スマホ縦画面だと幅を狭く（60px） */}
        {viewMode === 'DIRECT' && (
          <div style={{ width: '65px', borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px 0', flexShrink: 0, background: '#050505' }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar profile={g} size="40px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.5rem', color: selectedGuestId === g.id ? '#D4AF37' : '#555', marginTop: '4px', textAlign: 'center', width: '90%', overflow: 'hidden' }}>{g.username?.substring(0, 4)}</div>
              </div>
            ))}
          </div>
        )}
        
        {/* Main Content */}
        <div style={{ flex: 1, background: '#050505', overflowY: 'auto', padding: '10px' }} ref={scrollRef}>
          {renderMessages()}
        </div>
      </div>

      {/* Footer: セーフエリア対応 */}
      <footer style={{ 
        padding: `10px 15px calc(10px + env(safe-area-inset-bottom))`, 
        background: '#800020', borderTop: '1px solid #D4AF37', 
        display: 'flex', justifyContent: 'center', gap: '60px', zIndex: 10 
      }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button 
            key={mode} 
            onClick={() => setViewMode(mode)} 
            style={{ 
              background: 'transparent', color: viewMode === mode ? '#D4AF37' : 'rgba(255,255,255,0.5)', 
              border: 'none', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '2px', 
              borderBottom: viewMode === mode ? '2px solid #D4AF37' : '2px solid transparent',
              padding: '5px 0'
            }}
          >
            {mode}
          </button>
        ))}
      </footer>
    </div>
  );
}
