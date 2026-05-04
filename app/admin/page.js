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

  const renderMessages = () => {
    const filtered = (viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : messages
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
                  <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic' }}>{dateStr}</div>
                </div>
              )}
              <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                  {!isMe && viewMode !== 'DIRECT' && <div style={{ marginTop: '2px' }}><Avatar profile={senderProfile} size="36px" /></div>}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', flex: 1, maxWidth: '80%' }}>
                    {!isMe && viewMode === 'GLOBAL' && (
                      <span style={{ fontSize: '0.9rem', color: '#D4AF37', fontWeight: 'bold', marginBottom: '6px', marginLeft: '2px' }}>{senderProfile?.username || 'Guest'}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%', position: 'relative' }}>
                      <div 
                        onContextMenu={(e) => {
                          if (!m.is_image) { e.preventDefault(); e.stopPropagation(); setActiveMenuId(m.id); }
                        }}
                        style={{ 
                          padding: m.is_image ? '5px' : '10px 14px', 
                          background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                          borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                          border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                          fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          cursor: 'pointer', position: 'relative', minWidth: '60px',
                          WebkitTapHighlightColor: 'transparent'
                        }}>
                        {m.is_image ? <img src={m.content} onLoad={scrollToBottomInstant} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                        {activeMenuId === m.id && (
                          <div style={{ position: 'absolute', top: '100%', [isMe ? 'right' : 'left']: 0, zIndex: 100, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '8px', marginTop: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', width: 'max-content', minWidth: '120px' }}>
                            <button style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#fff', borderBottom: '1px solid #333', textAlign: 'left', fontSize: '0.85rem' }}>編集する</button>
                            <button style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#ff4444', textAlign: 'left', fontSize: '0.85rem' }}>削除する</button>
                          </div>
                        )}
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
    <div style={{ 
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif',
      WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none'
    }}>
      <header style={{ 
        paddingTop: 'env(safe-area-inset-top)', 
        background: '#800020', 
        borderBottom: '1px solid #D4AF37', 
        textAlign: 'center', 
        flexShrink: 0, 
        zIndex: 10, 
        height: '90px', // 全体の高さは90pxを維持
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}>
        {/* タイトル上の余白を35pxに設定 */}
        <div style={{ height: '35px', flexShrink: 0 }} />
        
        <h1 style={{ 
          fontSize: '1.8rem', 
          fontStyle: 'italic', 
          fontWeight: 'bold', 
          margin: 0, 
          letterSpacing: '3px', 
          color: '#fff',
          paddingLeft: '15px',
          lineHeight: '1.2'
        }}>
          for VAU <span style={{ fontSize: '1.2rem', verticalAlign: 'middle', color: '#D4AF37' }}>ｰHOSTｰ</span>
        </h1>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '80px', borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px 0', flexShrink: 0 }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar profile={g} size="45px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.5rem', color: selectedGuestId === g.id ? '#D4AF37' : '#555', marginTop: '5px' }}>{g.username?.substring(0, 5)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, background: '#050505', overflowY: 'auto', padding: '15px' }} ref={scrollRef}>
          {renderMessages()}
        </div>
      </div>

      <footer style={{ 
        background: '#800020', borderTop: '1px solid #D4AF37', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', 
        paddingTop: '12px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', 
        flexShrink: 0, zIndex: 10 
      }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button 
            key={mode} 
            onClick={() => setViewMode(mode)} 
            style={{ 
              background: 'transparent', color: viewMode === mode ? '#D4AF37' : 'rgba(255,255,255,0.6)', 
              border: 'none', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '2px', 
              padding: '5px 10px', borderBottom: viewMode === mode ? '1px solid #D4AF37' : '1px solid transparent', 
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent'
            }}
          >
            {mode}
          </button>
        ))}
      </footer>
    </div>
  );
}
