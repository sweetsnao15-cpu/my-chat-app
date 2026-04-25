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
  const defaultChar = "V";
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : defaultChar;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      letterSpacing: '-1px', userSelect: 'none',
      border: '2px solid #D4AF37',
      WebkitUserSelect: 'none'
    }}>{initial}</div>
  );
};

export default function ChatPage() {
  const [ms, setMs] = useState([]), [ct, setCt] = useState(''), [user, setUser] = useState(null);
  const [pr, setPr] = useState({ username: '', avatar_url: '' }), [em, setEm] = useState(''), [pw, setPw] = useState('');
  const [isA, setA] = useState(false), [setOk, setSetOk] = useState(false), [isUp, setIsUp] = useState(false);
  const [ld, setLd] = useState(true), scRef = useRef(null), txRef = useRef(null);
  
  const [menu, setMenu] = useState(null);
  const longPressTimer = useRef(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search), ad = p.get('admin') === S;
    if (ad) setA(true);
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) { setUser(s.user); await loadP(s.user.id); await loadM(s.user, ad, true); }
      setLd(false);
    };
    init();
    const { data: auth } = supabase.auth.onAuthStateChange((ev, s) => {
      const u = s?.user; setUser(u);
      if (ev === 'SIGNED_IN' && u) { loadP(u.id); loadM(u, ad, true); }
    });
    const ch = supabase.channel('db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      supabase.auth.getUser().then(({data:{user:u}}) => u && loadM(u, ad, false));
    }).subscribe();
    return () => { auth.subscription.unsubscribe(); supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { 
    if (txRef.current) { 
      txRef.current.style.height = '38px';
      if (ct) txRef.current.style.height = Math.min(txRef.current.scrollHeight, 150) + 'px'; 
    } 
  }, [ct]);

  const loadP = async (id) => {
    const { data: d } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (d) setPr({ username: d.username || '', avatar_url: d.avatar_url || '' });
  };

  const loadM = async (u, ad, sc) => {
    if (!u) return;
    const { data: d } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!d) return;
    const isAdm = u.id === H || ad;
    setMs(d.filter(m => isAdm || m.user_id === u.id || (m.user_id === H && m.recipient_id === u.id)));
    if (sc) setTimeout(() => scRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
  };

  const deleteMsg = async (id, all = false) => {
    if (all && !confirm("相手の画面からも消去しますか？")) return;
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) alert(error.message); else loadM(user, isA, false);
    setMenu(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setMenu(null);
    }).catch(err => alert("コピーに失敗しました"));
  };

  const handleTouchStart = (m) => {
    longPressTimer.current = setTimeout(() => {
      setMenu(m);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const authAction = async () => {
    const { error: e } = isUp ? await supabase.auth.signUp({ email:em, password:pw }) : await supabase.auth.signInWithPassword({ email:em, password:pw });
    if (e) alert(e.message);
  };

  const savePr = async () => {
    if(!pr.username.trim()) return alert("名前を入力してください");
    await supabase.from('profiles').upsert({ id: user.id, username: pr.username, avatar_url: pr.avatar_url });
    setSetOk(false);
  };

  const send = async (img = null) => {
    if ((!ct.trim() && !img) || !user) return;
    const t = ct; setCt('');
    const { error: e } = await supabase.from('messages').insert([{ 
      content: img || t, 
      user_id: user.id, 
      is_image: !!img, 
      receiver_id: H,
      username: pr.username || 'GUEST',
      avatar_url: pr.avatar_url || ''
    }]);
    if (e) { alert(e.message); setCt(t); } else loadM(user, isA, true);
  };

  const up = async (e, isAv = false) => {
    const f = e.target.files[0]; if (!f) return;
    const p = `${Math.random()}.${f.name.split('.').pop()}`;
    await supabase.storage.from('chat-images').upload(p, f);
    const { data: { publicUrl: u } } = supabase.storage.from('chat-images').getPublicUrl(p);
    if (isAv) setPr({ ...pr, avatar_url: u }); else send(u);
  };

  if (ld) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', background: '#0a0a0a', color: '#fff', borderRadius: '20px', border: '2px solid #800000', textAlign: 'center' }}>
      <h2 style={{ color: '#800000', fontSize: '1.8rem' }}>{isUp ? "SIGN UP" : "for VAU"}</h2>
      <input type="email" placeholder="Email" value={em} onChange={e => setEm(e.target.value)} style={{ width: '100%', padding: '12px', margin: '10px 0', background: '#1a1a1a', color: '#fff', border: '1px solid #333', fontSize: '16px' }} />
      <input type="password" placeholder="Pw" value={pw} onChange={e => setPw(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', fontSize: '16px' }} />
      <button onClick={authAction} style={{ width: '100%', padding: '12px', background: '#800000', border: 'none', color: '#fff', fontWeight: 'bold' }}>{isUp ? "CREATE" : "LOG IN"}</button>
      <p onClick={() => setIsUp(!isUp)} style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666', cursor: 'pointer' }}>{isUp ? "Back to Login" : "Need Account?"}</p>
    </div>
  );

  return (
    <div style={{ 
      maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', position: 'relative', 
      WebkitTapHighlightColor: 'transparent',
      WebkitUserSelect: 'none', userSelect: 'none'
    }}>
      <header style={{ 
        padding: '10px 25px 0 25px', 
        background: '#800000', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        minHeight: '80px', 
        borderBottom: '2px solid #D4AF37', 
        zIndex: 10 
      }}>
        <h1 style={{ 
          fontSize: '2.2rem', 
          fontWeight: '700', 
          letterSpacing: '3px', 
          margin: 0,
          paddingLeft: '25px',
          fontFamily: '"Times New Roman", Times, serif', 
          fontStyle: 'italic',
          color: '#fff',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          {user.id === H || isA ? "ADMIN" : "for VAU"}
        </h1>
        <div onClick={() => setSetOk(true)} style={{ cursor: 'pointer' }}>
          {pr.avatar_url ? 
            <img src={pr.avatar_url} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #D4AF37' }} alt="" /> 
            : 
            <InitialAvatar name={pr.username} size="48px" />
          }
        </div>
      </header>

      {menu && (
        <div onClick={() => setMenu(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', borderRadius: '24px', width: '260px', overflow: 'hidden', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            {!menu.is_image && (
              <button onClick={() => copyToClipboard(menu.content)} style={{ width: '100%', padding: '16px', background: 'none', border: 'none', color: '#fff', fontSize: '1rem', borderBottom: '1px solid #333' }}>コピー</button>
            )}
            <button onClick={() => deleteMsg(menu.id, true)} style={{ width: '100%', padding: '16px', background: 'none', border: 'none', color: '#ff6b6b', fontSize: '1rem', borderBottom: '1px solid #333' }}>送信取消 (全員から)</button>
            <button onClick={() => deleteMsg(menu.id, false)} style={{ width: '100%', padding: '16px', background: 'none', border: 'none', color: '#fff', fontSize: '1rem' }}>削除 (自分のみ)</button>
            <button onClick={() => setMenu(null)} style={{ width: '100%', padding: '14px', background: '#222', border: 'none', color: '#999', fontSize: '0.9rem' }}>キャンセル</button>
          </div>
        </div>
      )}

      {setOk && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '300px', background: '#1a1a1a', padding: '30px', borderRadius: '25px', border: '2px solid #800000', textAlign: 'center' }}>
            <label style={{ display: 'block', margin: '0 auto 20px', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid #D4AF37', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
              {pr.avatar_url ? <img src={pr.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <InitialAvatar name={pr.username} size="100px" fontSize="3rem" />}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraIcon /></div>
              <input type="file" accept="image/*" onChange={e => up(e, true)} style={{ display: 'none' }} />
            </label>
            <input value={pr.username} onChange={e => setPr({...pr, username: e.target.value})} placeholder="名前" style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #333', marginBottom: '20px', textAlign: 'center', fontSize: '16px', userSelect: 'text' }} />
            <button onClick={savePr} style={{ width: '100%', padding: '10px', background: '#800000', color: '#fff', fontWeight: 'bold' }}>SAVE</button>
            <button onClick={() => setSetOk(false)} style={{ marginTop: '10px', background: 'transparent', color: '#666', border: 'none' }}>CLOSE</button>
            <button onClick={() => supabase.auth.signOut()} style={{ marginTop: '20px', width: '100%', color: '#ffaaaa', background: 'none', border: 'none', fontSize: '0.8rem' }}>LOGOUT</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {ms.map(m => {
          const isMe = m.user_id === user.id;
          return (
            <div key={m.id} style={{ marginBottom: '20px', textAlign: isMe ? 'right' : 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '4px' }}>
                <div 
                  onTouchStart={() => handleTouchStart(m)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                  onContextMenu={(e) => { e.preventDefault(); setMenu(m); }}
                  style={{ 
                    display: 'inline-block', maxWidth: '85%', padding: m.is_image ? '5px' : '10px 16px', 
                    background: isMe ? '#800000' : '#333', 
                    borderRadius: isMe ? '18px 18px 0 18px' : '18px 18px 18px 0', 
                    color: '#fff', 
                    wordBreak: 'break-all', whiteSpace: 'pre-wrap', textAlign: 'left',
                    cursor: 'pointer', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', 
                    userSelect: 'none', touchAction: 'manipulation',
                    border: isMe ? 'none' : '1px solid #444'
                  }}>
                  {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '12px', display: 'block', pointerEvents: 'none' }} alt="" /> : m.content}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {/* 既読チェックマークの表示 */}
                  {isMe && m.is_read && <span style={{ fontSize: '10px', color: '#D4AF37' }}>✓</span>}
                  <span style={{ fontSize: '0.5rem', color: '#ccc' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={scRef} />
      </div>

      <div style={{ padding: '15px 20px', background: '#800000', display: 'flex', gap: '10px', alignItems: 'flex-end', borderTop: '2px solid #D4AF37', zIndex: 10 }}>
        <label style={{ background: '#000', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <CameraIcon /><input type="file" accept="image/*" onChange={up} style={{ display: 'none' }} />
        </label>
        {/* 入力欄の縁を背景に馴染ませる設定 */}
        <textarea 
          ref={txRef} 
          value={ct} 
          onChange={e => setCt(e.target.value)} 
          placeholder="Message..." 
          style={{ 
            flex: 1, padding: '8px 18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', // 縁の色を調整
            outline: 'none', resize: 'none', height: '38px', fontSize: '16px', lineHeight: '22px', 
            userSelect: 'text', WebkitUserSelect: 'text', background: '#fff' 
          }} 
        />
        {/* SENDボタンのフォントと色をヘッダーに統一 */}
        <button 
          onClick={() => send()} 
          style={{ 
            background: '#000', 
            color: '#D4AF37', // 金色
            width: '60px', 
            height: '38px', 
            borderRadius: '20px', 
            border: 'none',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '1px',
            fontFamily: '"Times New Roman", Times, serif', // ヘッダーと同じフォント
            fontStyle: 'italic'
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
