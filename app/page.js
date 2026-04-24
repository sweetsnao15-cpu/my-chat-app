"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [user, setUser] = useState(null); // ログインユーザー情報を保存
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- 1. ログイン状態の監視 ---
  useEffect(() => {
    // 現在のログイン状況を確認
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) fetchMessages();
    };
    getSession();

    // ログイン状態が変化したとき（ログアウト等）に自動で更新
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // --- 2. メッセージ読み込み（自分の投稿だけ取得する場合もここで調整可能） ---
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) console.error('読み込みエラー:', error.message);
    else setMessages(data);
  };

  // --- 3. ログイン・新規登録の処理 ---
  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert("登録エラー: " + error.message);
    else alert("登録を確認しました！");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("ログインエラー: " + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMessages([]);
  };

  // --- 4. メッセージ送信（ユーザーIDを紐付け） ---
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!content || !user) return;

    // messagesテーブルに user_id カラムがある場合は自動で入ります
    const { error } = await supabase
      .from('messages')
      .insert([{ content, user_id: user.id }]);

    if (error) console.error('送信エラー:', error.message);
    else {
      setContent('');
      fetchMessages();
    }
  };

  // --- 5. 画面の切り替え ---
  if (!user) {
    // ログイン前の画面
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '10px' }}>
        <h2>ログイン / 新規登録</h2>
        <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
        <input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '10px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '5px', marginBottom: '10px', cursor: 'pointer' }}>ログイン</button>
        <button onClick={handleSignUp} style={{ width: '100%', padding: '10px', background: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>アカウント作成</button>
      </div>
    );
  }

  // ログイン後の画面
  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>チャット画面</h1>
        <button onClick={handleLogout} style={{ padding: '5px 10px', background: '#ccc', border: 'none', borderRadius: '5px' }}>ログアウト</button>
      </div>
      <p style={{ fontSize: '0.9rem' }}>ログイン中: {user.email}</p>
      
      <div style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ddd', padding: '10px', marginBottom: '20px', background: '#f9f9f9' }}>
        {messages.map((msg) => (
          <div key={msg.id || Math.random()} style={{ marginBottom: '10px', padding: '8px', background: '#fff', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(msg.created_at).toLocaleTimeString()}</span>
            <p style={{ margin: '5px 0 0 0' }}>{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="メッセージを入力..."
          style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '5px' }}>送信</button>
      </form>
    </div>
  );
}