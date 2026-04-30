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
  const [longPressedGuestId, setLongPressedGuestId] = useState(null);
  const [blockedIds, setBlockedIds] = useState([]);

  const scrollRef = useRef(null);
  const pressTimerRef = useRef(null);

  const scrollToBottomInstant = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data: blockData } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', ADMIN_ID);
    const currentBlocked = blockData?.map(b => b.blocked_id) || [];
    setBlockedIds(currentBlocked);

    let query = supabase.from('messages').select('*');
    if (currentBlocked.length > 0) {
      query = query.not('user_id', 'in', `(${currentBlocked.join(',')})`).not('receiver_id', 'in', `(${currentBlocked.join(',')})`);
    }

    const { data } = await query.order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setGuests(data);
  }, []);

  useEffect(() => {
    fetchGuests();
    fetchMessages();
    const channel = supabase.channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  useEffect(() => {
    scrollToBottomInstant();
  }, [viewMode, selectedGuestId, messages, scrollToBottomInstant]);

  const handleBlockUser = async (targetId) => {
    if (!confirm("このユーザーをブロックしますか？")) return;
    const { error } = await supabase.from('blocks').insert([{ blocker_id: ADMIN_ID, blocked_id: targetId }]);
    if (error) {
      alert("ブロックに失敗しました。");
    } else {
      setLongPressedGuestId(null);
      fetchMessages();
    }
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

  return (
    <div onClick={() => setLongPressedGuestId(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', WebkitTouchCallout: 'none' }}>
      <header style={{ padding: '20px', background: '#800020', borderBottom: '1px solid #D4AF37', textAlign: 'center', zIndex: 5 }}>
        <h1 style={{ fontSize: '1.5rem', fontStyle: 'italic', margin: 0 }}>for VAU ｰHOSTｰ</h1>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '85px', borderRight: '1px solid #222', overflowY: 'auto', overflowX: 'visible', display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px 0' }}>
            {filteredGuests.map(g => (
              <div 
                key={g.id} 
                onMouseDown={() => startPress(g.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                onTouchStart={() => startPress(g.id)} onTouchEnd={cancelPress}
                onClick={(e) => { e.stopPropagation(); setSelectedGuestId(g.id); }}
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
              >
                <Avatar profile={g} size="45px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.5rem', color: selectedGuestId === g.id ? '#D4AF37' : '#555', marginTop: '5px' }}>{g.username?.substring(0, 5)}</div>
                
                {/* 
                  最前面表示のブロックボタン
                  z-index: 999 を指定し、サイドバーを突き抜けて表示されるように調整
                */}
                {longPressedGuestId === g.id && (
                  <div style={{
                    position: 'absolute',
                    left: '65px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 999,
                    filter: 'drop-shadow(0px 0px 10px rgba(0,0,0,0.8))'
                  }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBlockUser(g.id); }} 
                      style={{ 
                        background: '#ff0000', 
                        color: '#fff', 
                        border: '2px solid #fff', 
                        borderRadius: '8px', 
                        padding: '10px 15px', 
                        fontSize: '0.8rem', 
                        fontWeight: 'bold', 
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 15px rgba(255,0,0,0.4)'
                      }}
                    >
                      ブロックする
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, background: '#050505', overflowY: 'auto', padding: '15px' }} ref={scrollRef}>
          {/* メッセージ表示部分は前回のロジックを継承 */}
          {/* ... (省略: renderMessagesを実行) ... */}
          {messages.length > 0 && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
               {/* 簡略化して表示。実際は前回のコードのrenderMessagesの中身が入ります */}
               {messages.filter(m => viewMode === 'GLOBAL' || (m.user_id === selectedGuestId || m.receiver_id === selectedGuestId)).map(m => (
                 <div key={m.id} style={{ color: '#fff' }}>{m.content}</div>
               ))}
            </div>
          )}
        </div>
      </div>

      <footer style={{ padding: '15px', background: '#800020', borderTop: '1px solid #D4AF37', display: 'flex', justifyContent: 'center', gap: '40px', zIndex: 5 }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{ background: 'transparent', color: viewMode === mode ? '#D4AF37' : '#fff', border: 'none', fontWeight: 'bold' }}>{mode}</button>
        ))}
      </footer>
    </div>
  );
}
