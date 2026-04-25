"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase'; // パスを修正済み

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56"; // あなたのID

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [viewType, setViewType] = useState('comment'); // 'comment' or 'dm'
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    // リアルタイム更新の購読
    const channel = supabase
      .channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) console.error(error);
    else setMessages(data || []);
  };

  // スクロール制御
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>管理画面 (表示切替)</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setViewType('comment')}
          style={{
            padding: '10px 20px',
            backgroundColor: viewType === 'comment' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          コメント型
        </button>
        <button 
          onClick={() => setViewType('dm')}
          style={{
            padding: '10px 20px',
            backgroundColor: viewType === 'dm' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          DM型
        </button>
      </div>

      <div 
        ref={scrollRef}
        style={{ 
          border: '1px solid #ddd', 
          height: '500px', 
          overflowY: 'scroll', 
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: '#f9f9f9'
        }}
      >
        {messages.map((msg) => {
          const isAdmin = msg.user_id === ADMIN_ID;
          
          if (viewType === 'dm') {
            // DM型の表示
            return (
              <div key={msg.id} style={{ 
                display: 'flex', 
                justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                marginBottom: '10px' 
              }}>
                <div style={{
                  maxWidth: '70%',
                  padding: '10px',
                  borderRadius: '15px',
                  backgroundColor: isAdmin ? '#0070f3' : '#e9e9eb',
                  color: isAdmin ? 'white' : 'black',
                }}>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                    {msg.user_name || 'ゲスト'}
                  </div>
                  {msg.content}
                </div>
              </div>
            );
          } else {
            // コメント型の表示
            return (
              <div key={msg.id} style={{ 
                marginBottom: '15px', 
                padding: '10px', 
                borderBottom: '1px solid #eee',
                backgroundColor: isAdmin ? '#fff9db' : 'transparent' 
              }}>
                <strong style={{ color: isAdmin ? '#f08c00' : '#333' }}>
                  {msg.user_name || 'ゲスト'} {isAdmin && '(管理者)'}
                </strong>
                <p style={{ margin: '5px 0' }}>{msg.content}</p>
                <small style={{ color: '#999' }}>
                  {new Date(msg.created_at).toLocaleString('ja-JP')}
                </small>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
