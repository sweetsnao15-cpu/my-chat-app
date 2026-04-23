"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');

  // 1. まず、読み込むための「fetchMessages」という関数があるか確認
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('読み込みエラー:', error.message);
    } else {
      setMessages(data);
    }
  };

  // 2. 送信した後に、上で作った「fetchMessages」を呼ぶ
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!content) return;

    const { error } = await supabase
      .from('messages')
      .insert([{ content }]);

    if (error) {
      console.error('送信エラー:', error.message);
    } else {
      setContent('');
      fetchMessages(); // ここでエラーが出ていたのは、1番の関数が見当たらないためです
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ borderBottom: '2px solid #0070f3', paddingBottom: '10px' }}>チャットテスト画面</h1>
      
      {/* タイムライン部分 */}
      <div style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ddd', padding: '10px', marginBottom: '20px', background: '#f9f9f9' }}>
        {messages.map((msg) => (
          <div key={msg.id || Math.random()} style={{ marginBottom: '10px', padding: '8px', background: '#fff', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(msg.created_at).toLocaleTimeString()}</span>
            <p style={{ margin: '5px 0 0 0' }}>{msg.content}</p>
          </div>
        ))}
      </div>

      {/* 入力フォーム */}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="メッセージを入力..."
          style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          送信
        </button>
      </form>
    </div>
  );
}