"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const Avatar = ({ profile, size = '32px', isSelected = true }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "V";
  return (
    <div style={{ 
      position: 'relative', width: size, height: size, 
      opacity: isSelected ? 1 : 0.6, flexShrink: 0,
      WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
      WebkitTapHighlightColor: 'transparent' // 青いハイライト防止
    }}>
      {profile?.avatar_url ? (
        <img 
          src={profile.avatar_url} 
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '1px solid #D4AF37' : '1px solid #444', pointerEvents: 'none' }} 
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
  const [longPressedGuestId, setLongPressedGuestId] = useState(null);
  const [blockedIds, setBlockedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef(null);
  const pressTimerRef = useRef(null);

  const scrollToBottomInstant = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  const fetchInitialData = useCallback(async () => {
    const { data: blockData } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', ADMIN_ID);
    const currentBlocked = blockData?.map(b => b.blocked_id) || [];
    setBlockedIds(currentBlocked);

    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles);

    let query = supabase.from('messages').select('*');
    if (currentBlocked.length > 0) {
      query = query.not('user_id', 'in', `(${currentBlocked.join(',')})`).not('receiver_id', 'in', `(${currentBlocked.join(',')})`);
    }
    const { data: msgs } = await query.order('created_at', { ascending: true });
    
    if (msgs) setMessages(msgs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel('chat_realtime_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, () => {
        fetchInitialData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchInitialData]);

  useEffect(() => {
    if (!isLoading) scrollToBottomInstant();
  }, [messages, isLoading, viewMode, selectedGuestId, scrollToBottomInstant]);

  const handleBlockUser = async (targetId) => {
    if (!confirm("このユーザーをブロックしますか？")) return;
    const { error } = await supabase.from('blocks').insert([{ blocker_id: ADMIN_ID, blocked_id: targetId }]);
    if (!error) { setLongPressedGuestId(null); fetchInitialData(); }
  };

  const startPress = (guestId) => {
    pressTimerRef.current = setTimeout(() => {
      setLongPressedGuestId(guestId);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
  };
  const cancelPress = () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); };

  const filteredGuests = useMemo(() => {
    return guests.filter(g => g.id !== ADMIN_ID && !blockedIds.includes(g.id))
      .sort((a, b) => {
        const lastA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
        const lastB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
        return (lastB ? new Date(lastB.created_at).getTime() : 0) - (lastA ? new Date(lastA.created_at).getTime() : 0);
      });
  }, [guests, messages, blockedIds]);

  const renderMessages = () => {
    if (isLoading) return <div style={{ flex: 1, background: '#050505' }} />;
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
          const isNewDay = index === 0 || new Date(filtered[index - 1].created_at).toDateString() !== date.toDateString();

          return (
            <div key={m.id} style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
              {isNewDay && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                  <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontFamily: 'serif' }}>-{date.toLocaleDateString()}-</div>
                </div>
              )}
              <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                  {!isMe && viewMode !== 'DIRECT' && <Avatar profile={senderProfile} size="38px" />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', flex: 1 }}>
                    {!isMe && viewMode === 'GLOBAL' && (
                      <span style={{ fontSize: '0.95rem', color: '#D4AF37', marginBottom: '6px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {senderProfile?.username || 'Guest'}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div style={{ 
                        padding: m.is_image ? '5px' : '10px 14px', background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                        borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                        fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'serif'
                      }}>
                        {m.is_image ? (
                          <img 
                            src={m.content} 
                            style={{ maxWidth: '100%', borderRadius: '10px' }} 
                            alt="Message"
                          />
                        ) : m.content}
                      </div>
                      <div style={{ fontSize: '0.5rem', color: '#D4AF37', fontFamily: 'serif' }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
    <div 
      onClick={() => setLongPressedGuestId(null)} 
      onContextMenu={(e) => e.preventDefault()}
      style={{ 
        width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
        background: '#000', color: '#fff', overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent', // 青い枠を防止
        WebkitUserSelect: 'none', userSelect: 'none' // テキスト選択を防止
      }}
    >
      <header style={{ 
        padding: '20px 20px 20px 30%', // 左の余白をさらに右へ（22% -> 30%）
        background: '#800020', borderBottom: '1px solid #D4AF37', textAlign: 'left', zIndex: 100
      }}>
        <h1 style={{ 
          margin: 0, marginLeft: '10px', // さらに微調整用のマージン
          fontFamily: 'serif', fontWeight: 'normal', letterSpacing: '2px', display: 'flex', alignItems: 'flex-end' 
        }}>
          <span style={{ fontSize: '1.8rem', fontStyle: 'italic', color: '#fff', marginBottom: '-3px' }}>for VAU</span>
          <span style={{ fontSize: '1.2rem', color: '#D4AF37', marginLeft: '12px' }}>-HOST-</span>
        </h1>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ 
            width: '85px', borderRight: '1px solid #222', overflowY: 'auto', overflowX: 'visible',
            display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px 0', zIndex: 20
          }}>
            {filteredGuests.map(g => (
              <div 
                key={g.id} 
                onMouseDown={() => startPress(g.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                onTouchStart={() => startPress(g.id)} onTouchEnd={cancelPress}
                onClick={(e) => { e.stopPropagation(); setSelectedGuestId(g.id); }}
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', WebkitTapHighlightColor: 'transparent' }}
              >
                <Avatar profile={g} size="45px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.6rem', color: selectedGuestId === g.id ? '#D4AF37' : '#555', marginTop: '5px', fontFamily: 'serif', textAlign: 'center', width: '100%', padding: '0 4px' }}>
                  {g.username?.substring(0, 6)}
                </div>
                
                {longPressedGuestId === g.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleBlockUser(g.id); }} 
                    style={{ 
                      position: 'absolute', left: '65px', top: '50%', transform: 'translateY(-50%)',
                      zIndex: 99999, background: '#800020', color: '#fff', border: '1px solid #D4AF37', 
                      borderRadius: '8px', padding: '10px 15px', fontSize: '0.8rem', fontWeight: 'bold', 
                      whiteSpace: 'nowrap', boxShadow: '0 4px 15px rgba(0,0,0,0.8)', fontFamily: 'serif',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    ブロック
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div 
          style={{ flex: 1, background: '#050505', overflowY: 'auto', padding: '15px', zIndex: 1 }} 
          ref={scrollRef}
        >
          {renderMessages()}
        </div>
      </div>

      <footer style={{ 
        padding: '15px', background: '#800020', borderTop: '1px solid #D4AF37', display: 'flex', justifyContent: 'center', gap: '40px', zIndex: 100
      }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button 
            key={mode} 
            onClick={() => setViewMode(mode)} 
            style={{ 
              background: 'transparent', color: viewMode === mode ? '#D4AF37' : '#fff', 
              border: 'none', fontWeight: 'bold', fontFamily: 'serif', fontSize: '1.1rem', letterSpacing: '2px',
              borderBottom: viewMode === mode ? '2px solid #D4AF37' : 'none', paddingBottom: '5px',
              cursor: 'pointer', outline: 'none', WebkitTapHighlightColor: 'transparent'
            }}
          >
            {mode}
          </button>
        ))}
      </footer>
    </div>
  );
}
