"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function GuestPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: '', avatar_url: '' });
  const [contextMenu, setContextMenu] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  // 認証状態の監視と初期データの取得
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
      } else {
        setMessages([]);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // リアルタイム更新の購読
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`guest_room_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  };

  const updateProfile = async () => {
    if (!user) return;
    await supabase.from('profiles').upsert({ id: user.id, ...profile });
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
    const filePath = `chat/${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await handleSend(publicUrl, true);
    }
    setIsUploading(false);
  };

  const handleLogin = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Login failed");
    }
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
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
                <div style={{ textAlign: 'center', margin: '30px 0 15px', fontSize: '0.7rem', color: '#D4AF37', letterSpacing: '0.1rem', fontFamily: 'serif' }}>― {currentDate} ―</div>
              )}
              <div 
                onContextMenu={(e) => handleContextMenu(e, m)}
                style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <div style={{ 
                    padding: m.is_image ? '5px' : '12px 16px', 
                    background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                    backdropFilter: 'blur(4px)',
                    borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                    border: isMe ? '1px solid rgba(128, 0, 0, 0.5)' : '1px solid #D4AF37', 
                    maxWidth: '85%', fontSize: '0.95rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
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
        <h1 style={{ fontStyle: 'italic', marginBottom: '30px', fontSize: '2rem' }}>for VAU</h1>
        <button onClick={handleLogin} style={{ background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', padding: '12px 45px', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' }}>LOGIN</button>
      </div>
    );
  }

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y - 60, left: contextMenu.x - 40, background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '10px', zIndex: 9999 }}>
          <div onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }} style={{ padding: '12px 20px', fontSize: '0.85rem', borderBottom: '1px solid #333' }}>コピー</div>
          {contextMenu.msg.user_id === user?.id && <div onClick={async () => { await supabase.from('messages').delete().eq('id', contextMenu.msg.id); setContextMenu(null); }} style={{ padding: '12px 20px', fontSize: '0.85rem', color: '#ff4d4d' }}>送信取消</div>}
        </div>
      )}

      <header style={{ padding: '10px 20px', background: '#800000', borderBottom: '1px solid #D4AF37', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '1.2rem', fontStyle: 'italic' }}>for VAU</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input type="text" placeholder="Avatar URL" value={profile.avatar_url} onChange={e => setProfile({...profile, avatar_url: e.target.value})} onBlur={updateProfile} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #D4AF37', color: '#fff', fontSize: '0.7rem', width: '60px', outline: 'none' }} />
          <input type="text" placeholder="Name" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} onBlur={updateProfile} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #D4AF37', color: '#fff', fontSize: '0.8rem', width: '80px', outline: 'none' }} />
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>EXIT</button>
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#050505' }}>
        {renderMessages()}
      </div>

      <div style={{ padding: '10px 15px', background: '#800000', borderTop: '1px solid #D4AF37', flexShrink: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.5rem', padding: '5px', cursor: 'pointer' }}>{isUploading ? '...' : '⊕'}</button>
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
              flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', 
              borderRadius: '18px', padding: '8px 15px', resize: 'none', fontSize: '15px', outline: 'none', 
              fontFamily: 'serif', lineHeight: '1.4', maxHeight: '120px'
            }} 
          />
          
          <button onClick={() => handleSend(inputText)} style={{ background: '#000', color: '#D4AF37', padding: '8px 18px', borderRadius: '18px', fontWeight: 'bold', border: '1px solid #D4AF37', fontSize: '13px', fontFamily: 'serif', cursor: 'pointer' }}>SEND</button>
        </div>
      </div>
    </div>
  );
}
