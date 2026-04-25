"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); 
  const [viewMode, setViewMode] = useState('dm'); // 'dm' or 'comment'
  const scrollRef = useRef(null);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedUserId, viewMode, messages]);

  // 左側リスト用：ユーザーごとの最新情報を抽出
  const userList = messages.reduce((acc, msg) => {
    if (msg.user_id !== ADMIN_ID) {
      acc[msg.user_id] = {
        userId: msg.user_id,
        userName: msg.user_name || 'ゲスト',
        userIcon: msg.user_icon || 'https://www.gravatar.com/avatar/0?d=mp',
        lastMessage: msg.content,
        timestamp: msg.created_at
      };
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // --- スタイル定義 ---
  const containerStyle = { display: 'flex', height: '100vh', backgroundColor: '#f5f5f5', fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif' };
  const sidebarStyle = { width: '320px', backgroundColor: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' };
  const mainStyle = { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#e5ddd5', position: 'relative' }; // LINE風の背景色
  const headerStyle = { padding: '15px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const bubbleBase = { maxWidth: '80%', padding: '10px 14px', borderRadius: '18px', fontSize: '14px', marginBottom: '4px', position: 'relative', lineHeight: '1.4' };
  
  return (
    <div style={containerStyle}>
      
      {/* サイドバー（切り替えボタン ＋ ユーザーリスト） */}
      <div style={sidebarStyle}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 15px 0' }}>管理メニュー</h2>
          <div style={{ display: 'flex', gap: '5px', backgroundColor: '#eee', padding: '3px', borderRadius: '8px' }}>
            <button 
              onClick={() => setViewMode('dm')}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', backgroundColor: viewMode === 'dm' ? '#fff' : 'transparent', fontWeight: viewMode === 'dm' ? 'bold' : 'normal', boxShadow: viewMode === 'dm' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
            >DM形式</button>
            <button 
              onClick={() => setViewMode('comment')}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', backgroundColor: viewMode === 'comment' ? '#fff' : 'transparent', fontWeight: viewMode === 'comment' ? 'bold' : 'normal', boxShadow: viewMode === 'comment' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
            >コメント形式</button>
          </div>
        </div>

        {viewMode === 'dm' && (
          <div style={{ overflowY: 'auto' }}>
            {chatList.map((user) => (
              <div 
                key={user.userId} 
                onClick={() => setSelectedUserId(user.userId)}
                style={{ display: 'flex', padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f2f2f2', backgroundColor: selectedUserId === user.userId ? '#f0f0f0' : 'transparent' }}
              >
                <img src={user.userIcon} style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '12px', objectFit: 'cover', border: '1px solid #eee' }} alt="" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>{user.userName}</div>
                  <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMessage}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* メインチャット画面 */}
      <div style={mainStyle}>
        <div style={headerStyle}>
          <span>{viewMode === 'dm' ? (selectedUserId ? `${userList[selectedUserId]?.userName} とのチャット` : 'ユーザーを選択してください') : '全体コメント（新着順）'}</span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages
            .filter(msg => {
              if (viewMode === 'comment') return true;
              return msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId);
            })
            .map((msg) => {
              const isAdmin = msg.user_id === ADMIN_ID;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '15px', alignItems: 'flex-end' }}>
                  {!isAdmin && <img src={msg.user_icon || 'https://www.gravatar.com/avatar/0?d=mp'} style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '8px', border: '1px solid #ddd' }} alt="" />}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    {!isAdmin && viewMode === 'comment' && <span style={{ fontSize: '11px', color: '#555', marginLeft: '5px', marginBottom: '2px' }}>{msg.user_name}</span>}
                    
                    <div style={{
                      ...bubbleBase,
                      backgroundColor: isAdmin ? '#85e249' : '#fff', // 管理者は黄緑、ゲストは白
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      color: '#000',
                      borderRadius: isAdmin ? '18px 18px 2px 18px' : '18px 18px 18px 2px'
                    }}>
                      {msg.content}
                      {msg.image_url && <img src={msg.image_url} style={{ width: '100%', marginTop: '8px', borderRadius: '8px' }} alt="" />}
                    </div>
                    
                    <span style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
