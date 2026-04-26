"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

// ここは元のままのID、またはご自身で確認された正しいIDに差し替えてください
const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const GuestAvatar = ({ profile, size = '50px', isSelected }) => {
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "G";
  return (
    <div style={{ 
      position: 'relative', width: size, height: size, 
      opacity: isSelected ? 1 : 0.5, transition: '0.2s' 
    }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} alt="" />
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

  const fetchGuests = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles.filter(p => p.id !== ADMIN_ID));
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    if (data) setMessages(data);
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

  const handleSendGlobal = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');
    const bulk = guests.map(g => ({
      content: text, user_id: ADMIN_ID, receiver_id: g.id, is_image: false, is_read: false
    }));
    await supabase.from('messages').insert(bulk);
  };

  const getDisplayMessages = () => {
    if (viewMode === 'DIRECT') {
      return [...messages.filter(m => 
        (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || 
        (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId)
      )].reverse();
    }
    // GLOBALモード：重複を排除して表示
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
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden' }}>
      <header style={{ padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '5px 15px', borderRadius: '15px' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div style={{ width: '80px', borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '10px' }}>
            {guests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer' }}>
                <GuestAvatar profile={g} isSelected={selectedGuestId === g.id} />
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {getDisplayMessages().map(m => {
              const isMe = m.user_id === ADMIN_ID;
              return (
                <div key={m.id} style={{ marginBottom: '15px', textAlign: isMe ? 'right' : 'left' }}>
                  <div style={{ 
                    display: 'inline-block', padding: '10px', background: isMe ? '#500000' : '#1a1a1a', 
                    borderRadius: '10px', border: isMe ? 'none' : '1px solid #D4AF37', maxWidth: '80%' 
                  }}>
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '15px', background: '#800000', display: 'flex', gap: '10px' }}>
            <input value={inputText} onChange={e => setInputText(e.target.value)} style={{ flex: 1, borderRadius: '20px', padding: '10px', border: 'none' }} />
            <button onClick={handleSendGlobal} style={{ background: '#000', color: '#D4AF37', padding: '0 20px', borderRadius: '20px' }}>SEND</button>
          </div>
        </div>
      </div>
    </div>
  );
}
