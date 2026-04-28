"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function GuestPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: '', avatar_url: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [deletedIds, setDeletedIds] = useState([]); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const scrollRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const avatarFileInputRef = useRef(null);
  const longPressTimer = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchMessages(session.user.id);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchMessages(session.user.id);
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`room_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  };

  const saveProfile = async () => {
    if (!user) return;
    await supabase.from('profiles').upsert({ id: user.id, username: profile.username, avatar_url: profile.avatar_url });
    setShowSettings(false);
  };

  const fetchMessages = async (userId) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`user_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleSend = async (content, isImage = false) => {
    const text = content.trim();
    if (!text || !user) return;
    const { error } = await supabase.from('messages').insert([{ content: text, user_id: user.id, receiver_id: ADMIN_ID, is_image: isImage, is_read: false }]);
    if (!error) {
      if (!isImage) setInputText('');
      fetchMessages(user.id);
    }
  };

  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const handleTouchStart = (e, msg) => {
    longPressTimer.current = setTimeout(() => openMenu(e, msg), 600);
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  const handleChatImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const filePath = `chat/${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSend(publicUrl, true);
    }
    setIsUploading(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsAvatarUploading(true);
    const filePath = `avatars/${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl, username: profile.username });
    }
    setIsAvatarUploading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    await supabase.auth.signInWithPassword({ email, password });
  };

  if (!user) {
    return (
      <div style={{ height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', padding: '20px' }}>
        <form onSubmit={handleLogin} style={{ background: '#0a0a0a', border: '2px solid #800000', borderRadius: '25px', boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)', padding: '50px 30px', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px' }}>
          {/* ログイン画面の文字をさらに大きく */}
          <h1 style={{ color: '#800000', fontSize: '3.8rem', fontStyle: 'italic', fontWeight: 'bold', margin: '0', textAlign: 'center' }}>for VAU</h1>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '18px', color: '#fff', fontSize: '1rem', outline: 'none' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '18px', color: '#fff', fontSize: '1rem', outline: 'none' }} />
          </div>
          <button type="submit" style={{ width: '100%', background: '#800000', color: '#fff', border: 'none', padding: '18px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase' }}>LOG IN</button>
        </form>
      </div>
    );
  }

  return (
    <div onClick={() => { setContextMenu(null); if (showSettings) setShowSettings(false); }} 
         style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
      
      {/* メニュー：削除に表記変更 */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #333' }}
                  onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: (contextMenu.msg.user_id === user.id) ? '1px solid #333' : 'none' }}
                  onClick={() => { setDeletedIds([...deletedIds, contextMenu.msg.id]); setContextMenu(null); }}>削除</button>
          
          {contextMenu.msg.user_id === user.id && (
            <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}
                    onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }}>送信取消</button>
          )}
        </div>
      )}

      {showSettings && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '90px', right: '20px', background: '#0a0a0a', border: '1px solid #800000', borderRadius: '20px', boxShadow: '0 0 20px rgba(255,0,0,0.4)', padding: '25px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '20px', width: '280px', alignItems: 'center' }}>
          <div onClick={() => avatarFileInputRef.current?.click()} style={{ cursor: 'pointer', width: '90px', height: '90px', borderRadius: '50%', border: '2px solid #800000', overflow: 'hidden', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#800000', fontSize: '0.7rem' }}>TAP PHOTO</span>}
          </div>
          <input type="file" ref={avatarFileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
          <input type="text" placeholder="NAME" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} style={{ background: '#1a1a1a', border: 'none', borderBottom: '1px solid #333', color: '#fff', padding: '12px', outline: 'none', fontSize: '1rem', width: '100%', textAlign: 'center' }} />
          <button onClick={saveProfile} style={{ width: '100%', background: '#800000', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}>SAVE</button>
          <button onClick={() => supabase.auth.signOut()} style={{ color: '#800000', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>LOGOUT</button>
        </div>
      )}

      {/* チャット画面の文字をさらに大きく */}
      <header style={{ height: '80px', background: '#800000', borderBottom: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
        <span style={{ fontSize: '2.4rem', fontStyle: 'italic', fontWeight: 'bold', letterSpacing: '2px', paddingTop: '10px' }}>for VAU</span>
        <div onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} 
             style={{ position: 'absolute', right: '15px', top: '20px', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', border: '1px solid #D4AF37', overflow: 'hidden', background: '#333' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>VAU</div>}
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {messages.filter(m => !deletedIds.includes(m.id)).map(m => {
            const isMe = m.user_id === user.id;
            return (
              <div key={m.id} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div 
                  onContextMenu={(e) => openMenu(e, m)}
                  onTouchStart={(e) => handleTouchStart(e, m)}
                  onTouchEnd={handleTouchEnd}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}
                >
                  <div style={{ 
                    padding: m.is_image ? '5px' : '12px 16px', 
                    background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                    backdropFilter: 'blur(4px)',
                    borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                    border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                    maxWidth: '85%', fontSize: '0.95rem', color: '#fff'
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#666', marginTop: 'auto' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button onClick={() => chatFileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.5rem', padding: '5px', cursor: 'pointer' }}>{isUploading ? '...' : '⊕'}</button>
          <input type="file" ref={chatFileInputRef} hidden accept="image/*" onChange={handleChatImageUpload} />
          <textarea 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            placeholder="MESSAGES..." 
            rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '18px', padding: '8px 15px', resize: 'none', fontSize: '15px', outline: 'none', lineHeight: '1.4', maxHeight: '120px' }} 
          />
          <button onClick={() => handleSend(inputText)} style={{ background: '#000', color: '#D4AF37', padding: '8px 18px', borderRadius: '18px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '13px', cursor: 'pointer' }}>SEND</button>
        </div>
      </div>
    </div>
  );
}
