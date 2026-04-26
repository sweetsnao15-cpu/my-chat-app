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
  const [view, setView] = useState('DIRECT');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]); // 個別用
  const [allMessages, setAllMessages] = useState([]); // GLOBAL用
  const [globalText, setGlobalText] = useState('');
  
  const scrollRef = useRef(null);
  const globalScrollRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    // プロフィールと最新メッセージを結合するためにメッセージも取得
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    
    if (profiles && msgs) {
      const usersWithLastMsg = profiles.map(u => {
        const lastMsg = msgs.find(m => m.user_id === u.id || m.receiver_id === u.id);
        return { ...u, lastMessage: lastMsg ? lastMsg.content : "メッセージはありません" };
      });
      setUsers(usersWithLastMsg);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!selectedUserId) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      const filtered = data.filter(m => (m.user_id === selectedUserId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedUserId));
      setMessages(filtered);
    }
  }, [selectedUserId]);

  const fetchAllMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setAllMessages(data);
  }, []);

  useEffect(() => { fetchUsers(); fetchAllMessages(); }, [fetchUsers, fetchAllMessages]);

  useEffect(() => {
    if (selectedUserId) fetchMessages();
    const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      fetchMessages();
      fetchAllMessages();
      fetchUsers();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUserId, fetchMessages, fetchAllMessages, fetchUsers]);

  useEffect(() => {
    if (view === 'GLOBAL') globalScrollRef.current?.scrollIntoView({ behavior: "smooth" });
    else scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, allMessages, view]);

  const handleGlobalSend = async () => {
    if (!globalText.trim() || !confirm("全ゲストに一斉送信しますか？")) return;
    const sendPromises = users.map(u => 
      supabase.from('messages').insert([{ content: globalText, user_id: ADMIN_ID, receiver_id: u.id, is_image: false }])
    );
    await Promise.all(sendPromises);
    setGlobalText('');
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  // 日付と吹き出しのレンダリング関数（共通化）
  const renderMessageList = (msgs, isGlobal = false) => {
    return msgs.map((m, i) => {
      const isMe = m.user_id === ADMIN_ID;
      const sender = users.find(u => u.id === m.user_id);
      const mDate = new Date(m.created_at).toLocaleDateString();
      const showDate = i === 0 || mDate !== new Date(msgs[i - 1].created_at).toLocaleDateString();

      return (
        <div key={m.id}>
          {showDate && <div style={{ textAlign: 'center', margin: '30px 0', fontSize: '0.85rem', color: '#999', fontFamily: 'serif', letterSpacing: '1px' }}>― {mDate} ―</div>}
          <div style={{ marginBottom: '22px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '85%', flexDirection: isMe ? 'row-reverse' : 'row' }}>
              {!isMe && (
                sender?.avatar_url ? 
                <img src={sender.avatar_url} style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #D4AF37', objectFit: 'cover' }} alt="" /> : 
                <InitialAvatar name={sender?.username || "G"} size="35px" fontSize="0.9rem" />
              )}
              <div>
                {!isMe && isGlobal && <div style={{ fontSize: '0.7rem', color: '#D4AF37', marginBottom: '4px', fontWeight: 'bold' }}>{sender?.username || "Guest"}</div>}
                <div style={{ 
                  padding: m.is_image ? '5px' : '12px 18px', 
                  background: 'rgba(128, 0, 0, 0.85)', 
                  borderRadius: isMe ? '20px 20px 0 20px' : '20px 20px 20px 0', 
                  color: '#fff', 
                  border: isMe ? 'none' : '2px solid #D4AF37',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  wordBreak: 'break-all'
                }}>
                  {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '15px', display: 'block' }} alt="" /> : m.content}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px', textAlign: isMe ? 'right' : 'left' }}>
                  {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div style={{ width: '100%', height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ padding: '15px 25px', background: '#800000', borderBottom: '2px solid #D4AF37', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', marginBottom: '10px', margin: 0 }}>for VAU - Host</h1>
        <div style={{ display: 'flex', background: '#000', borderRadius: '25px', padding: '3px', border: '1px solid #D4AF37' }}>
          <button onClick={() => { setView('GLOBAL'); setSelectedUserId(null); }} style={{ flex: 1, padding: '8px', borderRadius: '22px', border: 'none', background: view === 'GLOBAL' ? '#D4AF37' : 'transparent', color: view === 'GLOBAL' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer' }}>GLOBAL</button>
          <button onClick={() => setView('DIRECT')} style={{ flex: 1, padding: '8px', borderRadius: '22px', border: 'none', background: view === 'DIRECT' ? '#D4AF37' : 'transparent', color: view === 'DIRECT' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer' }}>DIRECT</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        
        {view === 'GLOBAL' ? (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <div style={{ flex: 1, padding: '20px 20px 120px' }}>
              {renderMessageList(allMessages, true)}
              <div ref={globalScrollRef} />
            </div>
            {/* GLOBAL下部送信バー */}
            <div style={{ position: 'fixed', bottom: 0, width: '100%', padding: '15px 20px 30px', background: '#800000', borderTop: '2px solid #D4AF37', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  value={globalText} 
                  onChange={e => setGlobalText(e.target.value)} 
                  placeholder="全員に一斉送信..." 
                  style={{ flex: 1, padding: '12px 20px', background: '#000', color: '#fff', borderRadius: '25px', border: '1px solid #333', outline: 'none' }} 
                />
                <button onClick={handleGlobalSend} style={{ background: '#000', color: '#D4AF37', border: 'none', padding: '0 25px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'serif', fontStyle: 'italic' }}>SEND ALL</button>
              </div>
            </div>
          </div>
        ) : (
          /* DIRECT VIEW */
          <>
            {!selectedUserId ? (
              <div style={{ padding: '10px' }}>
                {users.map(u => (
                  <div key={u.id} onClick={() => setSelectedUserId(u.id)} style={{ padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                    {u.avatar_url ? <img src={u.avatar_url} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} alt="" /> : <InitialAvatar name={u.username} />}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 'bold', color: '#D4AF37' }}>{u.username || "Guest"}</div>
                      <div style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '4px' }}>
                        {u.lastMessage}
                      </div>
                    </div>
                    <div style={{ color: '#D4AF37' }}>→</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '10px 20px', background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #333' }}>
                  <button onClick={() => setSelectedUserId(null)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
                  <span style={{ fontWeight: 'bold' }}>{selectedUser?.username} (閲覧専用)</span>
                </div>
                <div style={{ flex: 1, padding: '20px 20px', overflowY: 'auto' }}>
                  {renderMessageList(messages)}
                  <div ref={scrollRef} />
                </div>
                {/* DIRECTには送信機能なし */}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
