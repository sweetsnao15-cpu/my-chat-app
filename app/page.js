"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function GuestPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
  const textareaRef = useRef(null);
  const longPressTimer = useRef(null);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await Promise.all([fetchProfile(session.user.id), fetchMessages(session.user.id)]);
      }
      setLoading(false);
    };
    checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchMessages(session.user.id);
      } else {
        setMessages([]);
        setProfile({ username: '', avatar_url: '' });
      }
      setLoading(false);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowSettings(false);
  };

  const fetchMessages = async (userId) => {
    const { data } = await supabase.from('messages').select('*').or(`user_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSend = async (content, isImage = false) => {
    const text = content?.trim();
    if (!text || !user) return;
    const { error } = await supabase.from('messages').insert([{ content: text, user_id: user.id, receiver_id: ADMIN_ID, is_image: isImage, is_read: false }]);
    if (!error) {
      if (!isImage) {
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      fetchMessages(user.id);
    }
  };

  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  const handleTouchStart = (e, msg) => { longPressTimer.current = setTimeout(() => openMenu(e, msg), 600); };
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
    }
    setIsAvatarUploading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    await supabase.auth.signInWithPassword({ email, password });
  };

  if (loading) return <div style={{ height: '100dvh', background: '#000' }} />;

  if (!user) {
    return (
      <div style={{ height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', padding: '20px' }}>
        <form onSubmit={handleLogin} style={{ background: '#0a0a0a', border: '2px solid #800000', borderRadius: '25px', padding: '50px 30px', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <h1 style={{ color: '#800000', fontSize: '3.8rem', fontStyle: 'italic', fontWeight: 'bold', margin: '0', textAlign: 'center' }}>for VAU</h1>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '18px', color: '#fff', fontSize: '1rem', outline: 'none' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '18px', color: '#fff', fontSize: '1rem', outline: 'none' }} />
          </div>
          <button type="submit" style={{ width: '100%', background: '#800000', color: '#fff', border: 'none', padding: '18px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>LOGIN</button>
        </form>
      </div>
    );
  }

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif', WebkitUserSelect: 'none', userSelect: 'none' }}>
      
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#111', border: '1px solid #D4AF37', borderRadius: '20px', padding: '30px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: '#D4AF37', marginBottom: '20px', fontStyle: 'italic' }}>PROFILE SETTINGS</h2>
            <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 20px', cursor: 'pointer' }} onClick={() => avatarFileInputRef.current.click()}>
              {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #D4AF37' }} /> : <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #D4AF37' }}>UP</div>}
              <input type="file" ref={avatarFileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
            </div>
            <input type="text" value={profile.username} onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))} placeholder="Username" style={{ width: '100%', background: '#000', border: '1px solid #333', borderRadius: '10px', padding: '12px', color: '#fff', marginBottom: '10px', textAlign: 'center' }} />
            <button onClick={handleLogout} style={{ width: '100%', background: 'transparent', border: 'none', color: '#ff4d4d', fontSize: '0.9rem', marginBottom: '20px', cursor: 'pointer', fontWeight: 'bold' }}>LOGOUT</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSettings(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #444', color: '#888', padding: '12px', borderRadius: '10px' }}>CANCEL</button>
              <button onClick={saveProfile} style={{ flex: 1, background: '#800000', color: '#fff', padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}>SAVE</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 80, left: contextMenu.x - 60, background: '#1a1a1a', border: '1px solid #800000', borderRadius: '12px', zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333' }} onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>コピー</button>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', borderBottom: (contextMenu.msg.user_id === user.id) ? '1px solid #333' : 'none' }} onClick={() => { setDeletedIds([...deletedIds, contextMenu.msg.id]); setContextMenu(null); }}>削除</button>
          {contextMenu.msg.user_id === user.id && (
            <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 25px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }} onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }}>送信取消</button>
          )}
        </div>
      )}

      {/* ヘッダー：高さを少し低く(paddingを20pxに調整) */}
      <header style={{ padding: '20px 15px', background: '#4a0000', borderBottom: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, zIndex: 10 }}>
        <span style={{ fontSize: '1.6rem', fontStyle: 'italic', fontWeight: 'bold', letterSpacing: '5px', color: '#fff' }}>for VAU</span>
        <div onClick={() => setShowSettings(!showSettings)} style={{ position: 'absolute', right: '15px', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #D4AF37', overflow: 'hidden', background: '#333' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>GUEST</div>}
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '20px' }}>
          {messages.filter(m => !deletedIds.includes(m.id)).map((m, index) => {
            const isMe = m.user_id === user.id;
            const date = new Date(m.created_at);
            const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const filteredMessages = messages.filter(m => !deletedIds.includes(m.id));
            const currentMsgIndex = filteredMessages.findIndex(fm => fm.id === m.id);
            const prevMsg = currentMsgIndex > 0 ? filteredMessages[currentMsgIndex - 1] : null;
            const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();
            
            return (
              <div key={m.id}>
                {isNewDay && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic', opacity: 0.6 }}>{dateStr}</div>
                  </div>
                )}
                <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div onContextMenu={(e) => openMenu(e, m)} onTouchStart={(e) => handleTouchStart(e, m)} onTouchEnd={handleTouchEnd} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '85%' }}>
                    {/* 吹き出し背景色をホスト側と同じ設定に変更 */}
                    <div style={{ 
                      padding: m.is_image ? '5px' : '12px 16px', 
                      background: isMe ? 'rgba(128, 0, 0, 0.8)' : '#1a1a1a', 
                      backdropFilter: 'blur(4px)', 
                      borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                      border: isMe ? '1px solid #800000' : '1px solid #333', 
                      fontSize: '0.95rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' 
                    }}>
                      {m.is_image ? <img src={m.content} onLoad={() => scrollToBottom('auto')} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#D4AF37', whiteSpace: 'nowrap', paddingBottom: '2px' }}>{timeStr}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '12px 15px', background: '#4a0000', borderTop: '1px solid #D4AF37', flexShrink: 0, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          
          <button
            onClick={() => chatFileInputRef.current?.click()}
            disabled={isUploading}
            style={{ 
              background: '#000', border: '1px solid #D4AF37', borderRadius: '50%', 
              width: '42px', height: '42px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0
            }}
          >
            {isUploading ? <span style={{ color: '#D4AF37', fontSize: '0.6rem' }}>...</span> : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </button>
          <input type="file" ref={chatFileInputRef} hidden accept="image/*" onChange={handleChatImageUpload} />

          <textarea 
            ref={textareaRef}
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            placeholder="MESSAGES..." 
            rows={1} 
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} 
            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '22px', padding: '10px 18px', resize: 'none', fontSize: '16px', outline: 'none', lineHeight: '1.4', maxHeight: '120px' }} 
          />
          
          <button 
            onClick={() => handleSend(inputText)} 
            style={{ background: '#000', color: '#D4AF37', padding: '10px 20px', borderRadius: '22px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '0.85rem', cursor: 'pointer', height: '42px' }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
