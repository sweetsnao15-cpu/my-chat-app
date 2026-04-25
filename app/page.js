"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const [profiles, setProfiles] = useState({});
  const scrollRef = useRef(null);

  const COLORS = { bg: '#000', red: '#800000', gold: '#D4AF37', border: '#333' };

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      const pMap = data.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      setProfiles(pMap);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchProfiles();
    const ch = supabase.channel('admin-db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      supabase.from('messages').update({ is_read: true }).eq('user_id', selectedUserId).eq('receiver_id', ADMIN_ID).eq('is_read', false).then(fetchMessages);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selectedUserId, messages, viewMode]);

  // ユーザーリストの集計
  const userList = messages.reduce((acc, m) => {
    const uid = m.user_id !== ADMIN_ID ? m.user_id : m.receiver_id;
    if (uid && uid !== ADMIN_ID) {
      if (!acc[uid]) {
        acc[uid] = { 
          userId: uid, 
          userName: profiles[uid]?.username || 'GUEST', 
          icon: profiles[uid]?.avatar_url, 
          last: m.content, 
          time: m.created_at, 
          unread: 0 
        };
      }
      if (!m.is_read && m.receiver_id === ADMIN_ID && m.user_id === uid) acc[uid].unread++;
      if (new Date(m.created_at) > new Date(acc[uid].time)) { 
        acc[uid].last = m.content; 
        acc[uid].time = m.created_at; 
      }
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div style={{ 
      maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', 
      flexDirection: 'column', background: COLORS.bg, color: '#fff', boxSizing: 'border-box' 
    }}>
      
      {/* HEADER */}
      <header style={{ 
        padding: '0 20px', background: COLORS.red, borderBottom: `2px solid ${COLORS.gold}`, 
        display: 'flex', alignItems: 'center', minHeight: '80px', flexShrink: 0
      }}>
        <div style={{ width: '60px' }}>
          {selectedUserId && (
            <div onClick={() => setSelectedUserId(null)} style={{ cursor: 'pointer', fontSize: '24px', color: COLORS.gold, fontWeight: 'bold' }}>✕</div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {selectedUserId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `1px solid ${COLORS.gold}`, overflow: 'hidden', background: '#222' }}>
                {userList[selectedUserId]?.icon ? (
                  <img src={userList[selectedUserId].icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div style={{ textAlign: 'center', lineHeight: '36px', fontWeight: 'bold', fontSize: '14px' }}>V</div>
                )}
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                {userList[selectedUserId]?.userName}
              </span>
            </div>
          ) : (
            <h1 style={{ fontSize: '2.2rem', fontFamily: 'serif', fontStyle: 'italic', letterSpacing: '3px', margin: 0 }}>
              {viewMode === 'dm' ? "ADMIN" : "GLOBAL"}
            </h1>
          )}
        </div>
        <div style={{ width: '60px' }} />
      </header>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
        {viewMode === 'dm' && !selectedUserId ? (
          <div style={{ width: '100%' }}>
            {chatList.map(u => (
              <div key={u.userId} onClick={() => setSelectedUserId(u.userId)} style={{ 
                display: 'flex', padding: '20px', alignItems: 'center', 
                borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', width: '100%', boxSizing: 'border-box'
              }}>
                <div style={{ 
                  width: '55px', height: '55px', borderRadius: '50%', border: `2px solid ${COLORS.gold}`, 
                  overflow: 'hidden', marginRight: '15px', background: '#222', flexShrink: 0 
                }}>
                  {u.icon ? <img src={u.icon} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : <div style={{textAlign:'center', lineHeight:'55px', fontWeight: 'bold'}}>V</div>}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', color: u.unread > 0 ? COLORS.gold : '#fff', marginBottom: '4px' }}>{u.userName}</div>
                  <div style={{ fontSize: '13px', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.last}
                  </div>
                </div>
                {u.unread > 0 && (
                  <div style={{ 
                    background: COLORS.red, color: '#fff', padding: '3px 10px', 
                    borderRadius: '12px', fontSize: '10px', border: `1px solid ${COLORS.gold}`, fontWeight: 'bold', marginLeft: '10px' 
                  }}>{u.unread}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
            {messages.filter(m => viewMode === 'comment' || (m.user_id === selectedUserId || (m.user_id === ADMIN_ID && m.receiver_id === selectedUserId))).map(m => {
              const isAdmin = m.user_id === ADMIN_ID;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                  {viewMode === 'comment' && !isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: COLORS.gold, fontWeight: 'bold' }}>{profiles[m.user_id]?.username || 'GUEST'}</span>
                    </div>
                  )}
                  <div style={{ 
                    padding: m.is_image ? '5px' : '10px 16px', borderRadius: '18px', 
                    background: COLORS.red, maxWidth: '85%', color: '#fff', border: isAdmin ? `1px solid ${COLORS.gold}` : 'none'
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px', display: 'block' }} alt=""/> : m.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ 
        height: '75px', background: COLORS.red, borderTop: `2px solid ${COLORS.gold}`, 
        display: 'flex', alignItems: 'center', flexShrink: 0
      }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ 
          flex: 1, textAlign: 'center', opacity: viewMode === 'dm' ? 1 : 0.4, 
          cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', fontSize: '14px' 
        }}>DIRECT</div>
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ 
          flex: 1, textAlign: 'center', opacity: viewMode === 'comment' ? 1 : 0.4, 
          cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', fontSize: '14px' 
        }}>GLOBAL</div>
      </footer>
    </div>
  );
}
