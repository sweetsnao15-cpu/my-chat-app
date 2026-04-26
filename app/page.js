"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  // 1. ログイン状態の確認（初回のみ）
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // 2. メッセージ取得関数（useCallbackでループ防止）
  const fetchMessages = useCallback(async (currentUserId) => {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Fetch error:", error.message);
      return;
    }

    if (data) {
      // 自分宛または自分からのメッセージのみ抽出
      const filtered = data.filter(m => 
        m.user_id === currentUserId || 
        (m.user_id === ADMIN_ID && m.receiver_id === currentUserId)
      );
      setMessages(filtered);
    }
  }, []);

  // 3. リアルタイム購読（userが確定してから一度だけ実行）
  useEffect(() => {
    if (!user) return;

    fetchMessages(user.id);

    const channel = supabase
      .channel(`chat_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        fetchMessages(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMessages]);

  // 4. 自動スクロール
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5. 送信処理
  const handleSend = async () => {
    if (!inputText.trim() || !user) return;

    const contentToSend = inputText;
    setInputText(''); // 先にクリアして連打防止

    const { error } = await supabase.from('messages').insert([{
      content: contentToSend,
      user_id: user.id,
      is_image: false,
      receiver_id: ADMIN_ID
    }]);

    if (error) {
      console.error("Send error:", error.message);
      alert("送信に失敗しました");
      setInputText(contentToSend); // 失敗したら戻す
    }
  };

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ color: '#fff', textAlign: 'center', marginTop: '100px' }}>
      ログインが必要です。
    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff' }}>
      <header style={{ padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontStyle: 'italic' }}>for VAU</h1>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '15px', textAlign: m.user_id === user.id ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', padding: '10px 16px', 
              background: m.user_id === user.id ? '#800000' : '#333', 
              borderRadius: '15px', maxWidth: '80%' 
            }}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '20px', background: '#800000', display: 'flex', gap: '10px' }}>
        <input 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Message..." 
          style={{ flex: 1, padding: '10px 15px', borderRadius: '20px', border: 'none', outline: 'none', background: '#fff', color: '#000' }} 
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
