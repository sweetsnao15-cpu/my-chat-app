"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const CameraIcon = () => (
  <svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const InitialAvatar = ({ name, size = '48px', fontSize = '1.4rem' }) => {
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : "V";
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, border: '2px solid #D4AF37'
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
  
  const scrollRef = useRef(null);

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
        await loadMessages(session.user.id);
      }
      setLoading(false);
    };
    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
        loadMessages(session.user.id);
      } else {
        setUser(null);
      }
    });

    const channel = supabase.channel('realtime-chat').on('postgres_changes', { 
      event: '*', schema: 'public', table: 'messages' 
    }, () => {
      if (user) loadMessages(user.id);
    }).subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  };

  const loadMessages = async (userId) => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      // 自分の送信、または管理者から自分への送信のみフィルタ
      const filtered = data.filter(m => m.user_id === userId || (m.user_id === ADMIN_ID && m.receiver_id === userId));
      setMessages(filtered);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleSend = async (imageUrl = null) => {
    if ((!inputText.trim() && !imageUrl) || !user) return;
    const content = imageUrl || inputText;
    setInputText('');

    // 【重要】テーブル定義に存在するカラムのみを指定
    const { error } = await supabase.from('messages').insert([{
      content,
      user_id: user.id,
      is_image: !!imageUrl,
      receiver_id: ADMIN_ID
    }]);

    if (error) {
      console.error(error);
      alert("送信に失敗しました");
      if (!imageUrl) setInputText(content);
    } else {
      loadMessages(user.id);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    const filePath = `chats/${user.id}/${Math.random()}`;
    const { error } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (error) return alert("アップロード失敗");
    
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
    handleSend(publicUrl);
  };

  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      username: profile.username,
      avatar_url: profile.avatar_url
    });
    if (error) alert("保存失敗");
    else setIsModalOpen(false);
  };

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', background: '#0a0a0a', color: '#fff', borderRadius: '20px', border: '2px solid #800000', textAlign: 'center' }}>
      <h2 style={{ color: '#800000' }}>{isSignUp ? "SIGN UP" : "for VAU"}</h2>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', margin: '10px 0', background: '#1a1a1a', color: '#fff', border: '1px solid #333' }} />
      <input type="password" placeholder="Pw" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', background: '#1a1a1a', color: '#fff', border: '1px solid #333' }} />
      <button onClick={async () => {
        const { error } = isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
      }} style={{ width: '100%', padding: '12px', background: '#800000', color: '#fff', fontWeight: 'bold', border: 'none' }}>
        {isSignUp ? "CREATE" : "LOG IN"}
      </button>
      <p onClick={() => setIsSignUp(!isSignUp)} style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666', cursor: 'pointer' }}>
        {isSignUp ? "Back to Login" : "Need Account?"}
      </p>
    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'relative' }}>
      
      {isModalOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '300px', background: '#1a1a1a', padding: '30px', borderRadius: '25px', border: '2px solid #800000', textAlign: 'center' }}>
            <label style={{ display: 'block', margin: '0 auto 20px', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid #D4AF37', overflow: 'hidden', background: '#333' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={profile.username} size="100px" fontSize="3rem" />}
              <input type="file" accept="image/*" onChange={async (e)=>{
                const f=e.target.files[0]; if(!f)return;
                const p=`avatars/${user.id}`;
                await supabase.storage.from('chat-images').upload(p,f,{upsert:true});
                const {data:{publicUrl:u}}=supabase.storage.from('chat-images').getPublicUrl(p);
                setProfile({...profile, avatar_url:u});
              }} style={{ display: 'none' }} />
            </label>
            <input value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} placeholder="Name" style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }} />
            <button onClick={saveProfile} style={{ width: '100%', padding: '10px', background: '#800000', color: '#fff', border: 'none', fontWeight: 'bold' }}>SAVE</button>
            <button onClick={() => setIsModalOpen(false)} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#666' }}>CLOSE</button>
          </div>
        </div>
      )}

      <header style={{ padding: '10px 25px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '80px', borderBottom: '2px solid #D4AF37' }}>
        <h1 style={{ fontSize: '2.2rem', fontFamily: '"Times New Roman", serif', fontStyle: 'italic' }}>for VAU</h1>
        <div onClick={() => setIsModalOpen(true)} style={{ cursor: 'pointer' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={profile.username} />}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map(m => {
          const isMe = m.user_id === user.id;
          return (
            <div key={m.id} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  padding: m.is_image ? '5px' : '10px 16px', 
                  background: isMe ? '#800000' : '#333', 
                  borderRadius: isMe ? '18px 18px 0 18px' : '18px 18px 18px 0',
                  maxWidth: '85%'
                }}>
                  {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px', display: 'block' }} alt=""/> : m.content}
                </div>
                <span style={{ fontSize: '0.6rem', color: '#ccc', marginTop: '4px' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '10px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37' }}>
        <label style={{ background: '#000', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <CameraIcon />
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <textarea 
          value={inputText} 
          onChange={e => setInputText(e.target.value)} 
          placeholder="Message..." 
          style={{ flex: 1, padding: '8px 18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)', outline: 'none', resize: 'none', height: '38px', background: '#800000', color: '#fff' }} 
        />
        <button onClick={() => handleSend()} style={{ background: '#000', color: '#D4AF37', width: '60px', height: '38px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: 'bold' }}>SEND</button>
      </div>
    </div>
  );
}
