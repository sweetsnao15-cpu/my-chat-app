"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const InitialAvatar = ({ name, size = '45px', fontSize = '1.1rem' }) => {
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
  const [view, setView] = useState('DIRECT'); // 'GLOBAL' or 'DIRECT'
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [globalText, setGlobalText] = useState('');
  const scrollRef = useRef(null);

  // ユーザーリスト取得
  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setUsers(profiles);
  }, []);

  // 個別メッセージ取得
  const fetchMessages = useCallback(async () => {
    if (!selectedUserId) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      const filtered = data.filter(m => 
        (m.user_id === selectedUserId && m.receiver_id === ADMIN_ID) || 
        (m.user_id === ADMIN_ID && m.receiver_id === selectedUserId)
      );
      setMessages(filtered);
      // 既読更新
      const unreadIds = filtered.filter(m => m.user_id !== ADMIN_ID && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
    }
  }, [selectedUserId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (selectedUserId) fetchMessages();
    const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      fetchMessages();
      fetchUsers();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUserId, fetchMessages, fetchUsers]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // 送信
  const sendMessage = async (targetId, text) => {
    if (!text.trim()) return;
    await supabase.from('messages').insert([{
      content: text, user_id: ADMIN_ID, receiver_id: targetId, is_image: false
    }]);
  };

  const handleGlobalSend = async () => {
    if (!globalText.trim()) return;
    if (!confirm("全ユーザーにメッセージを送信しますか？")) return;
    for (const u of users) { await sendMessage(u.id, globalText); }
    setGlobalText('');
    alert("送信完了しました");
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div style={{ width: '100%', height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* 復元ヘッダー */}
      <header style={{ padding: '15px 25px', background: '#800000', borderBottom: '2px solid #D4AF37', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - Host</h1>
        </div>
        
        {/* GLOBAL / DIRECT 切り替えスイッチ */}
        <div style={{ display: 'flex', background: '#000', borderRadius: '25px', padding: '3px', border: '1px solid #D4AF37' }}>
          <button onClick={() => { setView('GLOBAL'); setSelectedUserId(null); }} style={{ flex: 1, padding: '8px', borderRadius: '22px', border: 'none', background: view === 'GLOBAL' ? '#D4AF37' : 'transparent', color: view === 'GLOBAL' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>GLOBAL</button>
          <button onClick={() => setView('DIRECT')} style={{ flex: 1, padding: '8px', borderRadius: '22px', border: 'none', background: view === 'DIRECT' ? '#D4AF37' : 'transparent', color: view === 'DIRECT' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>DIRECT</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* GLOBAL 画面 */}
        {view === 'GLOBAL' && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '30px' }}>
              <InitialAvatar name="G" size="80px" fontSize="2.5rem" />
              <h2 style={{ color: '#D4AF37', fontFamily: 'serif', marginTop: '15px' }}>GLOBAL BROADCAST</h2>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>現在 {users.length} 名のユーザーに一斉送信します</p>
            </div>
            <textarea 
              value={globalText} 
              onChange={e => setGlobalText(e.target.value)} 
              placeholder="全員へのメッセージを入力..."
              style={{ width: '100%', maxWidth: '500px', height: '150px', padding: '15px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '15px', outline: 'none', marginBottom: '20px' }}
            />
            <br />
            <button onClick={handleGlobalSend} style={{ width: '100%', maxWidth: '500px', padding: '15px', background: '#800000', color: '#fff', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.2rem', cursor: 'pointer' }}>SEND ALL GUESTS</button>
          </div>
        )}

        {/* DIRECT 画面 */}
        {view === 'DIRECT' && (
          <>
            {!selectedUserId ? (
              /* ゲストリスト */
              <div style={{ padding: '10px' }}>
                {users.map(u => (
                  <div key={u.id} onClick={() => setSelectedUserId(u.id)} style={{ padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                    {u.avatar_url ? <img src={u.avatar_url} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} /> : <InitialAvatar name={u.username} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{u.username || "Guest"}</div>
                      <div style={{ fontSize: '0.7rem', color: '#555' }}>{u.id}</div>
                    </div>
                    <div style={{ color: '#D4AF37' }}>→</div>
                  </div>
                ))}
              </div>
            ) : (
              /* 個別チャット */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '10px 20px', background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '15px', position: 'sticky', top: 0, zIndex: 10 }}>
                  <button onClick={() => setSelectedUserId(null)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '1.5rem' }}>←</button>
                  {selectedUser?.avatar_url ? <img src={selectedUser.avatar_url} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} /> : <InitialAvatar name={selectedUser?.username} size="35px" />}
                  <span style={{ fontWeight: 'bold' }}>{selectedUser?.username}</span>
                </div>

                <div style={{ flex: 1, padding: '20px 20px 100px' }}>
                  {messages.map(m => {
                    const isMe = m.user_id === ADMIN_ID;
                    return (
                      <div key={m.id} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
                        <div style={{ display: 'inline-block', maxWidth: '80%', textAlign: 'left' }}>
                          <div style={{ padding: '10px 15px', background: isMe ? '#800000' : '#222', borderRadius: '15px', border: isMe ? 'none' : '1px solid #333' }}>
                            {m.content}
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

                {/* 固定送信バー */}
                <div style={{ position: 'fixed', bottom: 0, width: '100%', padding: '15px 20px', background: '#000', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
                  <input value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Message..." style={{ flex: 1, padding: '12px 20px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '25px' }} />
                  <button onClick={() => { sendMessage(selectedUserId, inputText); setInputText(''); }} style={{ background: '#800000', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '25px', fontFamily: 'serif', fontStyle: 'italic', fontWeight: 'bold' }}>SEND</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
