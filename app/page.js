"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// 管理者ID（固定）
const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// カメラアイコン
const CameraIcon = () => (
  <svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

// アバター（初期アイコン）
const InitialAvatar = ({ name, size = '48px', fontSize = '1.4rem' }) => {
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : "V";
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, border: '2px solid #D4AF37', flexShrink: 0
    }}>{initial}</div>
  );
};

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: '', avatar_url: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  
  const longPressTimer = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // プロフィール取得
  const loadProfile = useCallback(async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  }, []);

  // メッセージ取得
  const fetchMessages = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      setMessages(data.filter(m => m.user_id === uid || m.receiver_id === uid));
    }
  }, []);

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id); }
      setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
    });
    return () => authListener.subscription.unsubscribe();
  }, [loadProfile]);

  // リアルタイム購読
  useEffect(() => {
    if (!user) return;
    fetchMessages(user.id);
    const channel = supabase.channel(`room_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // メッセージ送信
  const handleSend = async (imgUrl = null) => {
    const text = inputText.trim();
    if (!text && !imgUrl) return;
    if (!user) return;
    if (!imgUrl) setInputText('');

    await supabase.from('messages').insert([{ 
      content: imgUrl || text, 
      user_id: user.id, 
      receiver_id: ADMIN_ID, 
      is_image: !!imgUrl,
      is_read: false 
    }]);
  };

  // 画像アップロード
  const handleFileUpload = async (e) => {
    const f = e.target.files[0];
    if (!f || !user) return;
    try {
      const path = `${user.id}/${Date.now()}`;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, f);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
      await handleSend(publicUrl);
    } catch (err) { alert("画像の送信に失敗しました"); }
  };

  // 長押しメニュー（青い選択防止含む）
  const handleTouchStart = (e, m) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches ? e.touches[0] : e;
      setContextMenu({ x: touch.clientX, y: touch.clientY, message: m });
    }, 600);
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  const deleteLocally = (id) => { setMessages(prev => prev.filter(m => m.id !== id)); setContextMenu(null); };
  const undoMessage = async (id) => { await supabase.from('messages').delete().eq('id', id); setContextMenu(null); };

  // 入力欄の高さ自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [inputText]);

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', background: '#0a0a0a', borderRadius: '30px', border: '2px solid #800000', textAlign: 'center' }}>
        <h2 style={{ color: '#800000', fontSize: '2.5rem', fontFamily: 'serif', fontStyle: 'italic', marginBottom: '30px' }}>for VAU</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '10px' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '15px', marginBottom: '25px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '10px' }} />
        <button onClick={async () => {
          const { error } = isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
          if (error) alert(error.message);
        }} style={{ width: '100%', padding: '15px', background: '#800000', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '10px' }}>{isSignUp ? "CREATE" : "LOG IN"}</button>
        <div onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#D4AF37', fontSize: '0.8rem', cursor: 'pointer', marginTop: '15px' }}>{isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up"}</div>
      </div>
    </div>
  );

  return (
    <div 
      onClick={() => setContextMenu(null)} 
      style={{ 
        width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
        background: '#000', color: '#fff', position: 'relative',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'
      }}
    >
      
      {/* 長押しメニュー */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 120, left: Math.min(contextMenu.x, window.innerWidth - 180), background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '15px', zIndex: 1000, width: '160px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }} style={{ padding: '15px', borderBottom: '1px solid #333', fontSize: '0.9rem' }}>コピー</div>
          <div onClick={() => deleteLocally(contextMenu.message.id)} style={{ padding: '15px', borderBottom: '1px solid #333', fontSize: '0.9rem' }}>削除</div>
          {contextMenu.message.user_id === user.id && (
            <div onClick={() => undoMessage(contextMenu.message.id)} style={{ padding: '15px', color: '#ff4d4d', fontSize: '0.9rem' }}>送信を取り消す</div>
          )}
        </div>
      )}

      {/* ヘッダー */}
      <header style={{ padding: '25px 25px 10px 45px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #D4AF37' }}>
        <h1 style={{ fontSize: '2.4rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU</h1>
        <div onClick={() => setIsModalOpen(true)} style={{ cursor: 'pointer' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} /> : <InitialAvatar name={profile.username} />}
        </div>
      </header>

      {/* メッセージ表示エリア */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map((m) => {
          const isMe = m.user_id === user.id;
          return (
            <div key={m.id} onTouchStart={(e) => handleTouchStart(e, m)} onTouchEnd={handleTouchEnd} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  padding: m.is_image ? '5px' : '12px 18px', background: 'rgba(128, 0, 0, 0.85)', 
                  borderRadius: isMe ? '20px 20px 0 20px' : '20px 20px 20px 0', 
                  maxWidth: '85%', color: '#fff', border: isMe ? 'none' : '2px solid #D4AF37',
                  whiteSpace: 'pre-wrap', width: 'fit-content', textAlign: 'left'
                }}>
                  {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '15px', display: 'block', pointerEvents: 'none' }} /> : m.content}
                </div>
                {/* 既読表示 */}
                <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {isMe && m.is_read && <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>既読</span>}
                  {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      {/* 入力エリア */}
      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '10px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37', paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' }}>
        <label style={{ background: '#000', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <CameraIcon /><input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <textarea 
          ref={textareaRef}
          value={inputText} 
          onChange={e => setInputText(e.target.value)} 
          placeholder="Message..." 
          style={{ 
            flex: 1, padding: '10px 15px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.3)', 
            background: '#800000', color: '#fff', fontSize: '16px', outline: 'none', resize: 'none', height: '42px',
            userSelect: 'text', WebkitUserSelect: 'text'
          }} 
        />
        <button 
          onClick={() => handleSend()} 
          style={{ 
            background: '#000', color: '#D4AF37', width: '70px', height: '42px', borderRadius: '22px', 
            fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.1rem', cursor: 'pointer', border: 'none' 
          }}
        >SEND</button>
      </div>
    </div>
  );
}
