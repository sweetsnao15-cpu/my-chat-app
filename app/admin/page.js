"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); // 選択中のユーザー
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
  }, [selectedUserId, messages]);

  // ユーザーごとに最新メッセージを抽出（左側リスト用）
  const userList = messages.reduce((acc, msg) => {
    if (msg.user_id !== ADMIN_ID) {
      acc[msg.user_id] = {
        userId: msg.user_id,
        userName: msg.user_name || 'ゲスト',
        userIcon: msg.user_icon || 'https://via.placeholder.com/40', // デフォルトアイコン
        lastMessage: msg.content,
        timestamp: msg.created_at
      };
    }
    return acc;
  }, {});

  const chatList = Object.values(userList).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // 選択されたユーザーとの全履歴を抽出
  const selectedChatHistory = messages.filter(
    (msg) => msg.user_id === selectedUserId || (msg.user_id === ADMIN_ID && msg.recipient_id === selectedUserId)
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'sans-serif' }}>
      
      {/* 左側：ユーザーリスト */}
      <div style={{ width: '350px', backgroundColor: 'white', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '18px' }}>メッセージ</div>
        {chatList.map((user) => (
          <div 
            key={user.userId} 
            onClick={() => setSelectedUserId(user.userId)}
            style={{
              display: 'flex', padding: '15px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9',
              backgroundColor: selectedUserId === user.userId ? '#e7f3ff' : 'transparent'
            }}
          >
            <img src={user.userIcon} style={{ width: '50px', height: '50px', borderRadius: '50%', marginRight: '15px', objectFit: 'cover' }} alt="" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{user.userName}</div>
              <div style={{ fontSize: '12px', color: '#65676b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.lastMessage}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 右側：チャット詳細 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUserId ? (
          <>
            <div style={{ padding: '15px', backgroundColor: 'white', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>
              {userList[selectedUserId]?.userName} との履歴
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {selectedChatHistory.map((msg) => {
                const isAdmin = msg.user_id === ADMIN_ID;
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: '15px' }}>
                    {!isAdmin && <img src={msg.user_icon || userList[selectedUserId]?.userIcon} style={{ width: '30px', height: '30px', borderRadius: '50%', marginRight: '10px' }} alt="" />}
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        padding: '10px 15px', borderRadius: '18px', fontSize: '14px',
                        backgroundColor: isAdmin ? '#0084ff' : '#e4e6eb', color: isAdmin ? 'white' : 'black'
                      }}>
                        {msg.content}
                        {msg.image_url && <img src={msg.image_url} style={{ width: '100%', marginTop: '10px', borderRadius: '10px' }} alt="sent content" />}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '5px', textAlign: isAdmin ? 'right' : 'left' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            左側のリストからユーザーを選択してください
          </div>
        )}
      </div>
    </div>
  );
}
