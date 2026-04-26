"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const GuestAvatar = ({ profile, size = '50px', isSelected }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "G";
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity: isSelected ? 1 : 0.6, transition: '0.2s', margin: '0 auto' }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '2px solid #D4AF37' : '1px solid #444' }} alt="" />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #D4AF37' }}>{initial}</div>
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
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchGuests = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles.filter(p => p.id !== ADMIN_ID));
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

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [viewMode, selectedGuestId]);

  const handleSendGlobal = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');
    const bulk = guests.map(g => ({ content: text, user_id: ADMIN_ID, receiver_id: g.id, is_image: false, is_read: false }));
    await supabase.from('messages').insert(bulk);
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
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        {filtered.map(m => {
          const currentDate = new Date(m.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
          const showDate = currentDate !== lastDate;
          lastDate = currentDate;
          const isMe = m.user_id === ADMIN_ID;

          return (
            <div key={m.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '30px 0 15px', fontSize: '0.7rem', color: '#D4AF37', letterSpacing: '0.1rem', opacity: 0.8 }}>
                  ― {currentDate} ―
                </div>
              )}
              <div style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
                <div style={{ display: 'inline-block', padding: '12px 16px', background: isMe ? '#500000' : '#1a1a1a', borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px', border: isMe ? 'none' : '1px solid #D4AF37', maxWidth: '85%', fontSize: '0.9rem', whiteSpace: 'pre-wrap', textAlign: 'left', wordBreak: 'break-word' }}>
                  {m.content}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px' }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden' }}>
      <style>{`
        ::-webkit-scrollbar { width: 0px; background: transparent; }
      `}</style>

      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.3rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0, letterSpacing: '2px' }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '4px 20px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '85px', borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px', padding: '20px 0', flexShrink: 0 }}>
            {guests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <GuestAvatar profile={g} isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.55rem', color: selectedGuestId === g.id ? '#D4AF37' : '#888', marginTop: '8px', width: '90%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.username || 'Guest'}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', position: 'relative' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 15px' }}>
            {renderMessages()}
          </div>

          {viewMode === 'GLOBAL' && (
            <div style={{ padding: '15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0 }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="全員へのメッセージを入力..." style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '15px', padding: '10px 15px', resize: 'none', minHeight: '40px', maxHeight: '100px', fontSize: '14px', outline: 'none' }} />
                <button onClick={handleSendGlobal} style={{ background: '#000', color: '#D4AF37', padding: '10px 18px', borderRadius: '15px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '14px' }}>SEND</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
