"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56"; // あなたのID

export default function AdminPage() {
  const [messages, setMessages] = useState([]);
  const [viewType, setViewType] = useState('comment'); 
  const scrollRef = useRef(null);

  // メッセージ取得関数
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error("データ取得エラー:", error);
    } else {
      setMessages(data || []);
    }
  };

  useEffect(() => {
    fetchMessages();

    // リアルタイム受信の設定（修正版）
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload) => {
          console.log('新着メッセージを受信:', payload.new);
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ 
      padding: '10px', 
      maxWidth: '450px', // ゲスト側のスマホサイズに合わせる
      margin: '0 auto', 
      fontFamily: 'sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '18px', textAlign: 'center', margin: '10px 0' }}>管理画面</h1>
      
      <div style={{ marginBottom: '10px', display: 'flex', gap: '5px', justifyContent: 'center' }}>
        <button 
          onClick={() => setViewType('comment')}
          style={{
            flex: 1,
            padding: '8px',
            fontSize: '12px',
            backgroundColor: viewType === 'comment' ? '#0070f3' : '#eee',
            color: viewType === 'comment' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          コメント形式
        </button>
        <button 
          onClick={() => setViewType('dm')}
          style={{
            flex: 1,
            padding: '8px',
            fontSize: '12px',
            backgroundColor: viewType === 'dm' ? '#0070f3' : '#eee',
            color: viewType === 'dm' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          DM形式
        </button>
      </div>

      <div 
        ref={scrollRef}
        style={{ 
          flex: 1,
          border: '1px solid #ddd', 
          overflowY: 'scroll', 
          padding: '15px',
          borderRadius: '10px',
          backgroundColor: '#f9f9f9',
          marginBottom: '20px'
        }}
      >
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', fontSize: '14px' }}>メッセージがありません</p>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.user_id === ADMIN_ID;
            
            if (viewType === 'dm') {
              return (
                <div key={msg.id} style={{ 
                  display: 'flex', 
                  justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                  marginBottom: '8px' 
                }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: '18px',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    backgroundColor: isAdmin ? '#0070f3' : '#e9e9eb',
                    color: isAdmin ? 'white' : 'black',
                  }}>
                    {!isAdmin && <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '2px' }}>{msg.user_name || 'ゲスト'}</div>}
                    {msg.content}
                  </div>
                </div>
              );
            } else {
              return (
                <div key={msg.id} style={{ 
                  marginBottom: '10px', 
                  padding: '8px', 
                  fontSize: '14px',
                  borderBottom: '1px solid #eee',
                  backgroundColor: isAdmin ? '#fff9db' : 'transparent' 
                }}>
                  <strong style={{ fontSize: '12px', color: isAdmin ? '#f08c00' : '#555' }}>
                    {msg.user_name || 'ゲスト'} {isAdmin && '(管理者)'}
                  </strong>
                  <div style={{ margin: '3px 0' }}>{msg.content}</div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}
