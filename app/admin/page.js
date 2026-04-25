"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  const COLORS = {
    bg: '#000000',
    guestRed: '#800000', 
    accentGold: '#D4AF37',
    textWhite: '#FFFFFF',
    darkBorder: '#333'
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  };

  const markAsRead = async (userId) => {
    if (!userId) return;
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('receiver_id', ADMIN_ID)
      .eq('is_read', false);
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel('admin-db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      fetchMessages();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      markAsRead(selectedUserId);
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedUserId, messages]);

  const userList = messages.reduce((acc, msg) => {
    if (msg.user_id !== ADMIN_ID && msg.user_id) {
      const isUnread = !msg.is_read && msg.receiver_id === ADMIN_ID;
      if (!acc[msg.user_id] || new Date(msg.created_at) > new Date(acc[msg.user_id].timestamp)) {
        acc[msg.user_id] = {
          userId: msg.user_id,
          userName: msg.username || 'GUEST',
          userIcon: msg.avatar_url || '',
          lastMessage: msg.content,
          timestamp: msg.created_at,
          unreadCount: (acc[msg.user_id]?.unreadCount || 0) + (isUnread ? 1 : 0)
        };
      } else if (isUnread) {
        acc[msg.user_id].unreadCount++;
      }
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedUserId) return;
    const content = inputText;
    setInputText('');
    const { error } = await supabase.from('messages').insert([{
      content,
      user_id: ADMIN_ID,
      recipient_id: selectedUserId,
      receiver_id: selectedUserId,
      username: 'ADMIN',
      is_read: false
    }]);
    if (error) alert(error.message);
  };

  return (
    <div style={{ 
      maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: COLORS.bg, color: COLORS.textWhite, position: 'relative', overflow: 'hidden'
    }}>
      
      <header style={{ 
        padding: '10px 25px', background: COLORS.guestRed, borderBottom: `2px solid ${COLORS.accentGold}`,
        display: 'flex', alignItems: 'center', minHeight: '80px', position: 'relative', zIndex: 10 
      }}>
        {selectedUserId && (
          <div onClick={() => setSelectedUserId(null)} style={{ position: 'absolute', left: '15px', cursor: 'pointer', fontSize: '18px', color: COLORS.accentGold }}>✕</div>
        )}
        <h1 style={{ 
          flex: 1, textAlign: 'center', fontSize: '2.2rem', fontWeight: '700', letterSpacing: '3px',
          fontFamily: '"Times New Roman", Times, serif', fontStyle: 'italic', textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          {viewMode === 'dm' ? (selectedUserId ? userList[selectedUserId]?.userName : "ADMIN") : "GLOBAL"}
        </h1>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', background: '#000' }}>
        {viewMode === 'dm' && !selectedUserId ? (
          <div>
            {chatList.map((u) => (
              <div key={u.userId} onClick={() => setSelectedUserId(u.userId)} style={{ 
                display: 'flex', padding: '20px 15px', alignItems: 'center', borderBottom: `1px solid ${COLORS.darkBorder}`
              }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: COLORS.accentGold, marginRight: '15px', border: `2px solid ${COLORS.accentGold}`, overflow: 'hidden' }}>
                  {u.userIcon ? <img src={u.userIcon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ textAlign: 'center', lineHeight: '50px', fontWeight: 'bold' }}>V</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: u.unreadCount > 0 ? COLORS.accentGold : '#fff' }}>{u.userName}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{u.lastMessage}</div>
                </div>
                {u.unreadCount > 0 && (
                  <div style={{ background: COLORS.guestRed, color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{u.unreadCount}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            {messages.filter(m => viewMode === 'comment' || m.user_id === selectedUserId || (m.user_id === ADMIN_ID && (m.recipient_id === selectedUserId || m.receiver_id === selectedUserId))).map((m) => {
              const isAdmin = m.user_id === ADMIN_ID;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                  {!isAdmin && (
                    <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: COLORS.accentGold, marginRight: '10px', overflow: 'hidden', border: `1px solid ${COLORS.accentGold}`, alignSelf: 'flex-start' }}>
                      {m.avatar_url && <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                    </div>
                  )}
                  <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                    {!isAdmin && <span style={{ fontSize: '10px', color: COLORS.accentGold, marginBottom: '4px', fontWeight: 'bold' }}>{m.username}</span>}
                    <div style={{ position: 'relative' }}>
                      <div style={{ 
                        padding: m.is_image ? '5px' : '10px 16px', borderRadius: isAdmin ? '18px 18px 0 18px' : '18px 18px 18px 0',
                        background: isAdmin ? COLORS.guestRed : '#333', color: '#fff', fontSize: '14px', border: isAdmin ? 'none' : '1px solid #444'
                      }}>
                        {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px' }} alt="" /> : m.content}
                      </div>
                      {isAdmin && m.is_read && (
                        <span style={{ position: 'absolute', left: '-20px', bottom: '2px', fontSize: '10px', color: COLORS.accentGold }}>✓</span>
                      )}
                    </div>
                    <span style={{ fontSize: '8px', color: '#666', marginTop: '4px' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedUserId && (
        <div style={{ padding: '15px 20px', background: COLORS.guestRed, display: 'flex', gap: '10px', borderTop: `2px solid ${COLORS.accentGold}` }}>
          <textarea 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            placeholder="管理者として返信..." 
            style={{ 
              flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', 
              outline: 'none', resize: 'none', height: '40px', fontSize: '14px', background: '#fff' 
            }} 
          />
          <button 
            onClick={sendMessage} 
            style={{ 
              background: '#000', color: COLORS.accentGold, width: '60px', height: '40px', borderRadius: '20px', border: 'none', 
              fontWeight: 'bold', fontSize: '11px', fontFamily: '"Times New Roman", serif', fontStyle: 'italic'
            }}
          >
            SEND
          </button>
        </div>
      )}

      {/* フッター：アイコンを削除し文字のみに調整 */}
      <footer style={{ 
        height: '70px', background: COLORS.guestRed, borderTop: `2px solid ${COLORS.accentGold}`,
        display: 'flex', alignItems: 'center', paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', opacity: viewMode === 'dm' ? 1 : 0.4 }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', letterSpacing: '2px' }}>DIRECT</div>
        </div>
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', opacity: viewMode === 'comment' ? 1 : 0.4 }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', letterSpacing: '2px' }}>GLOBAL</div>
        </div>
      </footer>
    </div>
  );
}
