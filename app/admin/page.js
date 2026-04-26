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

  // 1. ユーザーリストと各プロフィールの取得
  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setUsers(profiles);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 2. 特定ユーザーとのメッセージ取得
  const fetchMessages = useCallback(async () => {
    if (!selectedUserId) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      const filtered = data.filter(m => 
        (m.user_id === selectedUserId && m.receiver_id === ADMIN_ID) || 
        (m.user_id === ADMIN_ID && m.receiver_id === selectedUserId)
      );
      setMessages(filtered);
      
      // 既読処理（ホストがメッセージを開いたら未読を既読にする）
      const unreadIds = filtered.filter(m => m.user_id !== ADMIN_ID && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      }
    }
  }, [selectedUserId]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel('admin_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUserId, fetchMessages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. 送信処理
  const sendMessage = async (targetId, text, isGlobal = false) => {
    if (!text.trim()) return;
    const { error } = await supabase.from('messages').insert([{
      content: text,
      user_id: ADMIN_ID,
      receiver_id: targetId,
      is_image: false
    }]);
    if (!error) {
      if (isGlobal) setGlobalText(''); else setInputText('');
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div style={{ 
      width: '100%', maxWidth: '100%', margin: '0 auto', height: '100dvh', 
      display: 'flex', flexDirection: 'column', background: '#000', color: '#fff' 
    }}>
      
      {/* ヘッダー */}
      <header style={{ 
        padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', 
        textAlign: 'center', flexShrink: 0 
      }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - Admin</h1>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* GLOBAL 送信セクション */}
        <div style={{ marginBottom: '30px', background: '#1a1a1a', padding: '20px', borderRadius: '15px', border: '1px solid #800000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <InitialAvatar name="GLOBAL" />
            <h3 style={{ margin: 0, color: '#D4AF37' }}>GLOBAL BROADCAST</h3>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              value={globalText} onChange={e => setGlobalText(e.target.value)}
              placeholder="全ユーザーへ送信..."
              style={{ flex: 1, padding: '10px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}
            />
            <button onClick={() => users.forEach(u => sendMessage(u.id, globalText, true))}
              style={{ background: '#800000', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'serif', fontStyle: 'italic' }}>
              SEND ALL
            </button>
          </div>
        </div>

        {/* ユーザー選択（横幅をチャット画面と統一） */}
        {!selectedUserId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ borderLeft: '4px solid #800000', paddingLeft: '10px' }}>GUESTS</h3>
            {users.map(u => (
              <div key={u.id} onClick={() => setSelectedUserId(u.id)} style={{ 
                padding: '15px 20px', background: '#1a1a1a', borderRadius: '12px', 
                cursor: 'pointer', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '15px' 
              }}>
                {u.avatar_url ? <img src={u.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #D4AF37', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={u.username} />}
                <span style={{ fontWeight: 'bold' }}>{u.username || "Unknown User"}</span>
              </div>
            ))}
          </div>
        ) : (
          /* 個別チャット画面 */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <button onClick={() => setSelectedUserId(null)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
              {selectedUser?.avatar_url ? <img src={selectedUser.avatar_url} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={selectedUser?.username} size="35px" />}
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedUser?.username}</span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '80px' }}>
              {messages.map(m => {
                const isMe = m.user_id === ADMIN_ID;
                return (
                  <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{ 
                      padding: m.is_image ? '5px' : '10px 15px', 
                      background: isMe ? '#800000' : '#2a2a2a', 
                      borderRadius: isMe ? '15px 15px 2px 15px' : '15px 15px 15px 2px',
                      border: isMe ? 'none' : '1px solid #333'
                    }}>
                      {m.is_image ? <img src={m.content} style={{ width: '100%', borderRadius: '10px' }} alt=""/> : m.content}
                    </div>
                    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                      {isMe && <span style={{ fontSize: '0.6rem', color: m.is_read ? '#D4AF37' : '#555' }}>{m.is_read ? '既読' : '未読'}</span>}
                      <span style={{ fontSize: '0.65rem', color: '#666' }}>
                        {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* 送信欄 */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', background: '#000', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
              <input 
                value={inputText} onChange={e => setInputText(e.target.value)}
                placeholder="Message..."
                style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '20px' }}
              />
              <button onClick={() => sendMessage(selectedUserId, inputText)}
                style={{ background: '#800000', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic' }}>
                SEND
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
