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

const InitialAvatar = ({ name, size = '48px', fontSize = '1.4rem', pointerEvents = 'auto' }) => {
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : "V";
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, border: '2px solid #D4AF37', flexShrink: 0,
      pointerEvents: pointerEvents, WebkitTouchCallout: 'none'
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
  
  const textareaRef = useRef(null);

  const loadProfile = useCallback(async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  }, []);

  const fetchMessages = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await supabase.from('messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setMessages(data.filter(m => m.user_id === uid || m.receiver_id === uid));
    }
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
    // Realtime購読により、ホスト側の既読(update)を検知
    const channel = supabase.channel(`room_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  const handleSend = async (imgUrl = null) => {
    const text = inputText.trim();
    if (!text && !imgUrl) return;
    if (!user) return;
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = "42px";
    await supabase.from('messages').insert([{ 
      content: imgUrl || text, 
      user_id: user.id, 
      receiver_id: ADMIN_ID, 
      is_image: !!imgUrl,
      is_read: false 
    }]);
  };

  const handleFileUpload = async (e) => {
    const f = e.target.files[0];
    if (!f || !user) return;
    try {
      const path = `${user.id}/${Date.now()}`;
      await supabase.storage.from('chat-images').upload(path, f);
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
      await handleSend(publicUrl);
    } catch (err) { alert("送信エラー"); }
  };

  const openMenu = (e, m) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, message: m });
  };

  const deleteMessage = async () => {
    if (!contextMenu) return;
    await supabase.from('messages').delete().eq('id', contextMenu.message.id);
    setContextMenu(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', background: '#0a0a0a', borderRadius: '30px', border: '2px solid #800000', textAlign: 'center' }}>
        <h2 style={{ color: '#800000', fontSize: '2.5rem', fontFamily: 'serif', fontStyle: 'italic', marginBottom: '30px' }}>for VAU</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '10px', outline: 'none' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '15px', marginBottom: '25px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '10px', outline: 'none' }} />
        <button onClick={async () => {
          const { error } = isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
          if (error) alert(error.message);
        }} style={{ width: '100%', padding: '15px', background: '#800000', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>{isSignUp ? "CREATE" : "LOG IN"}</button>
        <div onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#D4AF37', fontSize: '0.8rem', cursor: 'pointer', marginTop: '15px' }}>{isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up"}</div>
      </div>
    </div>
  );

  return (
    <div 
      onClick={() => setContextMenu(null)}
      style={{ 
        width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'relative', overflow: 'hidden',
        userSelect: 'none', WebkitUserSelect: 'none' 
      }}
    >
      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #800000; borderRadius: 10px; }
        ::-webkit-scrollbar-track { background: #000; }
        * { -webkit-tap-highlight-color: transparent; }
        img { -webkit-touch-callout: none; pointer-events: none; }
      `}</style>
      
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 50, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '12px', zIndex: 1000, overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }} style={{ padding: '12px 20px', fontSize: '0.9rem', borderBottom: '1px solid #333', cursor: 'pointer' }}>コピー</div>
          {contextMenu.message.user_id === user.id && <div onClick={deleteMessage} style={{ padding: '12px 20px', fontSize: '0.9rem', color: '#ff4d4d', cursor: 'pointer' }}>送信取消</div>}
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80%', maxWidth: '350px', background: '#1a1a1a', padding: '30px', borderRadius: '25px', border: '2px solid #800000', textAlign: 'center' }}>
            <label style={{ display: 'block', width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '50%', border: '2px solid #D4AF37', overflow: 'hidden', cursor: 'pointer' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <InitialAvatar name={profile.username} size="80px" fontSize="2rem" pointerEvents="none" />}
              <input type="file" accept="image/*" onChange={async (e)=>{
                const f=e.target.files[0]; if(!f)return;
                const p=`avatars/${user.id}`;
                await supabase.storage.from('chat-images').upload(p,f,{upsert:true});
                const {data:{publicUrl:u}}=supabase.storage.from('chat-images').getPublicUrl(p);
                setProfile({...profile, avatar_url:u});
              }} style={{ display: 'none' }} />
            </label>
            <input value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} placeholder="Username" style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #333', marginBottom: '20px', borderRadius: '8px', textAlign: 'center' }} />
            <button onClick={async() => { await supabase.from('profiles').upsert({ id: user.id, username: profile.username, avatar_url: profile.avatar_url }); setIsModalOpen(false); }} style={{ width: '100%', padding: '12px', background: '#800000', color: '#fff', border: 'none', marginBottom: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>SAVE</button>
            <button onClick={async () => { await supabase.auth.signOut(); setIsModalOpen(false); }} style={{ width: '100%', padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>LOG OUT</button>
            <div onClick={() => setIsModalOpen(false)} style={{ color: '#666', fontSize: '0.8rem', marginTop: '15px', cursor: 'pointer' }}>CLOSE</div>
          </div>
        </div>
      )}

      <header style={{ padding: '25px 25px 10px 45px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #D4AF37', zIndex: 10 }}>
        <h1 style={{ fontSize: '2.4rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU</h1>
        <div onClick={() => setIsModalOpen(true)} style={{ cursor: 'pointer' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} /> : <InitialAvatar name={profile.username} />}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column-reverse' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {messages.slice().reverse().map((m, i, arr) => {
            const isMe = m.user_id === user.id;
            const showDate = i === 0 || formatDate(arr[i-1].created_at) !== formatDate(m.created_at);
            
            return (
              <div key={m.id}>
                {showDate && (
                  <div style={{ textAlign: 'center', margin: '20px 0', fontSize: '0.7rem', color: '#666', fontFamily: 'serif' }}>
                    ― {formatDate(m.created_at)} ―
                  </div>
                )}
                <div 
                  onContextMenu={(e) => openMenu(e, m)} 
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => openMenu(e, m), 600);
                    e.target.ontouchend = () => clearTimeout(timer);
                  }}
                  style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ 
                      padding: m.is_image ? '5px' : '12px 18px', 
                      background: isMe ? 'rgba(128, 0, 0, 0.85)' : '#1a1a1a', 
                      borderRadius: isMe ? '20px 20px 0 20px' : '20px 20px 20px 0', 
                      maxWidth: '80%', color: '#fff', 
                      border: isMe ? 'none' : '2px solid #D4AF37', 
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left'
                    }}>
                      {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '15px', display: 'block' }} /> : m.content}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {/* 【修正】自分が送ったメッセージが既読なら表示 */}
                      {isMe && m.is_read && <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>既読</span>}
                      {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '10px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37', paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' }}>
        <label style={{ background: '#000', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <CameraIcon /><input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <textarea 
          ref={textareaRef}
          value={inputText} 
          onChange={e => {
            setInputText(e.target.value);
            e.target.style.height = "42px";
            e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
          }} 
          placeholder="Message..." 
          style={{ flex: 1, padding: '10px 15px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.2)', background: '#800000', color: '#fff', fontSize: '16px', outline: 'none', resize: 'none', height: '42px' }} 
        />
        <button onClick={() => handleSend()} style={{ background: '#000', color: '#D4AF37', padding: '0 20px', height: '42px', borderRadius: '22px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.1rem', cursor: 'pointer', border: 'none', flexShrink: 0 }}>SEND</button>
      </div>
    </div>
  );
}
