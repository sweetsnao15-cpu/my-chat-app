"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // メッセージ読み込み
  useEffect(() => {
    if (!user) return;
    
    const loadMessages = async () => {
      const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      if (error) console.error("データ取得エラー:", error.message);
      if (data) {
        setMessages(data.filter(m => m.user_id === user.id || (m.user_id === ADMIN_ID && m.receiver_id === user.id)));
      }
    };

    loadMessages();
    const ch = supabase.channel('chat').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadMessages).subscribe();
    return () => supabase.removeChannel(ch);
  }, [user]);

  // 【重要】送信処理（デバッグログ付き）
  const handleSend = async () => {
    if (!inputText.trim() || !user) {
      console.warn("送信不可: テキストが空、または未ログインです");
      return;
    }

    console.log("送信開始...");
    const sendData = {
      content: inputText,
      user_id: user.id,
      is_image: false,
      receiver_id: ADMIN_ID
    };
    console.log("送信データ内容:", sendData);

    const { data, error } = await supabase.from('messages').insert([sendData]).select();

    if (error) {
      console.error("【送信エラー詳細】:", error);
      alert(`送信失敗: ${error.message}\nエラーコード: ${error.code}`);
    } else {
      console.log("送信成功:", data);
      setInputText('');
    }
  };

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  // 未ログイン時の簡易表示
  if (!user) return (
    <div style={{ color: '#fff', padding: '50px', textAlign: 'center', background: '#000', height: '100dvh' }}>
      <p>ログインが必要です</p>
      <button onClick={() => window.location.reload()} style={{ color: '#D4AF37' }}>再読み込み</button>
    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff' }}>
      <header style={{ padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontStyle: 'italic' }}>for VAU</h1>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: '15px', textAlign: m.user_id === user.id ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', padding: '10px 16px', background: m.user_id === user.id ? '#800000' : '#333', 
              borderRadius: '15px', maxWidth: '80%' 
            }}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '20px', background: '#800000', display: 'flex', gap: '10px', borderTop: '2px solid #D4AF37' }}>
        <input 
          value={inputText} 
          onChange={e => setInputText(e.target.value)} 
          placeholder="Message..." 
          style={{ flex: 1, padding: '10px', borderRadius: '20px', border: 'none', outline: 'none' }} 
        />
        <button 
          onClick={handleSend} 
          style={{ background: '#000', color: '#D4AF37', padding: '10px 20px', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
