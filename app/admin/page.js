"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const InitialAvatar = ({ name, size = '40px', fontSize = '1rem' }) => {
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : "V";
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
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [globalText, setGlobalText] = useState('');
  const scrollRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setUsers(profiles);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!selectedUserId) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      const filtered = data.filter(m => 
        (m.user_id === selectedUserId && m.receiver_id === ADMIN_ID) || 
        (m.user_id === ADMIN_ID && m.receiver_id === selectedUserId)
      );
      setMessages(filtered);
      const unreadIds = filtered.filter(m => m.user_id !== ADMIN_ID && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
    }
  }, [selectedUserId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (!selectedUserId) return;
    fetchMessages();
    const channel = supabase.channel(`chat_${selectedUserId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUserId, fetchMessages]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (targetId, text, isGlobal = false) => {
    if (!text.trim()) return;
    const { error } = await supabase.from('messages').insert([{
      content: text, user_id: ADMIN_ID, receiver_id: targetId, is_image: false
    }]);
    if (!error && !isGlobal) setInputText('');
  };

  const handleGlobalSend = async () => {
    if (!globalText.trim()) return;
    for (const user of users) { await sendMessage(user.id, globalText, true); }
    setGlobalText('');
    alert("全員に送信しました");
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div style={{ width: '100%', height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* 以前の形式のヘッダー */}
      <header style={{ padding: '15px 25px', background: '#800000', borderBottom: '2px solid #D4AF37', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - Host</h1>
      </header>

      {/* メインコンテンツエリア */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* GLOBAL 送信（リストの上に固定） */}
        <div style={{ padding: '15px 20px', background: '#0a0a0a', borderBottom: '1px solid #333' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <InitialAvatar name="G" size="35px" />
            <input value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="GLOBAL MESSAGE..." style={{ flex: 1, padding: '10px 15px', background: '#1a1a1a', border: '1px solid #800000', color: '#fff', borderRadius: '20px' }} />
            <button onClick={handleGlobalSend} style={{ background: '#800000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'serif', fontStyle: 'italic', fontWeight: 'bold' }}>SEND ALL</button>
          </div>
        </div>

        {/* 以前のリスト形式 */}
        {!selectedUserId ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {users.map(u => (
              <div key={u.id} onClick={() => setSelectedUserId(u.id)} style={{ padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                {u.avatar_url ? <img src={u.avatar_url} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} alt=""/> : <InitialAvatar name={u.username} size="45px" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{u.username || "Guest"}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {u.id.substring(0, 8)}...</div>
                </div>
                <div style={{ color: '#D4AF37' }}>→</div>
              </div>
            ))}
          </div>
        ) : (
          /* チャット画面復元 */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ padding: '10px 20px', background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #333' }}>
              <button onClick={() => setSelectedUserId(null)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
              {selectedUser?.avatar_url ? <img src={selectedUser.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <InitialAvatar name={selectedUser?.username} />}
              <span style={{ fontWeight: 'bold' }}>{selectedUser?.username}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
              {messages.map(m => {
                const isMe = m.user_id === ADMIN_ID;
                return (
                  <div key={m.id} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
                    <div style={{ display: 'inline-block', maxWidth: '80%', textAlign: 'left' }}>
                      <div style={{ padding: '10px 15px', background: isMe ? '#800000' : '#222', borderRadius: '15px', border: isMe ? 'none' : '1px solid #333' }}>
                        {m.is_image ? <img src={m.content} style={{ width: '100%', borderRadius: '10px' }} /> : m.content}
                      </div>
                      <div style={{ marginTop: '5px', fontSize: '0.65rem', color: '#555', display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '8px' }}>
                        {isMe && <span style={{ color: m.is_read ? '#D4AF37' : '#555' }}>{m.is_read ? '既読' : '未読'}</span>}
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* 送信入力欄 */}
            <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '15px 20px', background: '#000', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
              <input value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Message..." style={{ flex: 1, padding: '12px 20px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '25px' }} />
              <button onClick={() => sendMessage(selectedUserId, inputText)} style={{ background: '#800000', color: '#fff', border: 'none', width: '70px', borderRadius: '25px', fontFamily: 'serif', fontStyle: 'italic', fontWeight: 'bold' }}>SEND</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
