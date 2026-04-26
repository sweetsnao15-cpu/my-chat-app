"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const GuestAvatar = ({ profile, size = '40px', fontSize = '0.8rem' }) => {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37', pointerEvents: 'none' }} alt="" />;
  }
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "G";
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, border: '1px solid #D4AF37', flexShrink: 0
    }}>{initial}</div>
  );
};

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('GLOBAL');
  const [guests, setGuests] = useState([]);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const scrollRef = useRef(null);

  const fetchGuests = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles.filter(p => p.id !== ADMIN_ID));
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();
    const channel = supabase.channel('admin_room').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  const sortedGuests = useMemo(() => {
    return [...guests].sort((a, b) => {
      const lastMsgA = [...messages].reverse().find(m => m.user_id === a.id || m.receiver_id === a.id);
      const lastMsgB = [...messages].reverse().find(m => m.user_id === b.id || m.receiver_id === b.id);
      const timeA = lastMsgA ? new Date(lastMsgA.created_at).getTime() : 0;
      const timeB = lastMsgB ? new Date(lastMsgB.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [guests, messages]);

  useEffect(() => {
    // ゲスト選択時は behavior: "auto" で瞬時に最新へ
    // それ以外（メッセージ更新時など）は viewMode に応じて調整
    scrollRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, viewMode, selectedGuestId]);

  const handleSendGlobal = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');
    const bulkMessages = guests.map(g => ({
      content: text, user_id: ADMIN_ID, receiver_id: g.id, is_image: false, is_read: false
    }));
    await supabase.from('messages').insert(bulkMessages);
  };

  const getDisplayMessages = () => {
    if (viewMode === 'DIRECT') {
      return messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId));
    }
    const displayed = [];
    const seenTimestamps = new Set();
    messages.forEach(m => {
      if (m.user_id === ADMIN_ID) {
        const ts = new Date(m.created_at).getTime();
        const key = `${m.content}_${Math.floor(ts / 1000)}`;
        if (!seenTimestamps.has(key)) {
          displayed.push(m);
          seenTimestamps.add(key);
        }
      } else {
        displayed.push(m);
      }
    });
    return displayed;
  };

  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden' }}>
      <style>{`
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #800000; border-radius: 10px; }
        img { -webkit-touch-callout: none; pointer-events: none; }
      `}</style>

      <header style={{ padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
          <button onClick={() => setViewMode('GLOBAL')} style={{ background: viewMode === 'GLOBAL' ? '#D4AF37' : 'transparent', color: viewMode === 'GLOBAL' ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '5px 15px', borderRadius: '15px', cursor: 'pointer' }}>GLOBAL</button>
          <button onClick={() => setViewMode('DIRECT')} style={{ background: viewMode === 'DIRECT' ? '#D4AF37' : 'transparent', color: viewMode === 'DIRECT' ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '5px 15px', borderRadius: '15px', cursor: 'pointer' }}>DIRECT</button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '100px', borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '15px 0', flexShrink: 0 }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', textAlign: 'center', width: '100%', opacity: selectedGuestId === g.id ? 1 : 0.4 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <GuestAvatar profile={g} size="50px" />
                </div>
                <div style={{ fontSize: '0.6rem', color: '#D4AF37', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 5px' }}>
                  {g.username || 'No Name'}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {getDisplayMessages().map(m => {
              const isMe = m.user_id === ADMIN_ID;
              const guest = guests.find(g => g.id === (isMe ? m.receiver_id : m.user_id));
              return (
                <div key={m.id} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                    {!isMe && <GuestAvatar profile={guest} />}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && viewMode === 'GLOBAL' && <div style={{ fontSize: '0.7rem', color: '#D4AF37', marginBottom: '4px' }}>{guest?.username}</div>}
                      <div style={{ 
                        padding: m.is_image ? '5px' : '10px 15px', background: isMe ? '#500000' : '#1a1a1a', 
                        borderRadius: isMe ? '15px 15px 0 15px' : '15px 15px 15px 0', border: isMe ? 'none' : '1px solid #D4AF37', maxWidth: '320px',
                        whiteSpace: 'pre-wrap', // 【修正】改行を反映
                        wordBreak: 'break-word',
                        textAlign: 'left'
                      }}>
                        {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="" /> : m.content}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '4px' }}>
                        {isMe && m.is_read && viewMode === 'DIRECT' && <span style={{ color: '#D4AF37', marginRight: '5px' }}>既読</span>}
                        {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>

          {viewMode === 'GLOBAL' && (
            <div style={{ padding: '15px', background: '#800000', display: 'flex', gap: '10px', borderTop: '2px solid #D4AF37', flexShrink: 0 }}>
              <textarea 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                placeholder="全ゲストへ一斉送信..."
                style={{ flex: 1, background: '#800000', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', padding: '10px 15px', outline: 'none', resize: 'none', height: '42px', fontSize: '16px' }}
              />
              <button 
                onClick={handleSendGlobal}
                style={{ background: '#000', color: '#D4AF37', padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.1rem', border: 'none', cursor: 'pointer' }}
              >SEND</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
