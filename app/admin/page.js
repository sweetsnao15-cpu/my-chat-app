"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); 
  const scrollRef = useRef(null);

  // 色の定義（ゲスト側と同じ赤・黒・金）
  const COLORS = {
    bg: '#000000',
    accentRed: '#E60012', // ゲスト側の赤
    accentGold: '#D4AF37',
    darkGray: '#1A1A1A',
    text: '#FFFFFF'
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

  // ユーザーリストの抽出（username, avatar_url を保持）
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
      color: COLORS.text, 
      fontFamily: 'sans-serif',
      maxWidth: '500px', // ゲスト側の画面幅に合わせる
      margin: '0 auto',
      borderLeft: `1px solid ${COLORS.darkGray}`,
      borderRight: `1px solid ${COLORS.darkGray}`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* ヘッダー */}
      <div style={{ 
        padding: '15px', 
        borderBottom: `2px solid ${COLORS.accentRed}`, 
        textAlign: 'center', 
        backgroundColor: COLORS.bg,
        zIndex: 100
      }}>
        <div style={{ color: COLORS.accentGold, fontSize: '12px', letterSpacing: '3px' }}>MANAGER</div>
        {selectedUserId && (
          <div onClick={() => setSelectedUserId(null)} style={{ position: 'absolute', left: '15px', color: COLORS.accentRed, cursor: 'pointer' }}>◀ BACK</div>
        )}
      </div>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
        
        {/* DMリスト画面（未選択時のみ表示） */}
        {viewMode === 'dm' && !selectedUserId && (
          <div style={{ backgroundColor: COLORS.bg }}>
            {chatList.map((user) => (
              <div key={user.userId} onClick={() => setSelectedUserId(user.userId)} style={{ 
                display: 'flex', padding: '15px', alignItems: 'center', borderBottom: `1px solid ${COLORS.darkGray}`,
                backgroundColor: '#050505'
              }}>
                <img src={user.userIcon} style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '15px', border: `1px solid ${COLORS.accentRed}`, objectFit: 'cover' }} alt="" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: COLORS.accentGold }}>{user.userName}</div>
                  <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* チャット履歴画面（DM選択中 または 全表示モード） */}
        {(selectedUserId || viewMode === 'comment') && (
          <div ref={scrollRef} style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            {messages.filter(msg => viewMode === 'comment' || msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId)).map((msg) => {
              const isAdmin = msg.user_id === ADMIN_ID;
              // ここで名前とアイコンを確実に反映
              const displayIcon = isAdmin ? 'https://www.gravatar.com/avatar/admin?d=identicon' : (msg.avatar_url || userList[msg.user_id]?.userIcon);
              const displayName = isAdmin ? 'HOST' : (msg.username || userList[msg.user_id]?.userName);

              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
                  {!isAdmin && <img src={displayIcon} style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '10px', border: `1px solid ${COLORS.accentRed}`, objectFit: 'cover' }} alt="" />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    {!isAdmin && <span style={{ fontSize: '10px', color: COLORS.accentGold, marginBottom: '4px' }}>{displayName}</span>}
                    <div style={{ 
                      padding: isImage(msg.content) ? '5px' : '10px 14px', 
                      borderRadius: isAdmin ? '15px 15px 2px 15px' : '15px 15px 15px 2px', 
                      fontSize: '14px', 
                      backgroundColor: isAdmin ? '#000' : '#111', 
                      color: '#fff', 
                      border: `1px solid ${COLORS.accentRed}`, // 吹き出しを赤色に
                      boxShadow: isAdmin ? `0 0 10px ${COLORS.accentRed}44` : 'none'
                    }}>
                      {isImage(msg.content) ? <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '10px' }} alt="" /> : msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* フッター（切り替えスイッチ） */}
      <div style={{ 
        height: '70px', 
        backgroundColor: COLORS.bg, 
        borderTop: `2px solid ${COLORS.accentRed}`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-around'
      }}>
        <div onClick={() => {setViewMode('dm'); setSelectedUserId(null);}} style={{ textAlign: 'center', flex: 1, cursor: 'pointer', color: viewMode === 'dm' ? COLORS.accentRed : '#444' }}>
          <div style={{ fontSize: '18px' }}>👤</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>DM</div>
        </div>
        <div onClick={() => {setViewMode('comment'); setSelectedUserId(null);}} style={{ textAlign: 'center', flex: 1, cursor: 'pointer', color: viewMode === 'comment' ? COLORS.accentRed : '#444' }}>
          <div style={{ fontSize: '18px' }}>💬</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>ALL</div>
        </div>
      </div>
    </div>
  );
}
