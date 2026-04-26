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
    if (!content.trim() || !user) return;
    await supabase.from('messages').insert({
      content: content.trim(), user_id: user.id, receiver_id: ADMIN_ID, is_image: isImage, is_read: false
    });
    if (!isImage) setInputText('');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSend(publicUrl, true);
    }
    setIsUploading(false);
  };

  const handleLogin = async () => {
    const email = prompt("Enter ID (Email):");
    const password = prompt("Enter PASS:");
    if (email && password) await supabase.auth.signInWithPassword({ email, password });
  };

  // 1. ログイン画面：【画像のデザインを適用】
  if (!user) {
    return (
      <div style={{ height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px' }}>
        <div style={{ background: '#0a0a0a', border: '2px solid #800000', borderRadius: '25px', boxShadow: '0 0 15px rgba(255, 0, 0, 0.4)', padding: '50px 30px', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ color: '#800000', fontSize: '2rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', margin: '0' }}>for VAU</h1>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }} onClick={handleLogin}>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '15px', color: '#888', fontSize: '0.9rem' }}>Email</div>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '15px', color: '#888', fontSize: '0.9rem' }}>Password</div>
          </div>
          <button onClick={handleLogin} style={{ width: '100%', background: '#800000', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', textTransform: 'uppercase' }}>LOG IN</button>
        </div>
      </div>
    );
  }

  // 2. ログイン後の画面：【チャット欄のデザインはそのまま維持】
  return (
    <div onClick={() => { if (showSettings) setShowSettings(false); }} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      
      {/* 設定パネル：画像のデザインに準拠 */}
      {showSettings && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '70px', right: '20px', background: '#0a0a0a', border: '1px solid #800000', borderRadius: '15px', boxShadow: '0 0 15px rgba(255,0,0,0.3)', padding: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '15px', width: '250px' }}>
          <input type="text" placeholder="NAME" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} style={{ background: '#1a1a1a', border: 'none', borderBottom: '1px solid #333', color: '#fff', padding: '8px', outline: 'none', fontSize: '0.9rem' }} />
          <input type="text" placeholder="AVATAR URL" value={profile.avatar_url} onChange={e => setProfile({...profile, avatar_url: e.target.value})} style={{ background: '#1a1a1a', border: 'none', borderBottom: '1px solid #333', color: '#fff', padding: '8px', outline: 'none', fontSize: '0.9rem' }} />
          <button onClick={saveProfile} style={{ background: '#800000', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>SAVE</button>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: '1px solid #800000', color: '#800000', padding: '8px', borderRadius: '8px', fontSize: '0.7rem' }}>EXIT</button>
        </div>
      )}

      {/* ヘッダー */}
      <header style={{ padding: '10px 20px', background: '#800000', borderBottom: '1px solid #D4AF37', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '1.2rem', fontStyle: 'italic' }}>for VAU</span>
        <div onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} style={{ cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #D4AF37', overflow: 'hidden', background: '#333' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>VAU</div>}
        </div>
      </header>

      {/* メッセージ：以前のデザインを維持 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          {messages.map(m => {
            const isMe = m.user_id === user.id;
            return (
              <div key={m.id} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
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

      {/* 入力欄：以前のデザインを維持 */}
      <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.5rem', padding: '5px', cursor: 'pointer' }}>{isUploading ? '...' : '⊕'}</button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
          <textarea 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            placeholder="メッセージ..." 
            rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '18px', padding: '8px 15px', resize: 'none', fontSize: '15px', outline: 'none', lineHeight: '1.4', maxHeight: '120px' }} 
          />
          <button onClick={() => handleSend(inputText)} style={{ background: '#000', color: '#D4AF37', padding: '8px 18px', borderRadius: '18px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '13px' }}>SEND</button>
        </div>
      </div>
    </div>
  );
}
