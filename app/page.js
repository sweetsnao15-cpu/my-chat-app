"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [contextMenu, setContextMenu] = useState(null);
  
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 150) + "px";
    }
  }, [inputText]);

  const loadProfile = useCallback(async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  }, []);

  const fetchMessages = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data.filter(m => m.user_id === uid || (m.user_id === ADMIN_ID && m.receiver_id === uid)));
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
    const channel = supabase.channel(`room_${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (imgUrl = null) => {
    if ((!inputText.trim() && !imgUrl) || !user) return;
    const contentBody = imgUrl || inputText;
    setInputText('');
    await supabase.from('messages').insert([{ content: contentBody, user_id: user.id, is_image: !!imgUrl, receiver_id: ADMIN_ID }]);
  };

  const handleFileUpload = async (e) => {
    const f = e.target.files[0];
    if (!f || !user) return;
    const path = `chats/${user.id}/${Date.now()}`;
    await supabase.storage.from('chat-images').upload(path, f);
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
    handleSend(publicUrl);
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  const deleteMessage = async (id) => {
    await supabase.from('messages').delete().eq('id', id);
    setContextMenu(null);
  };

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
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff' }}>
      
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '8px', zIndex: 1000 }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }} style={{ padding: '10px 20px', cursor: 'pointer', borderBottom: '1px solid #333' }}>コピー</div>
          {contextMenu.message.user_id === user.id && (
            <div onClick={() => deleteMessage(contextMenu.message.id)} style={{ padding: '10px 20px', cursor: 'pointer', color: '#ff4d4d' }}>送信取り消し</div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '320px', background: '#1a1a1a', padding: '30px', borderRadius: '25px', border: '2px solid #800000', textAlign: 'center' }}>
            <label style={{ display: 'block', margin: '0 auto 20px', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid #D4AF37', overflow: 'hidden' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <InitialAvatar name={profile.username} size="100px" fontSize="3rem" />}
              <input type="file" accept="image/*" onChange={async (e)=>{
                const f=e.target.files[0]; if(!f)return;
                const p=`avatars/${user.id}`;
                await supabase.storage.from('chat-images').upload(p,f,{upsert:true});
                const {data:{publicUrl:u}}=supabase.storage.from('chat-images').getPublicUrl(p);
                setProfile({...profile, avatar_url:u});
              }} style={{ display: 'none' }} />
            </label>
            <input value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }} />
            <button onClick={async() => { await supabase.from('profiles').upsert({ id: user.id, username: profile.username, avatar_url: profile.avatar_url }); setIsModalOpen(false); }} style={{ width: '100%', padding: '12px', background: '#800000', color: '#fff', border: 'none', fontWeight: 'bold' }}>SAVE</button>
            <button onClick={() => setIsModalOpen(false)} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#D4AF37' }}>CLOSE</button>
          </div>
        </div>
      )}

      <header style={{ padding: '25px 25px 10px 45px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '95px', borderBottom: '2px solid #D4AF37' }}>
        <h1 style={{ fontSize: '2.4rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU</h1>
        <div onClick={() => setIsModalOpen(true)} style={{ cursor: 'pointer' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} /> : <InitialAvatar name={profile.username} />}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map((m, i) => {
          const isMe = m.user_id === user.id;
          const mDate = new Date(m.created_at).toLocaleDateString();
          const showDate = i === 0 || mDate !== new Date(messages[i-1].created_at).toLocaleDateString();
          return (
            <div key={m.id}>
              {showDate && <div style={{ textAlign: 'center', margin: '30px 0', fontSize: '0.85rem', color: '#999', fontFamily: 'serif', letterSpacing: '1px' }}>― {mDate} ―</div>}
              <div onContextMenu={(e) => handleContextMenu(e, m)} style={{ marginBottom: '22px', textAlign: isMe ? 'right' : 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ 
                    padding: m.is_image ? '5px' : '12px 18px', 
                    background: 'rgba(128, 0, 0, 0.85)', 
                    borderRadius: isMe ? '20px 20px 0 20px' : '20px 20px 20px 0', 
                    maxWidth: '85%', color: '#fff', 
                    border: isMe ? 'none' : '2px solid #D4AF37',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    wordBreak: 'break-all'
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '15px', display: 'block' }} /> : m.content}
                  </div>
                  <span style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '12px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37', paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' }}>
        <label style={{ background: '#000', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <CameraIcon /><input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Message..." style={{ flex: 1, padding: '10px 20px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.3)', outline: 'none', resize: 'none', height: '42px', background: '#800000', color: '#fff', fontSize: '16px' }} />
        <button onClick={() => handleSend()} style={{ background: '#000', color: '#D4AF37', width: '75px', height: '42px', borderRadius: '22px', border: 'none', fontSize: '16px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic' }}>SEND</button>
      </div>
    </div>
  );
}
