"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// ... (CameraIcon, InitialAvatar は変更なし)

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

  // プロフィール読み込み
  const loadProfile = useCallback(async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  }, []);

  // メッセージ取得
  const fetchMessages = useCallback(async (uid) => {
    if (!uid) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`user_id.eq.${uid},and(user_id.eq.${ADMIN_ID},receiver_id.eq.${uid})`)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
  }, []);

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

  useEffect(() => {
    if (!user) return;
    fetchMessages(user.id);
    const channel = supabase.channel(`room_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  useEffect(() => { 
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" }); 
    }
  }, [messages]);

  // 【重要】メッセージ送信関数
  const handleSend = async (imgUrl = null) => {
    // 入力がない、またはユーザーがいない場合は何もしない
    if ((!inputText.trim() && !imgUrl) || !user) return;

    const contentBody = imgUrl || inputText;
    
    // 送信前にリセット（連打防止）
    if (!imgUrl) setInputText('');

    try {
      const { error } = await supabase.from('messages').insert([{ 
        content: contentBody, 
        user_id: user.id, 
        receiver_id: ADMIN_ID, 
        is_image: !!imgUrl, 
        is_read: false 
      }]);

      if (error) {
        console.error("Send Error:", error);
        alert("送信に失敗しました");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e) => {
    const f = e.target.files[0];
    if (!f || !user) return;
    const path = `chats/${user.id}/${Date.now()}`;
    await supabase.storage.from('chat-images').upload(path, f);
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
    handleSend(publicUrl);
  };

  // --- UI制御 ---
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [inputText]);

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', background: '#0a0a0a', color: '#fff', borderRadius: '30px', border: '2px solid #800000', textAlign: 'center' }}>
        <h2 style={{ color: '#800000', fontSize: '2.5rem', fontFamily: 'serif', fontStyle: 'italic', marginBottom: '30px' }}>for VAU</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '10px' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '15px', marginBottom: '25px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '10px' }} />
        <button onClick={async () => {
          const { error } = isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
          if (error) alert(error.message);
        }} style={{ width: '100%', padding: '15px', background: '#800000', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '10px' }}>{isSignUp ? "CREATE" : "LOG IN"}</button>
      </div>
    </div>
  );

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'relative' }}>
      
      {/* (省略: contextMenu, isModalOpen の UI ロジックは維持) */}

      <header style={{ padding: '25px 25px 10px 45px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '95px', borderBottom: '2px solid #D4AF37', flexShrink: 0 }}>
        <h1 style={{ fontSize: '2.4rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU</h1>
        <div onClick={() => setIsModalOpen(true)} style={{ cursor: 'pointer' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} alt="" /> : <InitialAvatar name={profile.username} />}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map((m, i) => {
          const isMe = m.user_id === user.id;
          const mDate = new Date(m.created_at).toLocaleDateString();
          const showDate = i === 0 || mDate !== new Date(messages[i-1].created_at).toLocaleDateString();
          return (
            <div key={m.id}>
              {showDate && <div style={{ textAlign: 'center', margin: '30px 0', fontSize: '0.85rem', color: '#999', fontFamily: 'serif' }}>― {mDate} ―</div>}
              <div style={{ marginBottom: '22px', textAlign: isMe ? 'right' : 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ 
                    padding: m.is_image ? '5px' : '12px 18px', 
                    background: 'rgba(128, 0, 0, 0.85)', 
                    borderRadius: isMe ? '20px 20px 0 20px' : '20px 20px 20px 0', 
                    maxWidth: '85%', color: '#fff', 
                    border: isMe ? 'none' : '2px solid #D4AF37',
                    whiteSpace: 'pre-wrap', display: 'block', width: 'fit-content', textAlign: 'left'
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '15px', display: 'block' }} alt="" /> : m.content}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '5px' }}>
                    {isMe && m.is_read && <span style={{ fontSize: '0.65rem', color: '#D4AF37', fontWeight: 'bold' }}>既読</span>}
                    <span style={{ fontSize: '0.6rem', color: '#666' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '12px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37', paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' }}>
        <label style={{ background: '#000', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CameraIcon /><input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <textarea 
          ref={textareaRef} 
          value={inputText} 
          onChange={e => setInputText(e.target.value)} 
          placeholder="Message..." 
          style={{ flex: 1, padding: '10px 20px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.3)', outline: 'none', resize: 'none', height: '42px', background: '#800000', color: '#fff', fontSize: '16px' }} 
        />
        <button onClick={() => handleSend()} style={{ background: '#000', color: '#D4AF37', width: '75px', height: '42px', borderRadius: '22px', fontWeight: 'bold', fontFamily: 'serif' }}>SEND</button>
      </div>
    </div>
  );
}
