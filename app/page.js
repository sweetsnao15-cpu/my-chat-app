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
  const [contextMenu, setContextMenu] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

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
    const channel = supabase.channel(`guest_chat_${user.id}`)
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
    await supabase.from('profiles').upsert({ id: user.id, ...profile });
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
    if (!content || !user) return;
    const { error } = await supabase.from('messages').insert({
      content: content.trim(), user_id: user.id, receiver_id: ADMIN_ID, is_image: isImage, is_read: false
    });
    if (!error && !isImage) setInputText('');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSend(publicUrl, true);
    } else {
      alert("Upload failed: " + uploadError.message);
    }
    setIsUploading(false);
  };

  const handleLogin = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Invalid credentials.");
    }
  };

  const renderMessages = () => {
    let lastDate = "";
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', userSelect: 'none' }}>
        {messages.map(m => {
          const currentDate = new Date(m.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
          const showDate = currentDate !== lastDate;
          lastDate = currentDate;
          const isMe = m.user_id === user?.id;

          return (
            <div key={m.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '30px 0 15px', fontSize: '0.7rem', color: '#D4AF37', letterSpacing: '0.1rem' }}>― {currentDate} ―</div>
              )}
              <div onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msg: m }); }} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <div style={{ 
                    padding: m.is_image ? '5px' : '12px 16px', 
                    background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                    backdropFilter: 'blur(4px)',
                    borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                    border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                    maxWidth: '85%', fontSize: '0.95rem', whiteSpace: 'pre-wrap'
                  }}>
                    {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="" /> : m.content}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#666', marginTop: 'auto', marginBottom: '2px' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!user) {
    return (
      <div style={{ height: '100dvh', background: '#000', color: '#D4AF37', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif' }}>
        <h1 style={{ fontStyle: 'italic', marginBottom: '40px', fontSize: '2.5rem', letterSpacing: '8px' }}>VAU</h1>
        <button onClick={handleLogin} style={{ background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', padding: '15px 50px', borderRadius: '30px', cursor: 'pointer', fontSize: '0.9rem', letterSpacing: '2px', transition: '0.3s' }}>ENTER</button>
      </div>
    );
  }

  return (
    <div onClick={() => { setContextMenu(null); if (showSettings) setShowSettings(false); }} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      
      {/* 設定パネル */}
      {showSettings && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '70px', right: '20px', background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '15px', padding: '20px', zInterval: 1000, display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <input type="text" placeholder="Username" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: '#fff', padding: '5px', outline: 'none' }} />
          <input type="text" placeholder="Avatar URL" value={profile.avatar_url} onChange={e => setProfile({...profile, avatar_url: e.target.value})} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: '#fff', padding: '5px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={saveProfile} style={{ flex: 1, background: '#D4AF37', color: '#000', border: 'none', padding: '8px', borderRadius: '5px', fontWeight: 'bold' }}>SAVE</button>
            <button onClick={() => supabase.auth.signOut()} style={{ flex: 1, background: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '8px', borderRadius: '5px' }}>EXIT</button>
          </div>
        </div>
      )}

      {/* メッセージ削除メニュー */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 40, left: contextMenu.x - 40, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '10px', zIndex: 9999 }}>
          {contextMenu.msg.user_id === user.id && <div onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }} style={{ padding: '12px 25px', fontSize: '0.85rem', color: '#ff4d4d' }}>送信取消</div>}
        </div>
      )}

      <header style={{ padding: '15px 25px', background: '#800000', borderBottom: '1px solid #D4AF37', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '1.4rem', fontStyle: 'italic', letterSpacing: '3px' }}>VAU</span>
        <div onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} style={{ cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #D4AF37', overflow: 'hidden', background: '#333' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>👤</div>}
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        {renderMessages()}
      </div>

      <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.6rem', padding: '4px', cursor: 'pointer' }}>{isUploading ? '...' : '⊕'}</button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
          
          <textarea 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            placeholder="メッセージ..." 
            rows={1}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            style={{ 
              flex: 1, background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(212, 175, 55, 0.3)', 
              borderRadius: '20px', padding: '10px 18px', resize: 'none', fontSize: '15px', outline: 'none', 
              fontFamily: 'serif', lineHeight: '1.4', maxHeight: '150px'
            }} 
          />
          
          <button onClick={() => handleSend(inputText)} style={{ background: '#000', color: '#D4AF37', padding: '10px 22px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '13px', cursor: 'pointer' }}>SEND</button>
        </div>
      </div>
    </div>
  );
}
