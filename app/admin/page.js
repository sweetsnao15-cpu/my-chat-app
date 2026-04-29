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
  
  const scrollRef = useRef(null);
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
                  <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic' }}>
                    {dateStr}
                  </div>
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
                        style={{ 
                          padding: m.is_image ? '5px' : '10px 14px', 
                          background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                          borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                          border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                          fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          WebkitUserSelect: 'none', userSelect: 'none'
                        }}>
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
    <div style={{ 
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif',
      WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none'
    }}>
      {/* ゲスト側と同じ高さのヘッダー */}
      <header style={{ 
        padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', 
        textAlign: 'center', flexShrink: 0, zIndex: 10
      }}>
        <h1 style={{ 
          fontSize: '1.2rem', fontStyle: 'italic', fontWeight: 'bold', 
          margin: 0, letterSpacing: '2px', color: '#fff' 
        }}>
          for VAU ｰHOSTｰ
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

      {/* ゲスト側と同じ高さのフッター */}
      <footer style={{ 
        padding: '12px 15px', background: '#800000', borderTop: '1px solid #D4AF37', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        flexShrink: 0, zIndex: 10
      }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button 
            key={mode} 
            onClick={() => setViewMode(mode)} 
            style={{ 
              background: 'transparent', 
              color: viewMode === mode ? '#D4AF37' : 'rgba(255,255,255,0.6)', 
              border: 'none', 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              letterSpacing: '2px',
              padding: '5px 10px',
              borderBottom: viewMode === mode ? '1px solid #D4AF37' : '1px solid transparent',
              transition: 'all 0.2s ease'
            }}
          >
            {mode}
          </button>
        ))}
      </footer>
    </div>
  );
}
