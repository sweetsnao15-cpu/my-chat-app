"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// カメラアイコンコンポーネント
const CameraIcon = () => (
  <svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

// デフォルトアイコンコンポーネント
const InitialAvatar = ({ name, size = '48px', fontSize = '1.2rem' }) => {
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
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const scrollRef = useRef(null);

  // --- 1. 初期化 & プロフィール取得 ---
  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
    });
    return () => authListener.subscription.unsubscribe();
  }, [loadProfile]);

  // --- 2. メッセージ取得 & リアルタイム購読 ---
  const fetchMessages = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      const filtered = data.filter(m => m.user_id === uid || (m.user_id === ADMIN_ID && m.receiver_id === uid));
      setMessages(filtered);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchMessages(user.id);

    const channel = supabase.channel(`room_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- 3. 送信処理（テキスト・画像） ---
  const handleSend = async (imageUrl = null) => {
    if ((!inputText.trim() && !imageUrl) || !user) return;
    const content = imageUrl || inputText;
    setInputText('');

    const { error } = await supabase.from('messages').insert([{
      content,
      user_id: user.id,
      is_image: !!imageUrl,
      receiver_id: ADMIN_ID
    }]);

    if (error) {
      alert("送信失敗");
      if (!imageUrl) setInputText(content);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    const path = `chats/${user.id}/${Date.now()}`;
    const { error } = await supabase.storage.from('chat-images').upload(path, file);
    if (error) return alert("アップロード失敗");
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
    handleSend(publicUrl);
  };

  // --- 4. プロフィール更新 & ログアウト ---
  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      username: profile.username,
      avatar_url: profile.avatar_url
    });
    if (!error) setIsModalOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;
  if (!user) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>ログインしてください</div>;

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '100%', // スマホ横幅対応
      margin: '0 auto', 
      height: '100dvh', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#000', 
      color: '#fff', 
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* 設定モーダル */}
      {isModalOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '320px', background: '#1a1a1a', padding: '30px', borderRadius: '25px', border: '2px solid #800000', textAlign: 'center' }}>
            <label style={{ display: 'block', margin: '0 auto 20px', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid #D4AF37', overflow: 'hidden', cursor: 'pointer' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={profile.username} size="100px" fontSize="3rem" />}
              <input type="file" accept="image/*" onChange={async (e)=>{
                const f=e.target.files[0]; if(!f)return;
                const p=`avatars/${user.id}`;
                await supabase.storage.from('chat-images').upload(p,f,{upsert:true});
                const {data:{publicUrl:u}}=supabase.storage.from('chat-images').getPublicUrl(p);
                setProfile({...profile, avatar_url:u});
              }} style={{ display: 'none' }} />
            </label>
            <input value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} placeholder="Name" style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #333', marginBottom: '20px', textAlign: 'center', borderRadius: '8px' }} />
            <button onClick={saveProfile} style={{ width: '100%', padding: '12px', background: '#800000', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px' }}>SAVE</button>
            <button onClick={handleLogout} style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'transparent', color: '#666', border: '1px solid #333', cursor: 'pointer', borderRadius: '8px' }}>LOGOUT</button>
            <button onClick={() => setIsModalOpen(false)} style={{ marginTop: '15px', background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer' }}>CLOSE</button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header style={{ padding: '10px 20px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '70px', borderBottom: '2px solid #D4AF37', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', letterSpacing: '1px' }}>for VAU</h1>
        <div onClick={() => setIsModalOpen(true)} style={{ cursor: 'pointer' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '45px', height: '45px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={profile.username} size="45px" />}
        </div>
      </header>

      {/* チャットエリア */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column' }}>
        {messages.map(m => {
          const isMe = m.user_id === user.id;
          return (
            <div key={m.id} style={{ marginBottom: '15px', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  padding: m.is_image ? '5px' : '10px 14px', 
                  background: isMe ? '#800000' : '#222', 
                  borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  color: '#fff',
                  border: isMe ? 'none' : '1px solid #333',
                  fontSize: '15px'
                }}>
                  {m.is_image ? (
                    <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px', display: 'block' }} alt="sent" />
                  ) : m.content}
                </div>
                <span style={{ fontSize: '0.65rem', color: '#888', marginTop: '4px' }}>
                  {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      {/* 入力エリア */}
      <div style={{ padding: '12px 15px', background: '#800000', display: 'flex', gap: '10px', alignItems: 'center', borderTop: '2px solid #D4AF37', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <label style={{ background: '#000', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <CameraIcon />
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <textarea 
          value={inputText} 
          onChange={e => setInputText(e.target.value)} 
          placeholder="Message..." 
          style={{ flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.2)', outline: 'none', resize: 'none', height: '40px', background: '#800000', color: '#fff', fontSize: '15px', lineHeight: '20px' }} 
        />
        <button onClick={() => handleSend()} style={{ background: '#000', color: '#D4AF37', padding: '0 15px', height: '40px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>SEND</button>
      </div>
    </div>
  );
}
