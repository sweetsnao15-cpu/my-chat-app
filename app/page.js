"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const H = "bed1d346-5186-49cb-a371-1aad719c2a56", S = "vau2026";

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
      fontWeight: 'bold', fontSize: fontSize, border: '2px solid #D4AF37', textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }}>{initial}</div>
  );
};

export default function ChatPage() {
  const [ms, setMs] = useState([]), [ct, setCt] = useState(''), [user, setUser] = useState(null);
  const [pr, setPr] = useState({ username: '', avatar_url: '' }), [em, setEm] = useState(''), [pw, setPw] = useState('');
  const [isUp, setIsUp] = useState(false), [setOk, setSetOk] = useState(false), [ld, setLd] = useState(true);
  const scRef = useRef(null), txRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) { 
        setUser(s.user); 
        await loadP(s.user.id); 
        await loadM(s.user, true); 
      }
      setLd(false);
    };
    init();

    const { data: auth } = supabase.auth.onAuthStateChange((ev, s) => {
      if (s?.user) { 
        setUser(s.user); 
        loadP(s.user.id); 
        loadM(s.user, true); 
      }
    });

    // リアルタイム購読: メッセージとプロフィールの両方を監視
    const msgCh = supabase.channel('msg-ch').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      if (user) loadM(user, false);
    }).subscribe();

    const profCh = supabase.channel('prof-ch').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
      if (user && payload.new.id === user.id) {
        setPr({ username: payload.new.username, avatar_url: payload.new.avatar_url });
      }
    }).subscribe();

    return () => { 
      auth.subscription.unsubscribe(); 
      supabase.removeChannel(msgCh);
      supabase.removeChannel(profCh);
    };
  }, [user]);

  const loadP = async (id) => {
    const { data: d } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (d) setPr({ username: d.username || '', avatar_url: d.avatar_url || '' });
  };

  const loadM = async (u, sc) => {
    const { data: d } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (d) {
      setMs(d.filter(m => m.user_id === u.id || (m.user_id === H && m.recipient_id === u.id)));
      if (sc) setTimeout(() => scRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  };

  const savePr = async () => {
    if(!pr.username.trim()) return alert("名前を入力してください");
    const { error } = await supabase.from('profiles').upsert({ 
      id: user.id, 
      username: pr.username, 
      avatar_url: pr.avatar_url 
    });
    if (error) alert(error.message);
    else setSetOk(false);
  };

  const send = async (img = null) => {
    if ((!ct.trim() && !img) || !user) return;
    const t = ct; setCt('');
    const { error } = await supabase.from('messages').insert([{ 
      content: img || t, 
      user_id: user.id, 
      is_image: !!img, 
      receiver_id: H, 
      username: pr.username || 'GUEST', // 現在の名前を保存
      avatar_url: pr.avatar_url || '',  // 現在のアイコンを保存
      is_read: false
    }]);
    if (error) { alert(error.message); setCt(t); }
    else loadM(user, true);
  };

  const upAvatar = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const p = `avatars/${user.id}-${Math.random()}.${f.name.split('.').pop()}`;
    await supabase.storage.from('chat-images').upload(p, f);
    const { data: { publicUrl: u } } = supabase.storage.from('chat-images').getPublicUrl(p);
    setPr({ ...pr, avatar_url: u }); // stateを更新（保存ボタンでDB反映）
  };

  if (ld) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', background: '#0a0a0a', color: '#fff', borderRadius: '20px', border: '2px solid #800000', textAlign: 'center' }}>
      <h2 style={{ color: '#800000' }}>{isUp ? "SIGN UP" : "for VAU"}</h2>
      <input type="email" placeholder="Email" value={em} onChange={e => setEm(e.target.value)} style={{ width: '100%', padding: '12px', margin: '10px 0', background: '#1a1a1a', color: '#fff', border: '1px solid #333' }} />
      <input type="password" placeholder="Pw" value={pw} onChange={e => setPw(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', background: '#1a1a1a', color: '#fff', border: '1px solid #333' }} />
      <button onClick={async () => { const {error} = isUp ? await supabase.auth.signUp({email:em,password:pw}) : await supabase.auth.signInWithPassword({email:em,password:pw}); if(error) alert(error.message); }} style={{ width: '100%', padding: '12px', background: '#800000', color: '#fff', fontWeight: 'bold' }}>{isUp ? "CREATE" : "LOG IN"}</button>
      <p onClick={() => setIsUp(!isUp)} style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666', cursor: 'pointer' }}>{isUp ? "Back to Login" : "Need Account?"}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'relative' }}>
      
      {/* 設定モーダル */}
      {setOk && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '300px', background: '#1a1a1a', padding: '30px', borderRadius: '25px', border: '2px solid #800000', textAlign: 'center' }}>
            <label style={{ display: 'block', margin: '0 auto 20px', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid #D4AF37', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
              {pr.avatar_url ? <img src={pr.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <InitialAvatar name={pr.username} size="100px" fontSize="3rem" />}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraIcon /></div>
              <input type="file" accept="image/*" onChange={upAvatar} style={{ display: 'none' }} />
            </label>
            <input value={pr.username} onChange={e => setPr({...pr, username: e.target.value})} placeholder="名前を入力" style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }} />
            <button onClick={savePr} style={{ width: '100%', padding: '10px', background: '#800000', color: '#fff', fontWeight: 'bold' }}>SAVE</button>
            <button onClick={() => setSetOk(false)} style={{ marginTop: '10px', background: 'transparent', color: '#666', border: 'none' }}>CLOSE</button>
          </div>
        </div>
      )}

      <header style={{ padding: '10px 25px', background: '#800000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '80px', borderBottom: '2px solid #D4AF37' }}>
        <h1 style={{ fontSize: '2.2rem', fontFamily: '"Times New Roman", serif', fontStyle: 'italic', letterSpacing: '2px' }}>for VAU</h1>
        <div onClick={() => setSetOk(true)} style={{ cursor: 'pointer' }}>
          {pr.avatar_url ? <img src={pr.avatar_url} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }} alt=""/> : <InitialAvatar name={pr.username} />}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {ms.map(m => {
          const isMe = m.user_id === user.id;
          return (
            <div key={m.id} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '4px' }}>
                <div style={{ padding: m.is_image ? '5px' : '10px 16px', background: isMe ? '#800000' : '#333', borderRadius: isMe ? '18px 18px 0 18px' : '18px 18px 18px 0', border: isMe ? 'none' : '1px solid #444' }}>
                  {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px' }} alt=""/> : m.content}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isMe && m.is_read && <span style={{ fontSize: '12px', color: '#D4AF37', fontWeight: 'bold' }}>✓</span>}
                  <span style={{ fontSize: '0.6rem', color: '#ccc' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={scRef} />
      </div>

      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '10px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37' }}>
        <label style={{ background: '#000', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <CameraIcon /><input type="file" accept="image/*" onChange={async (e)=>{const f=e.target.files[0]; if(!f)return; const p=`chats/${Math.random()}.${f.name.split('.').pop()}`; await supabase.storage.from('chat-images').upload(p,f); const {data:{publicUrl:u}}=supabase.storage.from('chat-images').getPublicUrl(p); send(u);}} style={{display:'none'}}/>
        </label>
        <textarea ref={txRef} value={ct} onChange={e => setCt(e.target.value)} placeholder="Message..." style={{ flex: 1, padding: '8px 18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)', outline: 'none', resize: 'none', height: '38px', background: '#800000', color: '#fff' }} />
        <button onClick={() => send()} style={{ background: '#000', color: '#D4AF37', width: '60px', height: '38px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: 'bold', fontStyle: 'italic' }}>SEND</button>
      </div>
      <style jsx>{`textarea::placeholder { color: rgba(255, 255, 255, 0.6); }`}</style>
    </div>
  );
}
