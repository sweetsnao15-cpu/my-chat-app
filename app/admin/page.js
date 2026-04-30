"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// アバターコンポーネント：画像保存・メニュー禁止処理を追加
const Avatar = ({ profile, size = '32px', isSelected = true }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "V";
  return (
    <div style={{ 
      position: 'relative', width: size, height: size, 
      opacity: isSelected ? 1 : 0.6, flexShrink: 0,
      // iPhoneなどの長押しメニュー禁止
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none'
    }}>
      {profile?.avatar_url ? (
        <img 
          src={profile.avatar_url} 
          // 右クリックメニュー禁止
          onContextMenu={(e) => e.preventDefault()}
          // ドラッグ保存禁止
          onDragStart={(e) => e.preventDefault()}
          style={{ 
            width: '100%', height: '100%', borderRadius: '50%', 
            objectFit: 'cover', border: isSelected ? '1px solid #D4AF37' : '1px solid #444',
            // 画像自体へのイベントを無効化し、親の長押し判定を優先させる
            pointerEvents: 'none' 
          }} 
          alt="" 
        />
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', ADMIN_ID);
    if (data) setBlockedIds(data.map(b => b.blocked_id));
  }, []);

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setGuests(data);
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

  useEffect(() => {
    fetchBlocks(); fetchGuests(); fetchMessages();
    const channel = supabase.channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBlocks, fetchGuests, fetchMessages]);

  useEffect(() => { scrollToBottomInstant(); }, [viewMode, selectedGuestId, messages, scrollToBottomInstant]);

  const handleBlockUser = async (targetId) => {
    if (!confirm("このユーザーをブロックしますか？メッセージも非表示になります。")) return;
    const { error } = await supabase.from('blocks').insert([{ blocker_id: ADMIN_ID, blocked_id: targetId }]);
    if (error) alert("ブロックに失敗しました。");
    else { setLongPressedGuestId(null); fetchMessages(); }
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
        const lastMsgA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
        const lastMsgB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
        return (lastMsgB ? new Date(lastMsgB.created_at).getTime() : 0) - (lastMsgA ? new Date(lastMsgA.created_at).getTime() : 0);
      });
  }, [guests, messages, blockedIds]);

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
          const isNewDay = index === 0 || new Date(filtered[index - 1].created_at).toDateString() !== date.toDateString();
          return (
            <div key={m.id}>
              {isNewDay && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                  <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold' }}>-{date.toLocaleDateString()}-</div>
                </div>
              )}
              <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                  {!isMe && viewMode !== 'DIRECT' && <Avatar profile={senderProfile} size="28px" />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', flex: 1 }}>
                    {!isMe && viewMode === 'GLOBAL' && <span style={{ fontSize: '0.7rem', color: '#D4AF37', marginBottom: '4px' }}>{senderProfile?.username || 'Guest'}</span>}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div style={{ padding: m.is_image ? '5px' : '10px 14px', background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', fontSize: '0.9rem', color: '#fff' }}>
                        {m.is_image ? <img src={m.content} onContextMenu={(e)=>e.preventDefault()} style={{ maxWidth: '100%', borderRadius: '10px', pointerEvents: 'none' }} /> : m.content}
                      </div>
                      <div style={{ fontSize: '0.5rem', color: '#D4AF37' }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
      onContextMenu={(e) => e.preventDefault()} // ページ全体のメニュー禁止
      style={{ 
        width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
        background: '#000', color: '#fff', overflow: 'hidden',
        WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' 
      }}
    >
      <header style={{ padding: '20px', background: '#800020', borderBottom: '1px solid #D4AF37', textAlign: 'center', zIndex: 10 }}>
        <h1 style={{ fontSize: '1.5rem', fontStyle: 'italic', margin: 0 }}>for VAU ｰHOSTｰ</h1>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ 
            width: '80px', borderRight: '1px solid #222', 
            overflowY: 'auto', overflowX: 'visible', // ブロックボタンがはみ出せるように設定
            display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px 0' 
          }}>
            {filteredGuests.map(g => (
              <div 
                key={g.id} 
                onMouseDown={() => startPress(g.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                onTouchStart={() => startPress(g.id)} onTouchEnd={cancelPress}
                onClick={(e) => { e.stopPropagation(); setSelectedGuestId(g.id); }}
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <Avatar profile={g} size="45px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.5rem', color: selectedGuestId === g.id ? '#D4AF37' : '#555', marginTop: '5px' }}>{g.username?.substring(0, 5)}</div>
                
                {longPressedGuestId === g.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleBlockUser(g.id); }} 
                    style={{ 
                      position: 'absolute', 
                      top: '50%', 
                      left: '60px', 
                      transform: 'translateY(-50%)',
                      zIndex: 9999, // 最前面
                      background: '#ff4444', 
                      color: '#fff', 
                      border: '2px solid #fff', 
                      borderRadius: '8px', 
                      padding: '10px 15px', 
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                    }}
                  >
                    ブロック
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, background: '#050505', overflowY: 'auto', padding: '15px' }} ref={scrollRef}>
          {renderMessages()}
        </div>
      </div>

      <footer style={{ padding: '15px', background: '#800020', borderTop: '1px solid #D4AF37', display: 'flex', justifyContent: 'center', gap: '40px', zIndex: 10 }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{ background: 'transparent', color: viewMode === mode ? '#D4AF37' : '#fff', border: 'none', fontWeight: 'bold', borderBottom: viewMode === mode ? '2px solid #D4AF37' : 'none' }}>
            {mode}
          </button>
        ))}
      </footer>
    </div>
  );
}
