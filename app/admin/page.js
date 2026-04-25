"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef(null);

  // ウィンドウサイズ監視
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel('admin-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      setMessages((prev) => [...prev, payload.new]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selectedUserId, viewMode, messages]);

  const userList = messages.reduce((acc, msg) => {
    if (msg.user_id !== ADMIN_ID) {
      acc[msg.user_id] = {
        userId: msg.user_id,
        userName: msg.username || 'GUEST',
        userIcon: msg.avatar_url || 'https://www.gravatar.com/avatar/0?d=mp',
        lastMessage: msg.content,
        timestamp: msg.created_at
      };
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const isImage = (text) => typeof text === 'string' && text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) != null;

  const COLORS = { bg: '#000', sidebar: '#0a0a0a', accent: '#D4AF37', danger: '#B22222', text: '#fff', border: '#222' };

  // --- スワイプ戻り処理（スマホ用） ---
  const [touchStart, setTouchStart] = useState(null);
  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e) => {
    if (touchStart !== null && e.targetTouches[0].clientX - touchStart > 100) {
      setSelectedUserId(null); // 右スワイプでリストに戻る
      setTouchStart(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* サイドバー / ユーザーリスト (スマホで個別チャット中は非表示) */}
        {(!isMobile || (viewMode === 'dm' && !selectedUserId) || viewMode === 'comment') && (
          <div style={{ 
            width: isMobile ? '100%' : '320px', 
            backgroundColor: COLORS.sidebar, 
            borderRight: `1px solid ${COLORS.border}`, 
            display: (isMobile && viewMode === 'comment') ? 'none' : 'flex',
            flexDirection: 'column' 
          }}>
            <div style={{ padding: '20px', borderBottom: `1px solid ${COLORS.danger}`, textAlign: 'center', color: COLORS.accent, fontSize: '12px', letterSpacing: '4px' }}>ADMIN</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {viewMode === 'dm' && chatList.map((user) => (
                <div key={user.userId} onClick={() => setSelectedUserId(user.userId)} style={{ display: 'flex', padding: '15px', cursor: 'pointer', borderBottom: '1px solid #111', backgroundColor: selectedUserId === user.userId ? '#1a0505' : 'transparent', borderLeft: selectedUserId === user.userId ? `4px solid ${COLORS.danger}` : '4px solid transparent' }}>
                  <img src={user.userIcon} style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '15px', border: `1px solid ${COLORS.accent}`, objectFit: 'cover' }} alt="" />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: selectedUserId === user.userId ? COLORS.accent : '#fff' }}>{user.userName}</div>
                    <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* メインチャット画面 */}
        {(!isMobile || selectedUserId || viewMode === 'comment') && (
          <div 
            onTouchStart={handleTouchStart} 
            onTouchMove={handleTouchMove}
            style={{ 
              flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: COLORS.bg,
              position: isMobile ? 'absolute' : 'relative', width: '100%', height: '100%', top: 0, left: 0,
              zIndex: (isMobile && selectedUserId) ? 10 : 1
            }}
          >
            <div style={{ padding: '15px', borderBottom: '1px solid #1a1a1a', color: COLORS.accent, fontSize: '12px', display: 'flex', alignItems: 'center' }}>
              {isMobile && selectedUserId && <span onClick={() => setSelectedUserId(null)} style={{ marginRight: '15px', fontSize: '18px', color: COLORS.danger }}>◀</span>}
              <span>{viewMode === 'dm' ? (selectedUserId ? `TALK: ${userList[selectedUserId]?.userName}` : 'SELECT GUEST') : 'GLOBAL MONITOR'}</span>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`, backgroundSize: '30px 30px' }}>
              {messages.filter(msg => viewMode === 'comment' || msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId)).map((msg) => {
                const isAdmin = msg.user_id === ADMIN_ID;
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '25px' }}>
                    {!isAdmin && <img src={msg.avatar_url || userList[msg.user_id]?.userIcon} style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '10px', border: `1px solid ${COLORS.danger}`, alignSelf: 'flex-start', objectFit: 'cover' }} alt="" />}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                      {!isAdmin && <span style={{ fontSize: '10px', color: COLORS.accent, marginBottom: '4px' }}>{msg.username}</span>}
                      <div style={{ padding: isImage(msg.content) ? '5px' : '10px 14px', borderRadius: '15px', fontSize: '14px', backgroundColor: isAdmin ? '#000' : '#111', color: '#fff', border: isAdmin ? `1px solid ${COLORS.danger}` : `1px solid ${COLORS.border}` }}>
                        {isImage(msg.content) ? <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="" /> : msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --- 画面下の切り替えスイッチ --- */}
      <div style={{ height: '70px', backgroundColor: '#0a0a0a', borderTop: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ textAlign: 'center', cursor: 'pointer', color: viewMode === 'dm' ? COLORS.danger : '#555' }}>
          <div style={{ fontSize: '20px' }}>👤</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>DM型</div>
        </div>
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ textAlign: 'center', cursor: 'pointer', color: viewMode === 'comment' ? COLORS.danger : '#555' }}>
          <div style={{ fontSize: '20px' }}>💬</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>コメント型</div>
        </div>
      </div>
    </div>
  );
}
