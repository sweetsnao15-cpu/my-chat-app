"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const scrollRef = useRef(null);

  // ゲスト側と完全に一致させるカラー設定
  const COLORS = {
    bg: '#000000',
    guestRed: '#FF0000', // 鮮やかな赤
    textWhite: '#FFFFFF',
    darkBorder: '#333333',
    accentGold: '#D4AF37'
  };

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
    if (msg.user_id !== ADMIN_ID && msg.user_id) {
      acc[msg.user_id] = {
        userId: msg.user_id,
        userName: msg.username || 'GUEST',
        userIcon: msg.avatar_url || 'https://www.gravatar.com/avatar/0?d=mp',
        lastMessage: msg.content
      };
    }
    return acc;
  }, {});

  const chatList = Object.values(userList);
  const isImage = (text) => typeof text === 'string' && text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) != null;

  // スワイプ戻り処理
  const [touchStart, setTouchStart] = useState(null);
  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e) => {
    if (touchStart !== null && e.targetTouches[0].clientX - touchStart > 80) {
      setSelectedUserId(null);
      setTouchStart(null);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      backgroundColor: COLORS.bg, 
      color: COLORS.textWhite, 
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      maxWidth: '430px', // ゲスト側と同じサイズ
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 0 50px rgba(255,0,0,0.2)'
    }}>
      
      {/* ヘッダー全体を赤に */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: COLORS.guestRed, 
        textAlign: 'center', 
        zIndex: 100,
        position: 'relative'
      }}>
        <div style={{ fontWeight: '900', fontSize: '14px', letterSpacing: '5px' }}>MANAGER</div>
        {selectedUserId && (
          <div onClick={() => setSelectedUserId(null)} style={{ position: 'absolute', left: '15px', top: '15px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>✕</div>
        )}
      </div>

      {/* メインエリア */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
        
        {/* リスト画面 */}
        {viewMode === 'dm' && !selectedUserId && (
          <div style={{ backgroundColor: COLORS.bg }}>
            {chatList.length === 0 && <div style={{ textAlign: 'center', padding: '50px', color: '#555' }}>No Messages</div>}
            {chatList.map((user) => (
              <div key={user.userId} onClick={() => setSelectedUserId(user.userId)} style={{ 
                display: 'flex', padding: '18px 15px', alignItems: 'center', borderBottom: `1px solid ${COLORS.darkBorder}`,
                backgroundColor: '#000'
              }}>
                <img src={user.userIcon} style={{ width: '50px', height: '50px', borderRadius: '50%', marginRight: '15px', border: `2px solid ${COLORS.guestRed}`, objectFit: 'cover' }} alt="" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{user.userName}</div>
                  <div style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
                </div>
                <div style={{ color: COLORS.guestRed, fontSize: '18px' }}>›</div>
              </div>
            ))}
          </div>
        )}

        {/* チャット画面 */}
        {(selectedUserId || viewMode === 'comment') && (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto', backgroundImage: 'linear-gradient(rgba(255,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {messages.filter(msg => viewMode === 'comment' || msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId)).map((msg) => {
              const isAdmin = msg.user_id === ADMIN_ID;
              const displayIcon = isAdmin ? 'https://www.gravatar.com/avatar/admin?d=mp' : (msg.avatar_url || userList[msg.user_id]?.userIcon);
              const displayName = isAdmin ? 'HOST' : (msg.username || userList[msg.user_id]?.userName);

              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                  {!isAdmin && <img src={displayIcon} style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px', border: `1px solid ${COLORS.guestRed}`, objectFit: 'cover' }} alt="" />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    {!isAdmin && <span style={{ fontSize: '11px', color: COLORS.accentGold, marginBottom: '5px', fontWeight: 'bold' }}>{displayName}</span>}
                    <div style={{ 
                      padding: isImage(msg.content) ? '6px' : '12px 16px', 
                      borderRadius: isAdmin ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                      fontSize: '14px', 
                      backgroundColor: isAdmin ? COLORS.guestRed : COLORS.darkBorder, // ホスト側の吹き出しを赤に
                      color: COLORS.textWhite, 
                      fontWeight: '500',
                      boxShadow: isAdmin ? '0 4px 15px rgba(255,0,0,0.3)' : 'none'
                    }}>
                      {isImage(msg.content) ? <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '12px' }} alt="" /> : msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* フッター全体を赤に・スイッチをおしゃれに */}
      <div style={{ 
        height: '80px', 
        backgroundColor: COLORS.guestRed, 
        display: 'flex', 
        alignItems: 'center', 
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ 
          flex: 1, textAlign: 'center', cursor: 'pointer', opacity: viewMode === 'dm' ? 1 : 0.5,
          transition: '0.3s', display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '2px' }}>👤</div>
          <div style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>DIRECT</div>
          {viewMode === 'dm' && <div style={{ width: '20px', height: '2px', backgroundColor: '#fff', marginTop: '4px' }} />}
        </div>
        
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ 
          flex: 1, textAlign: 'center', cursor: 'pointer', opacity: viewMode === 'comment' ? 1 : 0.5,
          transition: '0.3s', display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '2px' }}>💬</div>
          <div style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>GLOBAL</div>
          {viewMode === 'comment' && <div style={{ width: '20px', height: '2px', backgroundColor: '#fff', marginTop: '4px' }} />}
        </div>
      </div>
    </div>
  );
}
